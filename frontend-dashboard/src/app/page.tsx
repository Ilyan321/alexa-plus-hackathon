'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Mic,
  AudioWaveform,
  Keyboard,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  RotateCcw,
  Wrench,
  Radio,
  Ear,
  Headphones,
} from 'lucide-react';
import {
  stripThinking,
  parseDeviation,
  formatAgentCoreSpokenText,
  normalizeAcousticSpeech,
} from '../lib/speech-utils';
import CodeBlock from '../components/CodeBlock';
import ToleranceDeviationGauge, {
  extractMetrologyTelemetry,
} from '../components/ToleranceDeviationGauge';
import SpcDriftWidget from '../components/SpcDriftWidget';
import InspectionChips from '../components/InspectionChips';

type StatusType = 'idle' | 'listening' | 'processing' | 'normal' | 'error';

export default function VoiceAssistantPage() {
  // Mode states
  const [isTextMode, setIsTextMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [continuousHandsFree, setContinuousHandsFree] = useState(false);

  // Content states
  const [displayPrompt, setDisplayPrompt] = useState("I'm listening.");
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [deviationStatus, setDeviationStatus] = useState<StatusType>('idle');
  const [textInput, setTextInput] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  // Production run inspection telemetry history (last 5 readings per feature to monitor machine tooling drift)
  const [telemetryHistory, setTelemetryHistory] = useState<Record<string, number[]>>({});

  // Voice engine refs
  const recognitionRef = useRef<any>(null);
  const bargeInRecognitionRef = useRef<any>(null);
  const isRecordingIntentRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  const latestLiveTranscriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const continuousHandsFreeRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize continuousHandsFree ref
  useEffect(() => {
    continuousHandsFreeRef.current = continuousHandsFree;
  }, [continuousHandsFree]);

  // Silent background pre-warm of the Render Edge MCP server on initial app load
  useEffect(() => {
    try {
      fetch('https://echoforge-mcp.onrender.com/health', { mode: 'no-cors' }).catch(() => {});
    } catch {}
  }, []);

  // Stop barge-in listener immediately and release microphone hardware
  const stopBargeInListener = useCallback(() => {
    if (bargeInRecognitionRef.current) {
      const instance = bargeInRecognitionRef.current;
      bargeInRecognitionRef.current = null;
      try {
        instance.onend = null;
        instance.onerror = null;
        instance.onresult = null;
        instance.abort();
      } catch {}
    }
  }, []);

  // Call the Bedrock AgentCore backend
  const callAgent = useCallback(
    async (prompt: string): Promise<{ text: string; sessionId: string }> => {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || `HTTP ${res.status}`);
      }
      return res.json();
    },
    [sessionId]
  );

  // Speak agent response aloud with continuous hands-free follow-up loop and barge-in detection
  const speakResponse = useCallback(
    (text: string, contextPrompt?: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (continuousHandsFreeRef.current && !isTextMode) {
          setTimeout(() => startRecording(true), 500);
        }
        return;
      }

      const synth = window.speechSynthesis;
      synth.cancel();
      stopBargeInListener();

      // If TTS is disabled, handle hands-free transition immediately
      if (!ttsEnabled) {
        if (continuousHandsFreeRef.current && !isTextMode) {
          setTimeout(() => startRecording(true), 600);
        }
        return;
      }
      
      // Workaround for Chrome bug where speechSynthesis gets stuck in paused state
      if (synth.paused) {
        synth.resume();
      }

      // Dynamically read AgentCore's generated response aloud naturally without static placeholders
      const clean = formatAgentCoreSpokenText(text, contextPrompt);
      if (!clean) {
        if (continuousHandsFreeRef.current && !isTextMode) {
          setTimeout(() => startRecording(true), 500);
        }
        return;
      }

      // Stop normal microphone recording while assistant speaks
      isRecordingIntentRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.15;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      // Pick natural sounding voice if available
      const voices = synth.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang === 'en-US' && /Google|Natural|Samantha|Alex/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      const startBargeInListener = () => {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        try {
          const bargeIn = new SpeechRecognition();
          bargeIn.continuous = true;
          bargeIn.interimResults = true;
          bargeIn.lang = 'en-US';

          bargeIn.onresult = (event: any) => {
            if (!isAssistantSpeakingRef.current) return;
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcript = event.results[i][0]?.transcript?.trim().toLowerCase() || '';
              // Detect barge-in wake word or interrupt command
              if (/\b(echo|alexa|stop|cancel|pause|quiet|halt|shut\s*up|wait)\b/i.test(transcript)) {
                console.log('[EchoForge] Barge-in wake trigger detected:', transcript);
                // Nullify utterance callbacks so synth.cancel() does NOT fire duplicate finish/restart cycles
                utterance.onend = null;
                utterance.onerror = null;
                synth.cancel();
                isAssistantSpeakingRef.current = false;
                stopBargeInListener();
                setDisplayPrompt('Listening...');
                setSubStatus('Interrupted via Barge-In. Listening...');
                if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
                setTimeout(() => {
                  startRecording(true);
                }, 250);
                return;
              }
            }
          };

          bargeIn.onerror = (e: any) => {
            if (e.error !== 'no-speech') {
              console.warn('[EchoForge] Barge-in recognition note:', e.error);
            }
          };

          bargeIn.onend = () => {
            if (isAssistantSpeakingRef.current) {
              setTimeout(() => {
                if (isAssistantSpeakingRef.current) {
                  startBargeInListener();
                }
              }, 100);
            }
          };

          bargeIn.start();
          bargeInRecognitionRef.current = bargeIn;
        } catch (e) {
          console.warn('[EchoForge] Unable to start barge-in listener:', e);
        }
      };

      utterance.onstart = () => {
        isAssistantSpeakingRef.current = true;
        // Start lightweight wake word listener during speech output
        startBargeInListener();
      };

      const handleSpeechFinished = () => {
        stopBargeInListener();
        isAssistantSpeakingRef.current = false;
        if (continuousHandsFreeRef.current && !isTextMode) {
          if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
          followUpTimerRef.current = setTimeout(() => {
            startRecording(true);
          }, 450);
        }
      };

      utterance.onend = handleSpeechFinished;

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        handleSpeechFinished();
      };

      synth.speak(utterance);
    },
    [ttsEnabled, isTextMode, stopBargeInListener]
  );

  // Workflow processing
  const processWorkflow = useCallback(
    async (userPrompt: string) => {
      const prompt = userPrompt.trim();
      if (!prompt || isProcessing) return;

      setIsProcessing(true);
      setSubStatus('Interrogating factory sensors via AWS AgentCore...');
      setDisplayPrompt(`"${prompt}"`);

      // Friendly cold-start indicator if Render edge node or AgentCore is waking from sleep
      const coldStartTimer = setTimeout(() => {
        setSubStatus('Connecting to edge sensor node (waking from standby)...');
      }, 4500);

      try {
        const data = await callAgent(prompt);
        clearTimeout(coldStartTimer);
        const cleanText = stripThinking(data.text);

        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        // Determine status: out-of-tolerance signals take clear precedence
        const isOutOfTol =
          /out of tolerance|exceeds|exceeded|exceeding|requires repair|requires cnc rework|not safe|deviation exceeded/i.test(cleanText);
        const isWithinTol =
          /within tolerance|in tolerance|nominal|passes tolerance|safe for (final )?turbine assembly/i.test(cleanText);

        const devVal = parseDeviation(cleanText);
        let newStatus: StatusType = 'normal';
        if (isOutOfTol) {
          newStatus = 'error';
        } else if (isWithinTol) {
          newStatus = 'normal';
        } else if (devVal !== null) {
          newStatus = devVal > 2.0 ? 'error' : 'normal';
        }

        // Track live reading in FIFO rolling history (up to 5 readings) to detect tooling drift across production batch
        const detectedFeatureMatch = (prompt.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i) ||
          cleanText.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i));
        if (detectedFeatureMatch && devVal !== null) {
          const featKey = detectedFeatureMatch[1].toUpperCase();
          setTelemetryHistory((prev) => {
            const currentList = prev[featKey] || [];
            // Keep last 5 readings
            const updated = [...currentList, devVal].slice(-5);
            return { ...prev, [featKey]: updated };
          });
        }

        setDeviationStatus(newStatus);
        setAgentResponse(cleanText);
        setSubStatus(
          newStatus === 'error'
            ? '⚠️ Deviation Exceeded (Repair Required)'
            : '✓ Within Tolerance (Nominal)'
        );

        speakResponse(cleanText, prompt);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setDeviationStatus('error');
        setAgentResponse(`Error connecting to AgentCore: ${msg}`);
        setSubStatus('Connection Error');
      } finally {
        setIsProcessing(false);
      }
    },
    [callAgent, isProcessing, speakResponse]
  );

  // TTS toggle — cancel any active speech when muting
  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  // Hands-free toggle handler
  const toggleContinuousHandsFree = useCallback(() => {
    setContinuousHandsFree((prev) => {
      const next = !prev;
      if (!next && isRecording) {
        isRecordingIntentRef.current = false;
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }
        setIsRecording(false);
      } else if (next && !isRecording && !isProcessing && !isAssistantSpeakingRef.current && !isTextMode) {
        setTimeout(() => startRecording(Boolean(agentResponse)), 100);
      }
      return next;
    });
  }, [isRecording, isProcessing, isTextMode, agentResponse]);

  // Reset state to ask another question without page reload
  const resetQuery = useCallback(() => {
    setAgentResponse(null);
    setDisplayPrompt("I'm listening.");
    setSubStatus(null);
    setDeviationStatus('idle');
    setTextInput('');
    stopBargeInListener();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [stopBargeInListener]);

  // Stop recording and send accumulated speech with acoustic normalization
  const stopAndCommitSpeech = useCallback(() => {
    isRecordingIntentRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    setIsRecording(false);
    const rawCommit = (accumulatedTranscriptRef.current.trim() || latestLiveTranscriptRef.current.trim());
    if (rawCommit) {
      const normalizedCommit = normalizeAcousticSpeech(rawCommit);
      processWorkflow(normalizedCommit);
    } else {
      setDisplayPrompt("I'm listening.");
      setSubStatus(null);
    }
  }, [processWorkflow]);

  // Start speech recognition engine with resilient auto-restart and hands-free awareness
  const startRecording = useCallback((isFollowUp = false) => {
    if (isProcessing) return;
    if (typeof window === 'undefined') return;

    // Do not start recording if assistant is actively speaking
    if (isAssistantSpeakingRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    // Cancel any active speech synthesis so it doesn't transcribe itself
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      isAssistantSpeakingRef.current = false;
    }

    accumulatedTranscriptRef.current = '';
    latestLiveTranscriptRef.current = '';
    isRecordingIntentRef.current = true;
    setIsRecording(true);
    setDisplayPrompt(isFollowUp ? 'Listening for follow-up...' : 'Listening...');
    setSubStatus(isFollowUp ? 'Hands-Free: Listening for follow-up command...' : 'Recording... (speak your command)');
    if (!isFollowUp && !continuousHandsFreeRef.current) {
      setAgentResponse(null);
    }
    setDeviationStatus('listening');

    // Factory to spawn a fresh SpeechRecognition instance on every cycle
    const spawnRecognition = () => {
      if (!isRecordingIntentRef.current || isAssistantSpeakingRef.current) return;

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        // Discard any audio if the assistant somehow started speaking
        if (isAssistantSpeakingRef.current) return;

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            accumulatedTranscriptRef.current += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const rawLiveText = (accumulatedTranscriptRef.current + interim).trim();
        latestLiveTranscriptRef.current = rawLiveText;
        if (rawLiveText) {
          const calibratedLiveText = normalizeAcousticSpeech(rawLiveText);
          setDisplayPrompt(calibratedLiveText);
        }

        // Reset the silence timer: wait 1.8 seconds of quiet before auto-submitting
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (isRecordingIntentRef.current && (accumulatedTranscriptRef.current.trim() || latestLiveTranscriptRef.current.trim())) {
            stopAndCommitSpeech();
          }
        }, 1800);
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isRecordingIntentRef.current = false;
          setIsRecording(false);
          setSubStatus('Microphone access denied');
          setDisplayPrompt('Microphone permission required');
        }
      };

      rec.onend = () => {
        // If user already spoke words and the engine stopped, commit them!
        const spoken = (accumulatedTranscriptRef.current.trim() || latestLiveTranscriptRef.current.trim());
        if (isRecordingIntentRef.current && spoken) {
          stopAndCommitSpeech();
          return;
        }

        // If continuous recording is still active and no words were spoken yet, restart
        if (isRecordingIntentRef.current && !isAssistantSpeakingRef.current) {
          setTimeout(() => {
            if (isRecordingIntentRef.current && !isAssistantSpeakingRef.current) {
              spawnRecognition();
            }
          }, 80);
        } else {
          setIsRecording(false);
        }
      };

      try {
        rec.start();
        recognitionRef.current = rec;
      } catch (e: any) {
        console.warn('Speech recognition spawn warning:', e);
        // If device was still resetting from previous session, retry after short backoff
        if (isRecordingIntentRef.current && !isAssistantSpeakingRef.current) {
          setTimeout(() => {
            if (isRecordingIntentRef.current && !isAssistantSpeakingRef.current) {
              try {
                const retryRec = new SpeechRecognition();
                retryRec.continuous = true;
                retryRec.interimResults = true;
                retryRec.lang = 'en-US';
                retryRec.maxAlternatives = 1;
                retryRec.onresult = rec.onresult;
                retryRec.onerror = rec.onerror;
                retryRec.onend = rec.onend;
                retryRec.start();
                recognitionRef.current = retryRec;
              } catch (err2) {
                console.error('Speech recognition retry failed:', err2);
              }
            }
          }, 300);
        }
      }
    };

    spawnRecognition();
  }, [isProcessing, stopAndCommitSpeech]);

  // Mic toggle handler
  const toggleListening = () => {
    if (isRecording) {
      stopAndCommitSpeech();
    } else {
      startRecording();
    }
  };

  // Switch between voice and text modes
  const handleToggleMode = () => {
    if (isRecording) {
      isRecordingIntentRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
    }

    const nextMode = !isTextMode;
    setIsTextMode(nextMode);

    if (nextMode) {
      setDisplayPrompt('How can I help you?');
      setSubStatus('Type a factory query below');
      setTimeout(() => textInputRef.current?.focus(), 80);
    } else {
      setDisplayPrompt("I'm listening.");
      setSubStatus(null);
    }
  };

  // Form submission for text mode
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (text) {
      setTextInput('');
      processWorkflow(text);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingIntentRef.current = false;
      stopBargeInListener();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopBargeInListener]);

  return (
    <div className="text-brand-900 font-sans min-h-screen w-full flex flex-col items-center relative selection:bg-brand-300 selection:text-white bg-brand-50 overflow-x-hidden">
      {/* Dynamic Background Tint on Tolerance Status */}
      <div
        className={`fixed inset-0 pointer-events-none transition-colors duration-1000 z-0 ${
          deviationStatus === 'error'
            ? 'bg-red-500/10'
            : deviationStatus === 'normal'
            ? 'bg-emerald-500/10'
            : 'bg-transparent'
        }`}
      />

      {/* Background Artistic Blobs from assistant_interface.html */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-brand-200 mix-blend-multiply filter blur-3xl animate-blob" />
        <div
          className="absolute top-[20%] right-[-15%] w-[45vw] h-[45vw] rounded-full bg-brand-300 mix-blend-multiply filter blur-3xl animate-blob"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute bottom-[-20%] left-[10%] w-[60vw] h-[60vw] rounded-full bg-brand-100 mix-blend-multiply filter blur-3xl animate-blob"
          style={{ animationDelay: '4s' }}
        />
      </div>

      {/* Top Header Badge */}
      <header className="sticky top-0 left-0 right-0 w-full backdrop-blur-md bg-white/40 border-b border-brand-200/40 px-6 py-4 flex items-center justify-between z-30 transition-all">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-brand-900 leading-none">
              EchoForge OS
            </h2>
            <p className="text-[11px] font-medium tracking-wider uppercase text-brand-400 mt-0.5">
              AWS Bedrock AgentCore · Live Factory Edge
            </p>
          </div>
        </div>

        {/* Header Controls: Hands-Free toggle, TTS toggle, Status Pill */}
        <div className="flex items-center gap-2">
          {/* Hands-Free Loop Toggle */}
          <button
            type="button"
            onClick={toggleContinuousHandsFree}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
              continuousHandsFree
                ? 'bg-brand-500 text-white border-brand-500 shadow-brand-500/30'
                : 'bg-white/70 backdrop-blur-md border-brand-200 text-brand-700 hover:bg-white'
            }`}
            title={continuousHandsFree ? 'Disable continuous hands-free listening' : 'Enable continuous hands-free listening'}
          >
            {continuousHandsFree ? (
              <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
            ) : (
              <Ear className="w-3.5 h-3.5 text-brand-500" />
            )}
            <span>
              Hands-Free: <strong className="uppercase">{continuousHandsFree ? 'ON' : 'OFF'}</strong>
            </span>
          </button>

          <button
            type="button"
            onClick={toggleTts}
            className="px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-brand-200 text-brand-700 text-xs font-medium hover:bg-white transition-all flex items-center gap-1.5 shadow-sm"
            title={ttsEnabled ? 'Mute voice response' : 'Enable voice response'}
          >
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{ttsEnabled ? 'Voice On' : 'Muted'}</span>
          </button>

          <div className="px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-brand-200 text-xs font-medium text-brand-700 flex items-center gap-2 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  deviationStatus === 'error'
                    ? 'bg-red-400'
                    : deviationStatus === 'normal'
                    ? 'bg-emerald-400'
                    : isRecording
                    ? 'bg-brand-500'
                    : 'bg-brand-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  deviationStatus === 'error'
                    ? 'bg-red-500'
                    : deviationStatus === 'normal'
                    ? 'bg-emerald-500'
                    : isRecording
                    ? 'bg-brand-500'
                    : 'bg-brand-400'
                }`}
              />
            </span>
            <span className="capitalize">
              {isProcessing
                ? 'Analyzing...'
                : isRecording
                ? 'Listening'
                : deviationStatus === 'error'
                ? 'Out of Tolerance'
                : deviationStatus === 'normal'
                ? 'In Tolerance'
                : 'Ready'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="z-10 w-full max-w-3xl px-6 py-8 flex flex-col items-center justify-center flex-1 relative text-center">
        {/* Text Display / Transcript Area */}
        <div className="min-h-[100px] mb-6 flex flex-col justify-end items-center w-full px-4">
          <h1
            id="transcript-display"
            className={`text-3xl sm:text-4xl md:text-5xl font-light text-brand-800 leading-tight transition-all duration-300 max-w-2xl ${
              isRecording ? 'opacity-80 scale-102' : 'opacity-100 scale-100'
            }`}
          >
            {displayPrompt}
          </h1>

          {/* Subtitle / Live Status */}
          <p
            id="transcript-status"
            className={`mt-4 text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all duration-300 ${
              subStatus ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            } ${
              deviationStatus === 'error'
                ? 'text-red-600'
                : deviationStatus === 'normal'
                ? 'text-emerald-600'
                : 'text-brand-400'
            }`}
          >
            {subStatus || 'Ready'}
          </p>
        </div>

        {/* Aerospace Tolerance Deviation Gauge (Hero Visual Component for GitHub Issue #14) */}
        {agentResponse && (() => {
          const telemetry = extractMetrologyTelemetry(agentResponse, displayPrompt);
          return telemetry ? <ToleranceDeviationGauge telemetry={telemetry} /> : null;
        })()}

        {/* Agent Response Card (persists across continuous hands-free follow-up queries) */}
        {agentResponse && (
          <div
            className={`mb-6 max-w-2xl w-full rounded-3xl backdrop-blur-xl border shadow-xl flex flex-col text-left transition-all duration-500 animate-fadeIn ${
              deviationStatus === 'error'
                ? 'bg-red-50/95 border-red-200/80 text-red-950 shadow-red-500/10'
                : 'bg-white/90 border-brand-200/80 text-brand-950 shadow-brand-500/10'
            }`}
          >
            {/* Header inside response card */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-brand-200/50 bg-white/40 rounded-t-3xl backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-2">
                {deviationStatus === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                  AgentCore Intelligence
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => speakResponse(agentResponse)}
                  className="p-1 px-2.5 rounded-full hover:bg-brand-100 text-brand-600 transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
                  title="Replay Voice Response"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Replay</span>
                </button>
                <button
                  type="button"
                  onClick={resetQuery}
                  className="p-1 px-2.5 rounded-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-700 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  title="Ask Another Question"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ask Again</span>
                </button>
              </div>
            </div>

            {/* Scrollable Response Body */}
            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3 prose prose-sm max-w-none text-brand-950 leading-relaxed text-left">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2.5 last:mb-0 text-sm leading-relaxed">{children}</p>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-brand-950 bg-brand-100/40 px-1 py-0.5 rounded">
                      {children}
                    </strong>
                  ),
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-sm">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-sm">{children}</ol>,
                  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                  code: ({ children, className }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = Boolean(className?.includes('language-') || String(children).includes('\n'));
                    if (isBlock) {
                      return <CodeBlock code={String(children).replace(/\n$/, '')} language={match ? match[1] : undefined} />;
                    }
                    return (
                      <code className="bg-brand-100/70 text-brand-900 border border-brand-200/60 rounded px-1.5 py-0.5 text-xs font-mono font-medium">
                        {children}
                      </code>
                    );
                  },
                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2.5 text-brand-950 border-b border-brand-200 pb-1">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-brand-900">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 text-brand-800">{children}</h3>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-brand-500 bg-brand-50/60 p-2.5 rounded-r-lg italic text-brand-800 my-2 text-sm">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 border border-brand-200 rounded-xl">
                      <table className="min-w-full divide-y divide-brand-200 text-xs text-left">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 bg-brand-100/50 font-semibold text-brand-900 uppercase tracking-wider text-[11px]">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 border-t border-brand-100 text-brand-800 font-mono text-xs">
                      {children}
                    </td>
                  ),
                  hr: () => <hr className="border-brand-200 my-3.5" />,
                }}
              >
                {agentResponse}
              </ReactMarkdown>

              {/* Statistical Process Control (SPC) Machine Tooling Drift & Sparkline Widget */}
              <SpcDriftWidget
                agentResponse={agentResponse}
                telemetryHistory={telemetryHistory}
              />

              {/* Dynamic 1-click Repair Procedure Button for ANY recognized part */}
              {/would you like.*repair procedure|retrieve the cnc repair procedure\?/i.test(agentResponse) && (
                <button
                  type="button"
                  onClick={() => {
                    const match = agentResponse.match(/(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)/i);
                    const part = match ? match[1].toUpperCase() : 'the part';
                    processWorkflow(`Yes, retrieve the CNC repair procedure for ${part}.`);
                  }}
                  disabled={isProcessing}
                  className="w-full mt-3 py-3 px-4 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Wrench className="w-4 h-4" />
                  <span>🔧 Retrieve CNC Repair Procedure</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 5-Part Quick Metrology Selector Chips */}
        {!isProcessing && (
          <InspectionChips
            onSelectFeature={(featureId) =>
              processWorkflow(
                `Query the live sensor deviation for ${featureId} and evaluate if it is within or out of tolerance.`
              )
            }
            disabled={isProcessing}
          />
        )}

        {/* Quick Actions after response */}
        {agentResponse && !isProcessing && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6 animate-fadeIn">
            <button
              type="button"
              onClick={resetQuery}
              className="px-4 py-2 rounded-full bg-white/90 hover:bg-white border border-brand-200 text-brand-700 text-xs sm:text-sm font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand-500" />
              <span>Ask Another Question</span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetQuery();
                setIsTextMode(true);
                setTimeout(() => textInputRef.current?.focus(), 50);
              }}
              className="px-4 py-2 rounded-full bg-white/90 hover:bg-white border border-brand-200 text-brand-700 text-xs sm:text-sm font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Keyboard className="w-3.5 h-3.5 text-brand-500" />
              <span>Type a Question</span>
            </button>
          </div>
        )}

        {/* Interactive Core: Voice vs Text */}
        <div className="relative w-full flex justify-center items-center mt-2">
          {/* Voice View */}
          {!isTextMode ? (
            <div className="view-transition flex flex-col items-center justify-center">
              <button
                type="button"
                id="mic-btn"
                onClick={toggleListening}
                disabled={isProcessing}
                className={`group relative rounded-full bg-brand-500 hover:bg-brand-400 text-white flex items-center justify-center shadow-[0_20px_50px_-12px_rgba(255,107,0,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  agentResponse ? 'w-20 h-20 md:w-24 md:h-24' : 'w-32 h-32 md:w-40 md:h-40 animate-float'
                } ${isRecording ? 'recording-active' : ''}`}
                aria-label={isRecording ? 'Stop listening' : 'Start listening'}
              >
                {isRecording ? (
                  <AudioWaveform className={`${agentResponse ? 'w-10 h-10' : 'w-16 h-16 md:w-20 md:h-20'} drop-shadow-md transition-transform duration-300 animate-pulse`} />
                ) : (
                  <Mic className={`${agentResponse ? 'w-9 h-9' : 'w-14 h-14 md:w-16 md:h-16'} drop-shadow-md transition-transform duration-300 group-hover:scale-110`} />
                )}
              </button>

              <p className="text-xs font-medium text-brand-400 mt-3 tracking-wide uppercase">
                {isRecording ? 'Tap to submit early' : agentResponse ? 'Tap mic to ask with voice' : 'Tap to speak'}
              </p>
            </div>
          ) : (
            /* Text Input View */
            <div className="view-transition w-full max-w-lg">
              <form onSubmit={handleTextSubmit} className="relative w-full animate-fadeIn">
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="e.g. Check UPPER_FLANGE deviation and repair procedure"
                  disabled={isProcessing}
                  className="w-full bg-white/90 backdrop-blur-md border border-brand-200 text-brand-900 text-base sm:text-lg px-8 py-5 pr-16 rounded-full shadow-[0_10px_30px_-10px_rgba(255,107,0,0.15)] transition-all duration-300 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Floating Mode Toggle (Voice <-> Keyboard) */}
      <div className="fixed bottom-8 right-8 md:bottom-12 md:right-12 z-20">
        <button
          type="button"
          onClick={handleToggleMode}
          className="w-14 h-14 bg-white/70 backdrop-blur-md border border-brand-200 text-brand-500 hover:text-brand-700 hover:bg-white rounded-full flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(255,107,0,0.2)] transition-all duration-300 hover:-translate-y-1 group"
          aria-label="Toggle Input Mode"
          title={isTextMode ? 'Switch to Voice Input' : 'Switch to Keyboard Input'}
        >
          {isTextMode ? (
            <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
          ) : (
            <Keyboard className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          )}
        </button>
      </div>
    </div>
  );
}

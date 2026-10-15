'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

type StatusType = 'idle' | 'listening' | 'processing' | 'normal' | 'error';

// Strip <thinking>...</thinking> blocks that Nova Pro sometimes emits
const stripThinking = (text: string) =>
  text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

// Parse deviation value from a text string
const parseDeviation = (text: string): number | null => {
  const m = text.match(/(\d+(?:\.\d+)?)\s*micron/i);
  return m ? parseFloat(m[1]) : null;
};

export default function VoiceAssistantPage() {
  // Mode states
  const [isTextMode, setIsTextMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Content states
  const [displayPrompt, setDisplayPrompt] = useState("I'm listening.");
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [deviationStatus, setDeviationStatus] = useState<StatusType>('idle');
  const [textInput, setTextInput] = useState('');
  const [sessionId, setSessionId] = useState<string>('');

  // Voice engine refs
  const recognitionRef = useRef<any>(null);
  const isRecordingIntentRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

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

  // Speak agent response aloud
  const speakResponse = useCallback(
    (text: string) => {
      if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    },
    [ttsEnabled]
  );

  // Workflow processing
  const processWorkflow = useCallback(
    async (userPrompt: string) => {
      const prompt = userPrompt.trim();
      if (!prompt || isProcessing) return;

      setIsProcessing(true);
      setSubStatus('Interrogating factory sensors via AWS AgentCore...');
      setDisplayPrompt(`"${prompt}"`);

      try {
        const data = await callAgent(prompt);
        const cleanText = stripThinking(data.text);

        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        // Determine status
        const devVal = parseDeviation(cleanText);
        let newStatus: StatusType = 'normal';
        if (devVal !== null) {
          newStatus = devVal > 2.0 ? 'error' : 'normal';
        } else if (/out of tolerance|repair procedure|re-milling|recalibrate/i.test(cleanText)) {
          newStatus = 'error';
        }

        setDeviationStatus(newStatus);
        setAgentResponse(cleanText);
        setSubStatus(
          newStatus === 'error'
            ? '⚠️ Deviation Exceeded (Repair Required)'
            : '✓ Within Tolerance (Nominal)'
        );

        speakResponse(cleanText);
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

  // Stop recording and send accumulated speech
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
    const finalCommit = accumulatedTranscriptRef.current.trim();
    if (finalCommit) {
      processWorkflow(finalCommit);
    } else {
      setDisplayPrompt("I'm listening.");
      setSubStatus(null);
    }
  }, [processWorkflow]);

  // Start speech recognition engine with resilient auto-restart
  const startRecording = useCallback(() => {
    if (isProcessing) return;
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    // Cancel any active speech synthesis so it doesn't transcribe itself
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    accumulatedTranscriptRef.current = '';
    isRecordingIntentRef.current = true;
    setIsRecording(true);
    setDisplayPrompt('Listening...');
    setSubStatus('Recording... (speak your command)');
    setAgentResponse(null);
    setDeviationStatus('listening');

    // Create a new instance
    const rec = new SpeechRecognition();
    rec.continuous = false; // Chrome handles single utterances much more reliably
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          accumulatedTranscriptRef.current += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const liveText = (accumulatedTranscriptRef.current + interim).trim();
      if (liveText) {
        setDisplayPrompt(liveText);
      }

      // Reset the silence timer: wait 2.5 seconds of quiet before auto-submitting
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        if (isRecordingIntentRef.current && (accumulatedTranscriptRef.current + interim).trim()) {
          stopAndCommitSpeech();
        }
      }, 2500);
    };

    rec.onerror = (event: any) => {
      // 'no-speech' is triggered when Chrome detects silence
      if (event.error === 'no-speech') {
        // If the user hasn't said anything yet or is still thinking, keep listening if intent is active
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
      // Chrome automatically triggers onend after pauses.
      // If the user hasn't explicitly clicked stop and hasn't timed out, immediately resume listening!
      if (isRecordingIntentRef.current && !isProcessing) {
        try {
          rec.start();
        } catch {
          // If restart fails, create fresh instance
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setIsRecording(false);
    }
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
  }, []);

  return (
    <div className="text-brand-900 font-sans h-screen w-screen flex flex-col items-center justify-center relative selection:bg-brand-300 selection:text-white bg-brand-50 overflow-hidden">
      {/* Dynamic Background Tint on Tolerance Status */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-1000 z-0 ${
          deviationStatus === 'error'
            ? 'bg-red-500/10'
            : deviationStatus === 'normal'
            ? 'bg-emerald-500/10'
            : 'bg-transparent'
        }`}
      />

      {/* Background Artistic Blobs from assistant_interface.html */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 z-0">
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
      <header className="absolute top-6 left-6 right-6 flex items-center justify-between z-20">
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

        {/* Status pill & TTS toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTtsEnabled(!ttsEnabled)}
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
      <main className="z-10 w-full max-w-3xl px-6 flex flex-col items-center justify-center h-full relative text-center">
        {/* Text Display / Transcript Area */}
        <div className="min-h-[140px] mb-8 flex flex-col justify-end items-center w-full px-4">
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

        {/* Agent Response Card (if returned) */}
        {agentResponse && !isRecording && (
          <div
            className={`mb-8 max-w-xl w-full p-5 rounded-3xl backdrop-blur-xl border shadow-xl text-left transition-all duration-500 animate-fadeIn ${
              deviationStatus === 'error'
                ? 'bg-red-50/90 border-red-200 text-red-950 shadow-red-500/10'
                : 'bg-white/80 border-brand-200 text-brand-950 shadow-brand-500/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {deviationStatus === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                AgentCore Intelligence
              </span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-brand-900 font-normal">
              {agentResponse}
            </p>
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
                className={`group relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-brand-500 hover:bg-brand-400 text-white flex items-center justify-center shadow-[0_20px_50px_-12px_rgba(255,107,0,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRecording ? 'recording-active' : 'animate-float'
                }`}
                aria-label={isRecording ? 'Stop listening' : 'Start listening'}
              >
                {isRecording ? (
                  <AudioWaveform className="w-16 h-16 md:w-20 md:h-20 drop-shadow-md transition-transform duration-300 animate-pulse" />
                ) : (
                  <Mic className="w-14 h-14 md:w-16 md:h-16 drop-shadow-md transition-transform duration-300 group-hover:scale-110" />
                )}
              </button>

              <p className="text-xs font-medium text-brand-400 mt-4 tracking-wide uppercase">
                {isRecording ? 'Tap to submit early' : 'Tap to speak'}
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
      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12 z-20">
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

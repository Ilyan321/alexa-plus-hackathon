'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MicrophoneIcon,
  StopIcon,
  PaperAirplaneIcon,
  CpuChipIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';

type Agent = 'user' | 'system' | 'engineering';
type StatusType = 'normal' | 'error' | 'idle';

interface Message {
  role: string;
  content: string;
  agent: Agent;
  type?: StatusType;
}

// Strip <thinking>...</thinking> blocks that Nova Pro sometimes emits
const stripThinking = (text: string) =>
  text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

// Parse deviation value from a text string
const parseDeviation = (text: string): number | null => {
  const m = text.match(/(\d+(?:\.\d+)?)\s*micron/i);
  return m ? parseFloat(m[1]) : null;
};

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [deviationStatus, setDeviationStatus] = useState<StatusType>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, transcript]);

  const callAgent = useCallback(async (prompt: string): Promise<{ text: string; sessionId: string }> => {
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
  }, [sessionId]);

  const processWorkflow = useCallback(async (userPrompt: string) => {
    if (!userPrompt.trim() || isProcessing) return;

    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'You', content: userPrompt, agent: 'user' }]);
    setDeviationStatus('idle');

    // Add a "thinking" placeholder from the system agent
    setMessages(prev => [
      ...prev,
      { role: 'EchoForge OS', content: 'Querying factory sensors via AWS AgentCore...', agent: 'system', type: 'idle' },
    ]);

    try {
      // Single call — Bedrock AgentCore orchestrates queryDeviation + getRepairProcedure autonomously
      const data = await callAgent(userPrompt);
      const cleanText = stripThinking(data.text);

      // Persist session for multi-turn continuity
      if (data.sessionId) setSessionId(data.sessionId);

      // Derive status from the response content
      const deviation = parseDeviation(cleanText);
      let newStatus: StatusType = 'idle';
      if (deviation !== null) {
        newStatus = deviation > 2.0 ? 'error' : 'normal';
      } else if (/no repair|within tolerance|acceptable/i.test(cleanText)) {
        newStatus = 'normal';
      } else if (/out of tolerance|repair procedure|re-milling|recalibrate/i.test(cleanText)) {
        newStatus = 'error';
      }
      setDeviationStatus(newStatus);

      // Replace the placeholder with the real response
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'EchoForge OS',
          content: cleanText,
          agent: newStatus === 'error' ? 'engineering' : 'system',
          type: newStatus,
        };
        return updated;
      });

      // Speak the response aloud
      if ('speechSynthesis' in window && cleanText) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'System Error',
          content: `Failed to reach AgentCore: ${msg}`,
          agent: 'engineering',
          type: 'error',
        };
        return updated;
      });
      setDeviationStatus('error');
    }

    setIsProcessing(false);
  }, [callAgent, isProcessing]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggleListen = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    if (isProcessing) return;

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      // continuous:false = natural sentence-based capture (stops when user pauses)
      // interimResults:true = show live transcription while speaking
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      finalTranscriptRef.current = '';

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscriptRef.current += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }
        setTranscript(finalTranscriptRef.current + interim);
      };

      recognition.onerror = (e: any) => {
        // 'no-speech' is benign — user just didn't speak
        if (e.error !== 'no-speech') {
          console.error('[Speech]', e.error);
        }
        setIsListening(false);
        setTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        const finalText = finalTranscriptRef.current.trim();
        setTranscript('');
        if (finalText) {
          processWorkflow(finalText);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('[Speech init]', e);
      setIsListening(false);
    }
  }, [isListening, isProcessing, stopListening, processWorkflow]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (text) {
      setTextInput('');
      processWorkflow(text);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden relative">

      {/* Background gradient — shifts color based on deviation status */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-[#050505] to-[#050505] opacity-60" />
        <div
          className={`absolute inset-0 transition-colors duration-1000 ${
            deviationStatus === 'error'
              ? 'bg-red-900/20'
              : deviationStatus === 'normal'
              ? 'bg-emerald-900/10'
              : 'bg-transparent'
          }`}
        />
      </div>

      {/* Main panel */}
      <div className="relative z-10 flex flex-col w-full max-w-4xl h-[92vh] mx-auto my-auto bg-black/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 py-5 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
              EchoForge OS
            </h1>
            <p className="text-white/40 text-xs mt-0.5 uppercase tracking-widest font-medium">
              AWS AgentCore · Nova Pro · Live Factory Data
            </p>
          </div>
          <div className="flex gap-3 items-center bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Status</span>
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  deviationStatus === 'error'
                    ? 'bg-red-400'
                    : deviationStatus === 'normal'
                    ? 'bg-emerald-400'
                    : 'bg-blue-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  deviationStatus === 'error'
                    ? 'bg-red-500'
                    : deviationStatus === 'normal'
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`}
              />
            </span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth">
          {messages.length === 0 && !transcript && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-5 text-white/20">
              <CpuChipIcon className="w-20 h-20" />
              <p className="text-lg font-light leading-relaxed">
                Awaiting operator command.
                <br />
                Tap the mic or type to interrogate factory sensors.
              </p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex flex-col ${msg.agent === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`flex items-center gap-1.5 text-xs uppercase tracking-widest mb-1.5 font-semibold ${
                    msg.agent === 'user'
                      ? 'text-blue-400'
                      : msg.type === 'error'
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {msg.agent === 'system' && <CheckCircleIcon className="w-3.5 h-3.5" />}
                  {msg.agent === 'engineering' && <WrenchScrewdriverIcon className="w-3.5 h-3.5" />}
                  {msg.role}
                </div>
                <div
                  className={`p-4 rounded-2xl max-w-[88%] text-sm leading-relaxed shadow-lg border whitespace-pre-wrap ${
                    msg.agent === 'user'
                      ? 'bg-blue-600/20 border-blue-500/30 text-blue-50 rounded-br-sm'
                      : msg.type === 'error'
                      ? 'bg-red-900/30 border-red-500/40 text-red-100 rounded-bl-sm'
                      : msg.type === 'normal'
                      ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-100 rounded-bl-sm'
                      : 'bg-white/5 border-white/10 text-white/70 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {/* Live transcription indicator */}
            {(isListening || transcript) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-end"
              >
                <div className="text-xs uppercase tracking-widest mb-1.5 font-semibold text-blue-400">
                  You (Speaking…)
                </div>
                <div className="p-4 rounded-2xl max-w-[88%] text-sm bg-blue-600/20 border border-blue-500/40 text-blue-100 rounded-br-sm shadow-[0_0_20px_rgba(59,130,246,0.25)]">
                  {transcript || (
                    <div className="flex gap-1 items-center h-5">
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [4, 16, 4] }}
                          transition={{ repeat: Infinity, duration: 0.9, delay }}
                          className="w-1 bg-blue-400 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Processing spinner */}
            {isProcessing && !isListening && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2.5 items-center text-white/40 text-xs p-1"
              >
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                AgentCore processing…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input bar */}
        <div className="p-5 border-t border-white/10 bg-black/50 backdrop-blur-md shrink-0">
          <form onSubmit={handleManualSubmit} className="flex gap-3 items-center">
            {/* Mic button */}
            <div className="relative shrink-0">
              {isListening && (
                <motion.div
                  animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0.1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 bg-red-500 rounded-full"
                />
              )}
              <button
                type="button"
                onClick={toggleListen}
                disabled={isProcessing}
                title={isListening ? 'Stop listening' : 'Start voice input'}
                className={`relative z-10 p-3.5 rounded-full transition-all duration-200 ${
                  isListening
                    ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                    : 'bg-white/10 hover:bg-white/20 text-white/60 hover:text-white'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isListening ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
              </button>
            </div>

            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={
                isListening
                  ? 'Listening… speak your command'
                  : isProcessing
                  ? 'Processing…'
                  : 'e.g. What is the status of the UPPER_FLANGE?'
              }
              disabled={isListening || isProcessing}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all disabled:opacity-40"
            />

            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="shrink-0 p-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 text-white disabled:text-white/20 rounded-full transition-all"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Critical deviation alert banner */}
      <AnimatePresence>
        {deviationStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-red-950/90 backdrop-blur-xl border border-red-500/50 px-7 py-3.5 rounded-full shadow-[0_0_40px_rgba(239,68,68,0.35)] flex items-center gap-3"
          >
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-red-100 font-semibold tracking-wider uppercase text-sm">
              Critical Deviation — Repair Required
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

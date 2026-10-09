'use client';
import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { MicrophoneIcon, StopIcon, PaperAirplaneIcon, CpuChipIcon, WrenchScrewdriverIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const Scene = dynamic(() => import('@/components/Scene'), { ssr: false });

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<{role: string, content: string, agent: 'user' | 'metrology' | 'engineering', type?: 'normal' | 'error' | 'idle'}[]>([]);
  const [deviationStatus, setDeviationStatus] = useState<'normal' | 'error' | 'idle'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, transcript]);

  const stripThinking = (text: string) => text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

  const callAgent = async (prompt: string, currentSession: string = '') => {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, sessionId: currentSession })
    });
    return await res.json();
  };

  const processWorkflow = async (userPrompt: string) => {
    if (!userPrompt.trim()) return;
    
    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'You', content: userPrompt, agent: 'user' }]);
    setDeviationStatus('idle');
    
    try {
      setMessages(prev => [...prev, { role: 'Metrology Agent', content: 'Analyzing live factory sensors...', agent: 'metrology', type: 'idle' }]);
      
      const railsPrompt = `${userPrompt}\n\nTask: Check the factory deviation for UPPER_FLANGE. Reply with only the number in microns.`;
      const data = await callAgent(railsPrompt);
      
      if (data.text) {
        const cleanResponse = stripThinking(data.text);
        const deviationValue = parseFloat(cleanResponse.match(/[\d\.]+/)?.[0] || '0');
        const isError = deviationValue > 2.0;
        
        setMessages(prev => {
          const newMsg = [...prev];
          newMsg[newMsg.length - 1] = { 
            role: 'Metrology Agent', 
            content: `Live deviation detected: ${cleanResponse} microns.`, 
            agent: 'metrology',
            type: isError ? 'error' : 'normal'
          };
          return newMsg;
        });
        
        if (isError) {
          setDeviationStatus('error');
          setMessages(prev => [...prev, { role: 'Engineering Agent', content: 'Deviation exceeds 2.0μm tolerance. Formulating CNC repair procedure...', agent: 'engineering', type: 'error' }]);
          
          const repairData = await callAgent("The deviation exceeds the 2.0 micron tolerance. What is the recommended repair procedure?", data.sessionId);
          
          setMessages(prev => {
            const newMsg = [...prev];
            newMsg[newMsg.length - 1] = { 
              role: 'Engineering Agent', 
              content: stripThinking(repairData.text), 
              agent: 'engineering',
              type: 'error'
            };
            return newMsg;
          });
        } else {
          setDeviationStatus('normal');
          setMessages(prev => [...prev, { role: 'Engineering Agent', content: 'Tolerance is acceptable. No repair actions required.', agent: 'engineering', type: 'normal' }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'System', content: "Error: " + data.details, agent: 'engineering', type: 'error' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'System', content: "Failed to connect to AWS AgentCore backend.", agent: 'engineering', type: 'error' }]);
    }
    setIsProcessing(false);
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice recognition is not supported in this browser. Please use the text input instead.");
      return;
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      let finalTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript + interim);
      };

      recognition.onerror = (e: any) => {
        console.error("Speech error", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (finalTranscript.trim()) {
          processWorkflow(finalTranscript.trim());
          setTranscript('');
        }
      };
      
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      processWorkflow(textInput.trim());
      setTextInput('');
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Scene status={deviationStatus} />
      </div>

      {/* Main Glass UI Overlay */}
      <div className="relative z-10 flex flex-col w-[450px] h-[90vh] my-auto ml-8 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">EchoForge OS</h1>
            <p className="text-white/50 text-xs mt-1 uppercase tracking-wider">Multi-Agent Diagnostics</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${deviationStatus === 'error' ? 'bg-red-400' : deviationStatus === 'normal' ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${deviationStatus === 'error' ? 'bg-red-500' : deviationStatus === 'normal' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
            </span>
          </div>
        </div>

        {/* Chat / Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {messages.length === 0 && !transcript && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-white/30">
              <CpuChipIcon className="w-16 h-16" />
              <p>Awaiting diagnostic command.<br/>Tap the mic or type to begin.</p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex flex-col ${msg.agent === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex items-center gap-2 text-[10px] uppercase tracking-widest mb-1.5 font-semibold ${
                  msg.agent === 'user' ? 'text-blue-400' : 
                  msg.agent === 'metrology' ? 'text-emerald-400' : 'text-orange-400'
                }`}>
                  {msg.agent === 'metrology' && <CheckCircleIcon className="w-3 h-3" />}
                  {msg.agent === 'engineering' && <WrenchScrewdriverIcon className="w-3 h-3" />}
                  {msg.role}
                </div>
                
                <div className={`p-4 rounded-2xl max-w-[90%] shadow-lg border ${
                  msg.agent === 'user' ? 'bg-blue-600/20 border-blue-500/30 text-blue-50 rounded-br-none' : 
                  msg.type === 'error' ? 'bg-red-900/30 border-red-500/50 text-red-100 rounded-bl-none' :
                  msg.type === 'normal' ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-100 rounded-bl-none' :
                  'bg-white/5 border-white/10 text-white/80 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {/* Active Listening Indicator */}
            {(isListening || transcript) && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-end"
              >
                <div className="text-[10px] uppercase tracking-widest mb-1.5 font-semibold text-blue-400">You (Speaking...)</div>
                <div className="p-4 rounded-2xl max-w-[90%] bg-blue-600/20 border border-blue-500/50 text-blue-100 rounded-br-none shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  {transcript || (
                    <div className="flex gap-1 items-center h-5">
                      <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 bg-blue-400 rounded-full"></motion.div>
                      <motion.div animate={{ height: [4, 16, 4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 bg-blue-400 rounded-full"></motion.div>
                      <motion.div animate={{ height: [4, 8, 4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 bg-blue-400 rounded-full"></motion.div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Processing Indicator */}
            {isProcessing && !isListening && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center text-white/50 text-sm p-2">
                 <div className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
                 Processing Agents...
               </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-md">
          <form onSubmit={handleManualSubmit} className="flex gap-2 items-center">
            
            {/* Animated Mic Button */}
            <div className="relative">
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1.5 }}
                  transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
                  className="absolute inset-0 bg-red-500/40 rounded-full z-0 blur-md"
                />
              )}
              <button
                type="button"
                onClick={toggleListen}
                disabled={isProcessing}
                className={`relative z-10 p-3 rounded-full transition-all duration-300 ${
                  isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]' 
                  : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                } disabled:opacity-50`}
              >
                {isListening ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
              </button>
            </div>

            <input 
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type command..."}
              disabled={isListening || isProcessing}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
            />
            
            <button 
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 text-white disabled:text-white/30 rounded-full transition-all"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>

      {/* Floating Status Widgets */}
      <AnimatePresence>
        {deviationStatus === 'error' && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute top-8 right-8 z-20 bg-red-900/80 backdrop-blur-xl border border-red-500/50 p-6 rounded-3xl shadow-[0_0_40px_rgba(239,68,68,0.3)] max-w-sm"
          >
            <div className="flex gap-4 items-start">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-400 shrink-0" />
              <div>
                <h3 className="text-red-100 font-bold text-lg">CRITICAL TOLERANCE</h3>
                <p className="text-red-200/70 text-sm mt-1">Automated milling required on UPPER_FLANGE. Factory floor bots have been notified.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

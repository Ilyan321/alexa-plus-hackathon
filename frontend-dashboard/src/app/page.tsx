'use client';
import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';

// We dynamically import the 3D scene to avoid SSR issues with Three.js
const Scene = dynamic(() => import('@/components/Scene'), { ssr: false });

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [deviationStatus, setDeviationStatus] = useState<'normal' | 'error' | 'idle'>('idle');
  const [repairProcedure, setRepairProcedure] = useState('');
  const [sessionId, setSessionId] = useState('');

  const callAgent = async (prompt: string, currentSession: string = '') => {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, sessionId: currentSession })
    });
    return await res.json();
  };

  const handleMicClick = async () => {
    setIsListening(!isListening);
    if (!isListening) {
      setTranscript("Checking UPPER_FLANGE deviation...");
      setAgentResponse("Metrology Agent is analyzing live factory sensors...");
      setRepairProcedure('');
      setDeviationStatus('idle');
      
      try {
        const data = await callAgent("What is the factory deviation for UPPER_FLANGE? Reply with only the number in microns.");
        
        if (data.text) {
          setAgentResponse(`Live deviation: ${data.text}`);
          setSessionId(data.sessionId);
          
          const deviationValue = parseFloat(data.text.match(/[\d\.]+/)?.[0] || '0');
          if (deviationValue > 2.0) {
            setDeviationStatus('error');
            setRepairProcedure("Engineering Agent is formulating repair procedure...");
            
            // Second agent call for multi-agent workflow
            const repairData = await callAgent("The deviation exceeds the 2.0 micron tolerance. What is the recommended repair procedure?", data.sessionId);
            setRepairProcedure(repairData.text);
          } else {
            setDeviationStatus('normal');
            setRepairProcedure("Tolerance acceptable. No repair needed.");
          }
        } else {
          setAgentResponse("Error: " + data.details);
        }
      } catch (e) {
        setAgentResponse("Failed to connect to backend.");
      }
      setIsListening(false);
    } else {
      setDeviationStatus('idle');
    }
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-white font-sans overflow-hidden">
      {/* Left Sidebar: Controls & Transcript */}
      <div className="w-1/3 flex flex-col p-6 border-r border-neutral-700 bg-neutral-800 shadow-2xl z-10 overflow-y-auto">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">EchoForge Multi-Agent</h1>
        <p className="text-neutral-400 mb-8 text-sm">Industrial Metrology & Repair Orchestrator</p>

        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-700">
            <h3 className="text-xs text-neutral-500 uppercase font-semibold mb-2 tracking-wider">User Input</h3>
            <p className="text-neutral-200">{transcript || "Waiting for voice..."}</p>
          </div>

          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-700">
            <h3 className="text-xs text-blue-400 uppercase font-semibold mb-2 tracking-wider">Metrology Agent</h3>
            <p className="text-emerald-400">{agentResponse}</p>
          </div>
          
          {repairProcedure && (
            <div className={`p-4 rounded-xl border ${deviationStatus === 'error' ? 'bg-red-900/20 border-red-900/50' : 'bg-neutral-900 border-neutral-700'}`}>
              <h3 className={`text-xs uppercase font-semibold mb-2 tracking-wider ${deviationStatus === 'error' ? 'text-red-400' : 'text-neutral-500'}`}>Engineering Agent</h3>
              <p className={deviationStatus === 'error' ? 'text-red-200 text-sm leading-relaxed' : 'text-neutral-400'}>{repairProcedure}</p>
            </div>
          )}
        </div>

        <button 
          onClick={handleMicClick}
          className={`mt-6 w-full py-4 rounded-full font-bold transition-all ${
            isListening 
            ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
            : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isListening ? 'Stop Listening' : 'Run Diagnostics'}
        </button>
      </div>

      {/* Right Area: 3D Visualization */}
      <div className="flex-1 relative bg-black">
        <div className="absolute top-6 right-6 z-10 flex gap-4">
          <div className={`px-4 py-2 rounded-full text-sm font-semibold border ${
            deviationStatus === 'error' ? 'bg-red-900/50 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 
            deviationStatus === 'normal' ? 'bg-emerald-900/50 border-emerald-500 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 
            'bg-neutral-800 border-neutral-600 text-neutral-400'
          }`}>
            Part Status: {deviationStatus.toUpperCase()}
          </div>
        </div>
        
        {/* React Three Fiber Canvas */}
        <div className="w-full h-full">
          <Scene status={deviationStatus} />
        </div>
      </div>
    </div>
  );
}

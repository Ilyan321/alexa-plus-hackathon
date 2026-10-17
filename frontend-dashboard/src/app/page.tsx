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
  Copy,
  Check,
  Radio,
  Ear,
  Headphones,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Gauge,
  Target,
} from 'lucide-react';

type StatusType = 'idle' | 'listening' | 'processing' | 'normal' | 'error';

// Strip <thinking>...</thinking> blocks that Nova Pro sometimes emits
const stripThinking = (text: string) => {
  const stripped = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
  if (!stripped && text.includes('<thinking>')) {
    const matches = Array.from(text.matchAll(/<thinking>([\s\S]*?)<\/thinking>/g));
    const last = matches[matches.length - 1]?.[1]?.trim();
    if (last) {
      return last.replace(/RenderServerTarget___\w+/g, 'sensor gateway');
    }
  }
  return stripped || text || 'Analysis complete.';
};

// Parse deviation value from a text string
const parseDeviation = (text: string): number | null => {
  const m =
    text.match(/(?:measured|current|reading|deviation(?: of| is|:)?|specifically at)\s*(\d+(?:\.\d+)?)\s*micron/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*micron/i);
  return m ? parseFloat(m[1]) : null;
};

// Format feature ID or acronyms for natural SpeechSynthesis so TTS does not spell them out letter-by-letter
const formatSpokenPronunciation = (str: string): string => {
  return str
    .replace(/\bUPPER_FLANGE\b/g, 'Upper Flange')
    .replace(/\bMAIN_BORE_HOLE\b/g, 'Main Bore Hole')
    .replace(/\bTURBINE_BLADE_ROOT\b/g, 'Turbine Blade Root')
    .replace(/\bINLET_NOZZLE_RING\b/g, 'Inlet Nozzle Ring')
    .replace(/\bEXHAUST_STATOR_BOSS\b/g, 'Exhaust Stator Boss')
    .replace(/\bCNC\b/g, 'C N C')
    .replace(/\bNOMINAL\b/g, 'Nominal')
    .replace(/\bOUT OF TOLERANCE\b/g, 'Out of tolerance')
    .replace(/\bWITHIN TOLERANCE\b/g, 'Within tolerance')
    .replace(/\b([A-Z]{2,})\b/g, (match) => {
      // Convert any other all-caps words (e.g. RPM, VERDICT) to Title case unless standard 3-letter acronym
      if (match === 'RPM' || match === 'CMM' || match === 'DMO') return match;
      return match.charAt(0) + match.slice(1).toLowerCase();
    })
    .replace(/_/g, ' ');
};

// Dynamically convert AgentCore's generated analysis into natural spoken speech without hardcoded placeholders
const formatAgentCoreSpokenText = (text: string, contextPrompt?: string): string => {
  if (!text) return '';

  let spoken = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // strip internal thoughts
    .replace(/```[\s\S]*?```/g, '') // strip raw multiline code blocks (e.g. raw G-code) so TTS stays fluid
    .replace(/`([^`]+)`/g, '$1') // unwrap inline code
    .replace(/\*\*|__|[*_]/g, ' ') // strip bold/italics
    .replace(/^#+\s+/gm, '') // strip markdown header tags
    .replace(/^\s*[-*•]\s+/gm, '') // strip bullet dashes
    .replace(/\|[^\n]+\|/g, ' ') // strip table borders
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // unwrap links
    // Convert units and technical acronyms for clear spoken phonetics
    .replace(/(\d+(?:\.\d+)?)\s*mm\b/gi, '$1 millimeters')
    .replace(/(\d+(?:\.\d+)?)\s*µm\b/gi, '$1 microns')
    .replace(/M24\b/g, 'M 24')
    .replace(/\bUPPER_FLANGE\b/g, 'Upper Flange')
    .replace(/\bMAIN_BORE_HOLE\b/g, 'Main Bore Hole')
    .replace(/\bTURBINE_BLADE_ROOT\b/g, 'Turbine Blade Root')
    .replace(/\bINLET_NOZZLE_RING\b/g, 'Inlet Nozzle Ring')
    .replace(/\bEXHAUST_STATOR_BOSS\b/g, 'Exhaust Stator Boss')
    .replace(/\bCNC\b/g, 'C N C')
    .replace(/\bRPM\b/g, 'R P M')
    .replace(/\bCMM\b/g, 'C M M')
    .replace(/\bNOMINAL\b/g, 'Nominal')
    .replace(/\bOUT OF TOLERANCE\b/g, 'Out of tolerance')
    .replace(/\bWITHIN TOLERANCE\b/g, 'Within tolerance')
    .replace(/_/g, ' ')
    // Convert remaining all-caps words to Title Case unless standard 3-letter acronym
    .replace(/\b([A-Z]{2,})\b/g, (match) => {
      if (match === 'R P M' || match === 'C M M' || match === 'C N C' || match === 'DMO') return match;
      return match.charAt(0) + match.slice(1).toLowerCase();
    })
    .replace(/\s+/g, ' ')
    .trim();

  return spoken;
};

// Normalize phonetic variations and accent pronunciations to exact aerospace metrology terms
const normalizeAcousticSpeech = (rawText: string): string => {
  let text = rawText;

  // Upper Flange phonetics (e.g. "aper falnge", "upper flang", "up per plange", "oper flange")
  text = text.replace(/\b(upper|aper|oper|apir|up\s*per|apa)\s*(flange|falnge|flang|flanje|plange|plang|plant|french|flange)\b/gi, 'UPPER_FLANGE');
  text = text.replace(/\b(aper\s*falnge|upper\s*falnge|aper\s*flange)\b/gi, 'UPPER_FLANGE');
  text = text.replace(/\bupper\s*fl\w*\b/gi, 'UPPER_FLANGE');

  // Main Bore Hole phonetics (e.g. "main bore", "mane boor hole", "manhole board", "manhole")
  text = text.replace(/\b(main|mane|men|mine|man)\s*(bore|boar|boor|pour|four|pore)?\s*(hole|whole|hall|hold|board)?\b/gi, (match) => {
    if (/man\s*hole|manhole|main\s*bore|mane\s*boor|bore\s*hole/i.test(match)) {
      return 'MAIN_BORE_HOLE';
    }
    return match;
  });
  text = text.replace(/\b(manhole|man\s*hole|main\s*board)\b/gi, 'MAIN_BORE_HOLE');
  text = text.replace(/\bMAIN_BORE_HOLE\s*(board|hole|bore)\b/gi, 'MAIN_BORE_HOLE');
  text = text.replace(/\bm\s*a\s*i\s*n\s*b\s*o\s*r\s*e(\s*h\s*o\s*l\s*e)?\b/gi, 'MAIN_BORE_HOLE');
  text = text.replace(/\b(main\s*bore|bore\s*hole)\b/gi, 'MAIN_BORE_HOLE');

  // Turbine Blade Root phonetics (e.g. "turbin blade root", "tarbine plate wood")
  text = text.replace(/\b(turbine|turbin|tarbine|turb|terbine)\s*(blade|blad|plate)?\s*(root|rout|route|wood|rud)?\b/gi, 'TURBINE_BLADE_ROOT');
  text = text.replace(/\bblade\s*root\b/gi, 'TURBINE_BLADE_ROOT');

  // Inlet Nozzle Ring phonetics (e.g. "inlet nozzle", "inlett nosel ring")
  text = text.replace(/\b(inlet|inlett|in\s*let)\s*(nozzle|nosel|nozel|nasal|nuzzle)?\s*(ring|wring)?\b/gi, 'INLET_NOZZLE_RING');
  text = text.replace(/\bnozzle\s*ring\b/gi, 'INLET_NOZZLE_RING');

  // Exhaust Stator Boss phonetics (e.g. "exaust stator boss", "igzost starter base")
  text = text.replace(/\b(exhaust|exaust|igzost|egzost)\s*(stator|stater|starter)?\s*(boss|bose|base|pos)?\b/gi, 'EXHAUST_STATOR_BOSS');
  text = text.replace(/\bstator\s*boss\b/gi, 'EXHAUST_STATOR_BOSS');

  // Procedural conversational shortcuts (e.g. "proceed repair", "yes", "retrieve repair procedure")
  if (/^\s*(yes|yeah|yep|sure|proceed|fix\s*it|do\s*it|ok|okay)\.?\s*$/i.test(text.trim())) {
    return 'Yes, retrieve the CNC repair procedure.';
  }
  if (/\b(proceed\s*repair|proceed\s*with\s*repair|retrieve\s*repair|start\s*repair|repair\s*now)\b/i.test(text)) {
    return 'Yes, retrieve the CNC repair procedure.';
  }
  if (/\b(yes|yeah|yep|sure|proceed)\b.*\b(repair|procedure|fix)\b/i.test(text)) {
    return 'Yes, retrieve the CNC repair procedure.';
  }

  return text;
};

// Code block with copy-to-clipboard button
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-brand-800 bg-brand-950/95 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-brand-900/60 border-b border-brand-800/80 text-[11px] font-mono text-brand-300">
        <span>{language ? language.toUpperCase() : 'CODE / TELEMETRY'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-800 hover:bg-brand-700 text-brand-200 transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono text-brand-100 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// 5 Supported Aerospace Inspection Features & Metrology Limits
const PARTS_METROLOGY_CONFIG: Record<
  string,
  { label: string; nominal: number; tolerance: number; unit: string }
> = {
  UPPER_FLANGE: {
    label: 'Upper Flange',
    nominal: 50.0,
    tolerance: 2.0,
    unit: 'µm',
  },
  MAIN_BORE_HOLE: {
    label: 'Main Bore Hole',
    nominal: 15.0,
    tolerance: 0.1,
    unit: 'µm',
  },
  TURBINE_BLADE_ROOT: {
    label: 'Turbine Blade Root',
    nominal: 32.5,
    tolerance: 1.5,
    unit: 'µm',
  },
  INLET_NOZZLE_RING: {
    label: 'Inlet Nozzle Ring',
    nominal: 78.2,
    tolerance: 2.5,
    unit: 'µm',
  },
  EXHAUST_STATOR_BOSS: {
    label: 'Exhaust Stator Boss',
    nominal: 24.0,
    tolerance: 1.8,
    unit: 'µm',
  },
};

interface MetrologyTelemetry {
  featureKey: string;
  label: string;
  nominal: number;
  measured: number;
  deviation: number;
  tolerance: number;
  isOutOfTolerance: boolean;
}

// Extract rich metrology telemetry from Agent response text and context
const extractMetrologyTelemetry = (
  text: string,
  prompt?: string
): MetrologyTelemetry | null => {
  if (!text) return null;

  // 1. Detect feature key
  const match =
    text.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i) ||
    prompt?.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i) ||
    text.match(/\b(Upper Flange|Main Bore Hole|Turbine Blade Root|Inlet Nozzle Ring|Exhaust Stator Boss)\b/i);

  if (!match) return null;

  const rawKey = match[1].toUpperCase().replace(/\s+/g, '_');
  const config = PARTS_METROLOGY_CONFIG[rawKey];
  if (!config) return null;

  // 2. Parse deviation
  const devVal = parseDeviation(text);
  if (devVal === null) return null;

  // 3. Parse measured dimension if mentioned, else derive from nominal + deviation in mm
  const measuredMatch = text.match(/(?:measured|current dimension|actual dimension|value is)\s*(?:at\s*)?(\d+\.\d+)\s*mm/i);
  const measured = measuredMatch
    ? parseFloat(measuredMatch[1])
    : Number((config.nominal + devVal / 1000).toFixed(4));

  // 4. Tolerance status
  const isOutOfTolerance =
    /out of tolerance|exceeds|exceeded|exceeding|requires repair|requires cnc rework|not safe|deviation exceeded/i.test(text) ||
    devVal > config.tolerance;

  return {
    featureKey: rawKey,
    label: config.label,
    nominal: config.nominal,
    measured,
    deviation: devVal,
    tolerance: config.tolerance,
    isOutOfTolerance,
  };
};

// Real-Time Aerospace Tolerance Deviation Gauge Component (GitHub Issue #14 Hero Visual)
function ToleranceDeviationGauge({
  telemetry,
}: {
  telemetry: MetrologyTelemetry;
}) {
  const { label, nominal, measured, deviation, tolerance, isOutOfTolerance } = telemetry;

  // Dynamic needle position calculation across ±150% tolerance scale
  // Left: -1.5 * tolerance (0%)
  // Center: 0.0 µm nominal (50%)
  // Right: +1.5 * tolerance (100%)
  const maxSpan = tolerance * 1.5;
  const clampedDev = Math.max(-maxSpan, Math.min(maxSpan, deviation));
  const needlePercent = Math.max(2, Math.min(98, 50 + (clampedDev / (2 * maxSpan)) * 100));

  // Near-boundary warning zone (80% - 100% of tolerance)
  const isNearBoundary = !isOutOfTolerance && deviation >= tolerance * 0.8;

  return (
    <div className="mb-6 max-w-2xl w-full rounded-3xl backdrop-blur-xl border border-brand-200/90 bg-white/95 text-brand-950 shadow-xl shadow-brand-500/10 overflow-hidden animate-fadeIn transition-all duration-500">
      {/* Top Banner / Feature Identity & Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-brand-300 shadow-inner">
            <Gauge className="w-4 h-4 text-brand-300" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase text-brand-300/80">
                AEROSPACE METROLOGY GAUGE
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              {label}
            </h3>
          </div>
        </div>

        {/* Verdict Badge */}
        <div>
          {isOutOfTolerance ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold tracking-wide animate-pulse shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>⚠️ OUT OF TOLERANCE</span>
            </span>
          ) : isNearBoundary ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-bold tracking-wide shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>NEAR BOUNDARY (80-100%)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs font-bold tracking-wide shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ IN TOLERANCE</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Gauge Graphic Section */}
      <div className="p-6 bg-slate-900/5 border-b border-brand-100 flex flex-col gap-4">
        {/* Scale Header Values */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-500">
          <div className="flex items-center gap-1">
            <span className="text-red-500 font-semibold">-{tolerance.toFixed(3)} µm</span>
            <span className="text-[10px] text-slate-400">(-LSL)</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-emerald-600 font-bold">
              <Target className="w-3 h-3 text-emerald-600" />
              <span>NOMINAL (0.000 µm)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{nominal.toFixed(3)} mm</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">(+USL)</span>
            <span className="text-red-500 font-semibold">+{tolerance.toFixed(3)} µm</span>
          </div>
        </div>

        {/* Horizontal Visual Tolerance Bar */}
        <div className="relative w-full pt-6 pb-4">
          {/* Active Deviation Needle / Pin Indicator */}
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-700 ease-out z-20"
            style={{ left: `${needlePercent}%` }}
          >
            {/* Tooltip Needle Tag */}
            <div
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-tight shadow-md flex items-center gap-1 ${
                isOutOfTolerance
                  ? 'bg-red-600 text-white shadow-red-500/30 ring-2 ring-red-400/50'
                  : isNearBoundary
                  ? 'bg-amber-500 text-white shadow-amber-500/30'
                  : 'bg-emerald-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/50'
              }`}
            >
              <span>{deviation >= 0 ? `+${deviation.toFixed(3)}` : deviation.toFixed(3)} µm</span>
            </div>
            {/* Pointer arrow */}
            <div
              className={`w-0 h-0 border-x-4 border-x-transparent border-t-[6px] ${
                isOutOfTolerance
                  ? 'border-t-red-600'
                  : isNearBoundary
                  ? 'border-t-amber-500'
                  : 'border-t-emerald-600'
              }`}
            />
          </div>

          {/* Tolerance Zone Track Bar */}
          <div className="h-4 w-full rounded-full bg-slate-200 overflow-hidden flex shadow-inner border border-slate-300 relative">
            {/* Left Out of Tolerance (Red: 0% to 16.67%) */}
            <div className="w-[16.67%] h-full bg-red-500/80" title="Out of Tolerance (-)" />
            {/* Left Warning Zone (Amber: 16.67% to 23.33%) */}
            <div className="w-[6.66%] h-full bg-amber-400/90" title="Warning Limit (-)" />
            {/* Safe Nominal Tolerance Zone (Green: 23.33% to 76.67%) */}
            <div className="w-[53.34%] h-full bg-emerald-500/90 flex items-center justify-center relative" title="Safe Nominal Zone">
              {/* Center Nominal Reference Line */}
              <div className="w-0.5 h-full bg-white/90 shadow-sm" />
            </div>
            {/* Right Warning Zone (Amber: 76.67% to 83.33%) */}
            <div className="w-[6.66%] h-full bg-amber-400/90" title="Warning Limit (+)" />
            {/* Right Out of Tolerance (Red: 83.33% to 100%) */}
            <div className="w-[16.67%] h-full bg-red-500/80" title="Out of Tolerance (+)" />

            {/* Zero Nominal Center Marker Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-900/60 z-10" />
            {/* Negative Limit Marker */}
            <div className="absolute left-[23.33%] top-0 bottom-0 w-0.5 bg-red-900/40 z-10" />
            {/* Positive Limit Marker */}
            <div className="absolute left-[76.67%] top-0 bottom-0 w-0.5 bg-red-900/40 z-10" />
          </div>

          {/* Scale Legend Markers */}
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mt-2 px-1">
            <span>-1.5x Tol</span>
            <span className="text-red-500 font-medium">Lower Limit</span>
            <span className="text-emerald-700 font-semibold">Zero / Nominal</span>
            <span className="text-red-500 font-medium">Upper Limit</span>
            <span>+1.5x Tol</span>
          </div>
        </div>
      </div>

      {/* Pill Data Chips Footer */}
      <div className="p-4 px-6 bg-white flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200">
          <span className="text-slate-500 font-medium">Nominal:</span>
          <span className="font-mono font-bold text-slate-800">{nominal.toFixed(3)} mm</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200">
          <span className="text-slate-500 font-medium">Measured:</span>
          <span className="font-mono font-bold text-slate-800">{measured.toFixed(4)} mm</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
            isOutOfTolerance
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span className="font-medium">Deviation:</span>
          <span className="font-mono font-bold">
            {deviation >= 0 ? `+${deviation.toFixed(3)}` : deviation.toFixed(3)} µm
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200">
          <span className="text-slate-500 font-medium">Tol Limit:</span>
          <span className="font-mono font-bold text-slate-800">±{tolerance.toFixed(3)} µm</span>
        </div>
      </div>
    </div>
  );
}

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
      utterance.rate = 1.0;
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
    const rawCommit = accumulatedTranscriptRef.current.trim();
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
        if (rawLiveText) {
          const calibratedLiveText = normalizeAcousticSpeech(rawLiveText);
          setDisplayPrompt(calibratedLiveText);
        }

        // Reset the silence timer: wait 1.8 seconds of quiet before auto-submitting
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (isRecordingIntentRef.current && (accumulatedTranscriptRef.current + interim).trim()) {
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
        if (isRecordingIntentRef.current && accumulatedTranscriptRef.current.trim()) {
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
              {(() => {
                const featureMatch = agentResponse.match(/(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)/i);
                if (!featureMatch) return null;
                const featKey = featureMatch[1].toUpperCase();
                const history = telemetryHistory[featKey] || [];
                if (history.length < 2) return null;

                const firstVal = history[0];
                const latestVal = history[history.length - 1];
                const delta = latestVal - firstVal;
                const isDriftingUp = delta > 0.05;
                const isDriftingDown = delta < -0.05;

                // Simple SVG sparkline calculation
                const min = Math.min(...history, 0);
                const max = Math.max(...history, 3.0);
                const range = max - min || 1;
                const width = 120;
                const height = 28;
                const points = history
                  .map((val, idx) => {
                    const x = (idx / (history.length - 1)) * (width - 12) + 6;
                    const y = height - ((val - min) / range) * (height - 8) - 4;
                    return `${x},${y}`;
                  })
                  .join(' ');

                return (
                  <div className="mt-4 pt-3 border-t border-brand-200/70 flex flex-wrap items-center justify-between gap-3 bg-brand-50/50 p-3 rounded-2xl">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-brand-500" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                          Batch Drift Trend ({history.length} Units Inspected)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isDriftingUp ? (
                          <>
                            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-xs font-semibold text-amber-700">
                              Drifting toward tolerance limit (+{delta.toFixed(3)} µm)
                            </span>
                          </>
                        ) : isDriftingDown ? (
                          <>
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-semibold text-emerald-700">
                              Stabilizing toward nominal ({delta.toFixed(3)} µm)
                            </span>
                          </>
                        ) : (
                          <>
                            <Minus className="w-3.5 h-3.5 text-brand-500" />
                            <span className="text-xs font-semibold text-brand-700">
                              Tooling stable (±0.04 µm variance)
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Visual SVG Sparkline */}
                    <div className="flex items-center gap-2 bg-white/80 px-2.5 py-1 rounded-xl border border-brand-200/80 shadow-xs">
                      <svg width={width} height={height} className="overflow-visible">
                        {/* Sparkline curve */}
                        <polyline
                          fill="none"
                          stroke={isDriftingUp ? '#d97706' : '#10b981'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                        {/* Nodes */}
                        {history.map((val, idx) => {
                          const x = (idx / (history.length - 1)) * (width - 12) + 6;
                          const y = height - ((val - min) / range) * (height - 8) - 4;
                          const isLast = idx === history.length - 1;
                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r={isLast ? '4' : '2.5'}
                              fill={isLast ? (isDriftingUp ? '#b45309' : '#059669') : '#ea580c'}
                              className={isLast ? 'animate-pulse' : ''}
                            />
                          );
                        })}
                      </svg>
                      <span className="text-[10px] font-mono font-bold text-brand-800">
                        {latestVal.toFixed(3)} µm
                      </span>
                    </div>
                  </div>
                );
              })()}

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
          <div className="w-full max-w-2xl flex flex-wrap items-center justify-center gap-2 mb-6 animate-fadeIn">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400 w-full mb-1">
              Inspection Features
            </span>
            {[
              { id: 'UPPER_FLANGE', label: 'Upper Flange' },
              { id: 'MAIN_BORE_HOLE', label: 'Main Bore Hole' },
              { id: 'TURBINE_BLADE_ROOT', label: 'Turbine Blade Root' },
              { id: 'INLET_NOZZLE_RING', label: 'Inlet Nozzle Ring' },
              { id: 'EXHAUST_STATOR_BOSS', label: 'Exhaust Stator Boss' },
            ].map((part) => (
              <button
                key={part.id}
                type="button"
                onClick={() => processWorkflow(`Query the live sensor deviation for ${part.id} and evaluate if it is within or out of tolerance.`)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-full bg-white/80 hover:bg-white border border-brand-200/90 text-brand-800 hover:text-brand-950 text-xs font-medium shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                <span>{part.label}</span>
              </button>
            ))}
          </div>
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

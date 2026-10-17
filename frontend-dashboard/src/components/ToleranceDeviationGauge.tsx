'use client';

import { AlertTriangle, CheckCircle2, Gauge, Target } from 'lucide-react';
import { parseDeviation } from '../lib/speech-utils';

// 5 Supported Aerospace Inspection Features & Metrology Limits
export const PARTS_METROLOGY_CONFIG: Record<
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

export interface MetrologyTelemetry {
  featureKey: string;
  label: string;
  nominal: number;
  measured: number;
  deviation: number;
  tolerance: number;
  isOutOfTolerance: boolean;
}

// Extract rich metrology telemetry from Agent response text and context
export const extractMetrologyTelemetry = (
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
export default function ToleranceDeviationGauge({
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

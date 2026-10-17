'use client';

import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SpcDriftWidgetProps {
  agentResponse: string;
  telemetryHistory: Record<string, number[]>;
}

export default function SpcDriftWidget({
  agentResponse,
  telemetryHistory,
}: SpcDriftWidgetProps) {
  const featureMatch = agentResponse.match(
    /(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)/i
  );
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
}

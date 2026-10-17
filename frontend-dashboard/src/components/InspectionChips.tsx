'use client';

interface InspectionChipsProps {
  onSelectFeature: (featureId: string) => void;
  disabled: boolean;
}

const PARTS = [
  { id: 'UPPER_FLANGE', label: 'Upper Flange' },
  { id: 'MAIN_BORE_HOLE', label: 'Main Bore Hole' },
  { id: 'TURBINE_BLADE_ROOT', label: 'Turbine Blade Root' },
  { id: 'INLET_NOZZLE_RING', label: 'Inlet Nozzle Ring' },
  { id: 'EXHAUST_STATOR_BOSS', label: 'Exhaust Stator Boss' },
];

export default function InspectionChips({
  onSelectFeature,
  disabled,
}: InspectionChipsProps) {
  return (
    <div className="w-full max-w-2xl flex flex-wrap items-center justify-center gap-2 mb-6 animate-fadeIn">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400 w-full mb-1">
        Inspection Features
      </span>
      {PARTS.map((part) => (
        <button
          key={part.id}
          type="button"
          onClick={() => onSelectFeature(part.id)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full bg-white/80 hover:bg-white border border-brand-200/90 text-brand-800 hover:text-brand-950 text-xs font-medium shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
          <span>{part.label}</span>
        </button>
      ))}
    </div>
  );
}

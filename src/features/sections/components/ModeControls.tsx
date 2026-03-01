import type { StudyAreaMode } from '@/shared/types/geo';
import { IsochroneIcon, PedshedIcon } from './StatusBadge';

const MODES: { value: StudyAreaMode; label: string }[] = [
  { value: 'ring', label: 'Pedshed' },
  { value: 'isochrone', label: 'Isochrone' },
];

interface ModeControlsProps {
  mode: StudyAreaMode;
  onModeChange: (mode: StudyAreaMode) => void;
  customMinutes: number | null;
  onCustomMinutesChange: (value: number | null) => void;
}

export function ModeControls({ mode, onModeChange, customMinutes, onCustomMinutesChange }: ModeControlsProps): React.ReactElement {
  const isCustom = customMinutes != null;

  return (
    <div className="px-6 py-3 border-b-2 border-neutral-200 shrink-0 flex flex-col gap-3">
      <div className="flex gap-0">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onModeChange(value)}
            className={`flex-1 flex items-center justify-center gap-1.5 font-heading text-[11px] font-semibold uppercase tracking-wider py-2 transition-all cursor-pointer border-2 ${
              mode === value
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400 hover:text-neutral-600'
            } ${value === 'ring' ? 'border-r-0' : ''}`}
          >
            {value === 'isochrone' ? <IsochroneIcon /> : <PedshedIcon />}
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-neutral-400 shrink-0 uppercase tracking-wider">Walk</span>
        {!isCustom ? (
          <>
            <span className="font-mono text-[12px] font-medium text-neutral-900 tracking-tight">5 · 10 · 15 min</span>
            <button
              onClick={() => onCustomMinutesChange(10)}
              className="ml-auto font-mono text-[10px] text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer font-medium uppercase tracking-wider border-b border-neutral-300 hover:border-neutral-900"
            >
              Custom
            </button>
          </>
        ) : (
          <>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={customMinutes}
              onChange={(e) => onCustomMinutesChange(Number(e.target.value))}
              className="flex-1 h-0.5 bg-neutral-300 appearance-none cursor-pointer accent-neutral-900 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-neutral-900 [&::-webkit-slider-thumb]:appearance-none"
            />
            <span className="font-mono text-[12px] font-bold text-neutral-900 tabular-nums w-12 text-right shrink-0">
              {customMinutes} min
            </span>
            <button
              onClick={() => onCustomMinutesChange(null)}
              className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Reset to 5 · 10 · 15"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

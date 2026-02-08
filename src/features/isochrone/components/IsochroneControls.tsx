import type { LngLat, StudyAreaMode } from '@/shared/types/geo';

type IsochroneStatus = 'idle' | 'fetching' | 'done' | 'error';

interface IsochroneControlsProps {
  origin: LngLat | null;
  status: IsochroneStatus;
  error: string | null;
  mode: StudyAreaMode;
  onModeChange: (mode: StudyAreaMode) => void;
  onClear: () => void;
}

const MODES: { value: StudyAreaMode; label: string }[] = [
  { value: 'ring', label: 'Pedshed' },
  { value: 'isochrone', label: 'Isochrone' },
];

export function IsochroneControls({
  origin,
  status,
  error,
  mode,
  onModeChange,
  onClear,
}: IsochroneControlsProps): React.ReactElement {
  return (
    <div className="absolute bottom-6 left-6 z-10 p-4 min-w-56 bg-white border-2 border-neutral-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-sm font-bold uppercase tracking-tight text-neutral-900">
          Study Area
        </h3>
        {origin && (
          <button
            onClick={onClear}
            className="font-mono text-[10px] px-2 py-1 text-neutral-500 border border-neutral-300 hover:border-neutral-900 hover:text-neutral-900 transition-colors cursor-pointer uppercase tracking-wider"
          >
            Clear
          </button>
        )}
      </div>

      {!origin && (
        <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
          Click anywhere to set origin
        </p>
      )}

      {origin && (
        <>
          <p className="font-mono text-[11px] mb-3 text-neutral-500">
            {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
          </p>

          {/* Mode toggle */}
          <div className="flex mb-3">
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onModeChange(value)}
                className={`flex-1 font-heading text-[10px] font-semibold uppercase tracking-wider py-1.5 transition-colors cursor-pointer border-2 ${
                  mode === value
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400'
                } ${value === 'ring' ? 'border-r-0' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <StatusIndicator status={status} error={error} />
        </>
      )}
    </div>
  );
}

function StatusIndicator({
  status,
  error,
}: {
  status: IsochroneStatus;
  error: string | null;
}): React.ReactElement | null {
  if (status === 'idle' || status === 'done') return null;

  if (status === 'error') {
    return (
      <p className="font-mono text-[11px] mt-2 text-neutral-900">
        {error ?? 'Unknown error'}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-2 h-2 bg-neutral-900 animate-pulse" />
      <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Loading...</p>
    </div>
  );
}

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
  { value: 'ring', label: 'Ring' },
  { value: 'isochrone', label: 'Isochrone' },
  { value: 'both', label: 'Both' },
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
    <div className="absolute bottom-6 left-6 z-10 rounded-xl p-4 min-w-56"
      style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Study Area
        </h3>
        {origin && (
          <button
            onClick={onClear}
            className="text-xs px-2 py-1 rounded-md hover:opacity-80 transition-opacity cursor-pointer"
            style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)' }}
          >
            Clear
          </button>
        )}
      </div>

      {!origin && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Click anywhere to set origin
        </p>
      )}

      {origin && (
        <>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
          </p>

          {/* Mode toggle */}
          <div
            className="flex rounded-lg p-0.5 mb-3"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onModeChange(value)}
                className="flex-1 text-xs py-1.5 rounded-md transition-colors cursor-pointer"
                style={{
                  color: mode === value ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: mode === value ? 'rgba(99,102,241,0.25)' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <Legend mode={mode} />

          <StatusIndicator status={status} error={error} />
        </>
      )}
    </div>
  );
}

function Legend({ mode }: { mode: StudyAreaMode }): React.ReactElement {
  const showRing = mode === 'ring' || mode === 'both';
  const showIso = mode === 'isochrone' || mode === 'both';

  return (
    <div className="flex flex-col gap-1.5">
      {showIso && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="w-4 border-t" style={{ borderColor: '#6366f1' }} />
          <span>Isochrone (network)</span>
        </div>
      )}
      {showRing && (
        <div className="flex gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t-2 border-dashed" style={{ borderColor: '#a5b4fc' }} />
            5m
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t-2 border-dashed" style={{ borderColor: '#818cf8' }} />
            10m
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed" style={{ borderColor: '#6366f1' }} />
            15m
          </span>
        </div>
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
      <p className="text-xs mt-2" style={{ color: '#ef4444' }}>
        {error ?? 'Unknown error'}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
    </div>
  );
}

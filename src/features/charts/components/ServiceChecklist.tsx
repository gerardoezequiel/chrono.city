import { memo } from 'react';
import type { ChartProps } from '../types';

/**
 * 15-minute city category checklist.
 * Record<string, boolean> → check/cross grid.
 */
function ServiceChecklistRaw({ data }: ChartProps): React.ReactElement | null {
  if (!data || typeof data !== 'object') return null;

  const record = data as Record<string, boolean>;
  const entries = Object.entries(record);

  if (entries.length === 0) return null;

  const presentCount = entries.filter(([, v]) => v).length;

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map(([label, present]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`font-mono text-xs font-bold leading-none ${present ? 'text-neutral-900' : 'text-neutral-300'}`}>
              {present ? '\u2713' : '\u00d7'}
            </span>
            <span className={`font-mono text-[9px] uppercase tracking-wider truncate ${present ? 'text-neutral-600' : 'text-neutral-300'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="font-mono text-[8px] text-neutral-400 mt-2 uppercase tracking-widest">
        {presentCount}/{entries.length} categories present
      </p>
    </div>
  );
}

export const ServiceChecklist = memo(ServiceChecklistRaw);

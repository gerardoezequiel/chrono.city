import { memo } from 'react';
import type { ChartProps } from '../types';

const PALETTE = ['#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4'];

/**
 * Ring chart for Record<string, number> proportions.
 * SVG arcs via stroke-dasharray. Center shows total.
 */
function MiniDonutRaw({ data, options }: ChartProps): React.ReactElement | null {
  if (!data || typeof data !== 'object') return null;

  const record = data as Record<string, number>;
  const maxCategories = options?.maxCategories ?? 6;

  const entries = Object.entries(record)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxCategories);

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return null;

  const size = options?.height ?? 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const circumference = 2 * Math.PI * r;
  const colors = options?.colorScheme ?? PALETTE;

  let offset = 0;
  const arcs = entries.map(([label, value], i) => {
    const dashLen = (value / total) * circumference;
    const dashOff = -offset;
    offset += dashLen;
    return { label, value, dashLen, dashOff, color: colors[i % colors.length] ?? '#a3a3a3' };
  });

  return (
    <div className="flex items-center gap-4 mt-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={14}
            strokeDasharray={`${arc.dashLen} ${circumference - arc.dashLen}`}
            strokeDashoffset={arc.dashOff}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-neutral-900 font-mono font-bold" fontSize={16}>
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-neutral-400 font-mono" fontSize={7}>
          TOTAL
        </text>
      </svg>
      <div className="flex flex-col gap-1 min-w-0">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider truncate">
              {arc.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MiniDonut = memo(MiniDonutRaw);

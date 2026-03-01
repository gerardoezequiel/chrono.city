import { memo } from 'react';
import type { ChartProps } from '../types';

const DEFAULT_COLOR = '#171717';

/**
 * Horizontal bar chart for Record<string, number>.
 * Sorts by value, truncates to maxCategories. Pure SVG with monospace labels.
 * When colorMap is provided, each bar is colored by its label — acts as a legend.
 */
function MiniBarRaw({ data, options }: ChartProps): React.ReactElement | null {
  if (!data || typeof data !== 'object') return null;

  const record = data as Record<string, number>;
  const maxCategories = options?.maxCategories ?? 8;
  const colorMap = options?.colorMap;

  const entries = Object.entries(record)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxCategories);

  if (entries.length === 0) return null;

  const maxValue = Math.max(...entries.map(([, v]) => v));
  const barH = 16;
  const gap = 3;
  const swatchW = colorMap ? 14 : 0;
  const labelW = 90;
  const barW = 170;
  const valueW = 50;
  const totalW = swatchW + labelW + barW + valueW;
  const totalH = entries.length * (barH + gap) - gap;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${totalW} ${totalH}`}
      preserveAspectRatio="xMinYMin meet"
      className="mt-2"
    >
      {entries.map(([label, value], i) => {
        const y = i * (barH + gap);
        const w = maxValue > 0 ? (value / maxValue) * barW : 0;
        const color = colorMap?.[label] ?? DEFAULT_COLOR;
        const truncated = label.length > 12 ? label.slice(0, 12) + '\u2026' : label;

        return (
          <g key={label}>
            {/* Color swatch (legend mode) */}
            {colorMap && (
              <rect
                x={0}
                y={y + 3}
                width={10}
                height={barH - 6}
                rx={1}
                fill={color}
              />
            )}
            <text
              x={swatchW + labelW - 4}
              y={y + barH / 2 + 3.5}
              textAnchor="end"
              className="fill-neutral-500 font-mono"
              fontSize={9}
            >
              {truncated}
            </text>
            <rect
              x={swatchW + labelW}
              y={y + 1}
              width={w}
              height={barH - 2}
              fill={color}
            />
            <text
              x={swatchW + labelW + barW + 4}
              y={y + barH / 2 + 3.5}
              textAnchor="start"
              className="fill-neutral-400 font-mono"
              fontSize={9}
            >
              {formatCount(value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export const MiniBar = memo(MiniBarRaw);

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

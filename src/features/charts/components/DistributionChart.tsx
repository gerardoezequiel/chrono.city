import { memo } from 'react';
import type { ChartProps } from '../types';

const BAR_COLOR = '#171717';
const LABEL_FONT_SIZE = 8;
const CHART_W = 320;
const MARGIN = { top: 8, right: 4, bottom: 22, left: 32 };

/**
 * Vertical histogram for number[] data.
 * Bins values into N buckets (default 20, configurable via maxCategories).
 * Shows a dashed median line overlay. Pure SVG, monospace labels.
 */
function DistributionChartRaw({ data, options }: ChartProps): React.ReactElement | null {
  if (!Array.isArray(data)) return null;

  const values = (data as number[]).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return null;

  const numBins = options?.maxCategories ?? 20;
  const chartH = options?.height ?? 100;
  const useLog = options?.logScale ?? false;
  const totalW = CHART_W;
  const totalH = chartH + MARGIN.top + MARGIN.bottom;
  const plotW = totalW - MARGIN.left - MARGIN.right;
  const plotH = chartH;

  const sorted = [...values].sort((a, b) => a - b);
  // Safe: values.length > 0 guaranteed above
  const min = sorted[0] as number;
  const max = sorted[sorted.length - 1] as number;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;

  // Single value — render one bar
  if (min === max) {
    return (
      <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} preserveAspectRatio="xMinYMin meet" className="mt-2">
        <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill={BAR_COLOR} />
        <text x={MARGIN.left + plotW / 2} y={totalH - 4} textAnchor="middle" className="fill-neutral-400 font-mono" fontSize={LABEL_FONT_SIZE}>
          {formatBinLabel(min)}
        </text>
      </svg>
    );
  }

  // Build histogram bins
  const binWidth = (max - min) / numBins;
  const bins: number[] = new Array(numBins).fill(0) as number[];
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[idx] = (bins[idx] ?? 0) + 1;
  }

  const maxCount = Math.max(...bins);
  const barW = plotW / numBins;

  function scaleY(count: number): number {
    if (maxCount === 0) return 0;
    if (useLog) {
      const logMax = Math.log1p(maxCount);
      return logMax > 0 ? (Math.log1p(count) / logMax) * plotH : 0;
    }
    return (count / maxCount) * plotH;
  }

  // Median x-position
  const medianX = MARGIN.left + ((median - min) / (max - min)) * plotW;

  // Axis tick labels (show ~5 evenly spaced)
  const tickCount = Math.min(5, numBins);
  const ticks: Array<{ x: number; label: string }> = [];
  for (let i = 0; i <= tickCount; i++) {
    const val = min + (i / tickCount) * (max - min);
    ticks.push({
      x: MARGIN.left + (i / tickCount) * plotW,
      label: formatBinLabel(val),
    });
  }

  // Y-axis ticks
  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} preserveAspectRatio="xMinYMin meet" className="mt-2">
      {/* Y-axis labels */}
      {yTicks.map((count) => {
        const y = MARGIN.top + plotH - scaleY(count);
        return (
          <text key={count} x={MARGIN.left - 4} y={y + 3} textAnchor="end" className="fill-neutral-500 font-mono" fontSize={LABEL_FONT_SIZE}>
            {count}
          </text>
        );
      })}

      {/* Bars */}
      {bins.map((count, i) => {
        const h = scaleY(count);
        const x = MARGIN.left + i * barW;
        const y = MARGIN.top + plotH - h;
        return (
          <rect key={i} x={x + 0.5} y={y} width={Math.max(barW - 1, 1)} height={h} fill={BAR_COLOR} />
        );
      })}

      {/* Median line */}
      <line
        x1={medianX}
        y1={MARGIN.top}
        x2={medianX}
        y2={MARGIN.top + plotH}
        stroke="#a3a3a3"
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <text x={medianX} y={MARGIN.top - 1} textAnchor="middle" className="fill-neutral-400 font-mono" fontSize={7}>
        med
      </text>

      {/* X-axis labels */}
      {ticks.map(({ x, label }, i) => (
        <text key={i} x={x} y={MARGIN.top + plotH + 12} textAnchor="middle" className="fill-neutral-400 font-mono" fontSize={LABEL_FONT_SIZE}>
          {label}
        </text>
      ))}
    </svg>
  );
}

export const DistributionChart = memo(DistributionChartRaw);

function formatBinLabel(n: number): string {
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

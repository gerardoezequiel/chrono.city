import { memo } from 'react';
import type { ChartProps } from '../types';

interface RadarPoint {
  label: string;
  value: number;
  max: number;
}

/**
 * Spider chart for Array<{ label, value, max }>.
 * SVG polygon over reference grid. Used for 7-chapter scoring.
 */
function MiniRadarRaw({ data, options }: ChartProps): React.ReactElement | null {
  if (!Array.isArray(data) || data.length < 3) return null;

  const points = data as RadarPoint[];
  const size = options?.height ?? 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 28;
  const n = points.length;
  const step = (2 * Math.PI) / n;

  function pos(i: number, frac: number): { x: number; y: number } {
    const angle = i * step - Math.PI / 2;
    return { x: cx + maxR * frac * Math.cos(angle), y: cy + maxR * frac * Math.sin(angle) };
  }

  function gridPoly(frac: number): string {
    return points.map((_, i) => {
      const p = pos(i, frac);
      return `${p.x},${p.y}`;
    }).join(' ');
  }

  const dataVerts = points.map((d, i) => {
    const frac = d.max > 0 ? Math.min(d.value / d.max, 1) : 0;
    return pos(i, frac);
  });
  const dataPoly = dataVerts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" className="mt-2">
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1.0].map((lvl) => (
        <polygon
          key={lvl}
          points={gridPoly(lvl)}
          fill="none"
          stroke="rgba(212,212,212,0.4)"
          strokeWidth={0.5}
        />
      ))}

      {/* Axes */}
      {points.map((_, i) => {
        const end = pos(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(212,212,212,0.3)" strokeWidth={0.5} />;
      })}

      {/* Data polygon */}
      <polygon points={dataPoly} fill="rgba(23,23,23,0.1)" stroke="#171717" strokeWidth={1.5} />

      {/* Vertices */}
      {dataVerts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#171717" />
      ))}

      {/* Labels */}
      {points.map((d, i) => {
        const lp = pos(i, 1.2);
        return (
          <text
            key={i}
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-neutral-400 font-mono"
            fontSize={8}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

export const MiniRadar = memo(MiniRadarRaw);

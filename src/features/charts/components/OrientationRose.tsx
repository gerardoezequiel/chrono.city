import { memo } from 'react';

const NUM_BINS = 36;
const BIN_WIDTH_DEG = 180 / NUM_BINS; // 5°

interface OrientationRoseProps {
  bins: number[];            // 36 normalized bins (0-1 scale)
  dominantBearing: number;   // 0-180°
  size?: number;
}

/** Boeing-style polar histogram of street orientations */
function OrientationRoseRaw({ bins, dominantBearing, size = 180 }: OrientationRoseProps): React.ReactElement {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 20; // Leave room for labels
  const maxBin = Math.max(...bins, 0.001);

  // Dominant bin index
  const dominantBin = Math.floor(dominantBearing / BIN_WIDTH_DEG) % NUM_BINS;

  // Build wedge paths — each bin mirrored at 180°
  const wedges: React.ReactElement[] = [];

  for (let i = 0; i < NUM_BINS; i++) {
    const value = bins[i] ?? 0;
    if (value < 0.001) continue;

    const r = (value / maxBin) * maxR;
    const isDominant = i === dominantBin;

    // Two wedges: one at θ, one at θ+180° (streets are bidirectional)
    for (const offset of [0, 180]) {
      const startDeg = i * BIN_WIDTH_DEG + offset - 90; // -90 to put N at top
      const endDeg = startDeg + BIN_WIDTH_DEG;

      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArc = BIN_WIDTH_DEG > 180 ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      wedges.push(
        <path
          key={`${i}-${offset}`}
          d={d}
          fill={isDominant ? 'rgba(220,38,38,0.35)' : 'rgba(163,163,163,0.4)'}
          stroke={isDominant ? 'rgba(220,38,38,0.6)' : 'rgba(163,163,163,0.5)'}
          strokeWidth={0.5}
        />,
      );
    }
  }

  // Reference circles at 25%, 50%, 75%
  const circles = [0.25, 0.5, 0.75].map((pct) => (
    <circle
      key={pct}
      cx={cx}
      cy={cy}
      r={maxR * pct}
      fill="none"
      stroke="rgba(212,212,212,0.4)"
      strokeWidth={0.5}
      strokeDasharray="2 2"
    />
  ));

  // Cardinal labels
  const labels: [string, number, number][] = [
    ['N', cx, cy - maxR - 8],
    ['S', cx, cy + maxR + 12],
    ['E', cx + maxR + 10, cy + 3],
    ['W', cx - maxR - 10, cy + 3],
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {circles}
      <circle cx={cx} cy={cy} r={maxR} fill="none" stroke="rgba(212,212,212,0.3)" strokeWidth={0.5} />
      {/* Cross lines */}
      <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="rgba(212,212,212,0.25)" strokeWidth={0.5} />
      <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="rgba(212,212,212,0.25)" strokeWidth={0.5} />
      {wedges}
      {labels.map(([label, x, y]) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          className="fill-neutral-400 font-mono"
          fontSize={9}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export const OrientationRose = memo(OrientationRoseRaw);

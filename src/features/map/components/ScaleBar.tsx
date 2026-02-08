import { useEffect, useState, useCallback } from 'react';
import type maplibregl from 'maplibre-gl';

interface ScaleBarProps {
  map: maplibregl.Map | null;
}

const STOPS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
const SUB_TICKS = 4; // minor divisions between end caps

function formatLabel(meters: number): string {
  return meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
}

/** Nice representative fraction: 1:25,000 etc. */
function formatRF(mPerPx: number): string {
  // mPerPx = real meters per 1 CSS pixel. Screen ~96 DPI → 1px ≈ 0.264mm
  const pxPerM = 1000 / 0.264; // pixels per real-world meter at 1:1
  const raw = mPerPx * pxPerM;
  // Round to a nice number
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2.5;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  const rf = Math.round(nice * mag);
  return `1:${rf.toLocaleString()}`;
}

export function ScaleBar({ map }: ScaleBarProps): React.ReactElement | null {
  const [width, setWidth] = useState(0);
  const [label, setLabel] = useState('');
  const [rf, setRf] = useState('');
  const [showAttrib, setShowAttrib] = useState(false);

  const update = useCallback(() => {
    if (!map) return;
    const y = map.getCanvas().clientHeight / 2;
    const left = map.unproject([0, y]);
    const right = map.unproject([100, y]);

    const R = 6371000;
    const dLat = (right.lat - left.lat) * Math.PI / 180;
    const dLng = (right.lng - left.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(left.lat * Math.PI / 180) * Math.cos(right.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const mPer100px = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const mPerPx = mPer100px / 100;

    let best = STOPS[0] ?? 5;
    for (const s of STOPS) {
      if (s <= mPer100px) best = s;
      else break;
    }

    setWidth(Math.round((best / mPer100px) * 100));
    setLabel(formatLabel(best));
    setRf(formatRF(mPerPx));
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const init = (): void => { update(); };
    if (map.isStyleLoaded()) init();
    else map.on('load', init);
    map.on('move', update);
    return () => { map.off('load', init); map.off('move', update); };
  }, [map, update]);

  if (!map || width === 0) return null;

  // Build subtick positions (between the two end caps)
  const subTicks: number[] = [];
  for (let i = 1; i <= SUB_TICKS; i++) {
    subTicks.push((i / (SUB_TICKS + 1)) * width);
  }

  return (
    <>
      {/* Scale bar — bottom center, brutalist */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none flex flex-col items-center">
        {/* Distance label */}
        <span
          className="font-mono text-[11px] font-black tracking-[0.2em] uppercase"
          style={{ color: '#dc2626', opacity: 0.7, paddingBottom: 3 }}
        >
          {label}
        </span>

        {/* Bar with end caps + subticks */}
        <div className="relative" style={{ width, height: 12 }}>
          {/* Horizontal bar */}
          <div
            className="absolute"
            style={{ left: 0, right: 0, top: 5, height: 2, backgroundColor: '#dc2626', opacity: 0.6 }}
          />
          {/* Left end cap */}
          <div
            className="absolute left-0"
            style={{ width: 2, height: 12, backgroundColor: '#dc2626', opacity: 0.6 }}
          />
          {/* Right end cap */}
          <div
            className="absolute right-0"
            style={{ width: 2, height: 12, backgroundColor: '#dc2626', opacity: 0.6 }}
          />
          {/* Subticks */}
          {subTicks.map((x, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: x,
                top: 3,
                width: 1,
                height: 6,
                backgroundColor: '#dc2626',
                opacity: 0.3,
              }}
            />
          ))}
        </div>

        {/* Representative fraction */}
        <span
          className="font-mono text-[9px] font-bold tracking-[0.15em]"
          style={{ color: '#dc2626', opacity: 0.45, paddingTop: 3 }}
        >
          {rf}
        </span>
      </div>

      {/* Attribution (i) button — bottom right */}
      <div className="absolute bottom-2 right-2 z-20">
        <button
          onClick={() => setShowAttrib((v) => !v)}
          className="w-5 h-5 flex items-center justify-center rounded-full border-2 border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
          style={{ fontSize: 11, fontWeight: 800, fontFamily: 'serif', lineHeight: 1 }}
          title="Attribution"
        >
          i
        </button>
        {showAttrib && (
          <div className="absolute bottom-7 right-0 bg-white border-2 border-neutral-900 px-3 py-2 shadow-sm whitespace-nowrap">
            <p className="font-mono text-[9px] text-neutral-600 leading-relaxed font-semibold tracking-wide">
              &copy; CARTO &copy; OpenStreetMap
              <br />
              Overture Maps Foundation
              <br />
              MapLibre GL JS
            </p>
          </div>
        )}
      </div>
    </>
  );
}

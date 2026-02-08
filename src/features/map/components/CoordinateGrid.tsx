import { useEffect, useState, useCallback, useRef } from 'react';
import type maplibregl from 'maplibre-gl';

interface CoordinateGridProps {
  map: maplibregl.Map | null;
}

interface Tick {
  id: string;
  pos: number;
  text: string | null;
  major: boolean;
  fresh: boolean; // just appeared (for fade-in animation)
}

const MAJOR_TICK = 14;
const MINOR_TICK = 7;
const SUBS = 4;
const FADE_MS = 280;

function niceInterval(range: number): number {
  const raw = range / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm < 1.5) return mag;
  if (norm < 3.5) return 2 * mag;
  if (norm < 7.5) return 5 * mag;
  return 10 * mag;
}

function formatDeg(value: number, step: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  const str = value.toFixed(decimals);
  const clean = str.includes('.') ? str.replace(/\.?0+$/, '') : str;
  return `${clean}°`;
}

function isMajor(value: number, step: number): boolean {
  return Math.abs(value / step - Math.round(value / step)) < 0.001;
}

export function CoordinateGrid({ map }: CoordinateGridProps): React.ReactElement | null {
  const [topTicks, setTopTicks] = useState<Tick[]>([]);
  const [rightTicks, setRightTicks] = useState<Tick[]>([]);
  const initRef = useRef(false);

  // Track previous tick IDs to detect new ones (for fade-in)
  const prevTopIds = useRef(new Set<string>());
  const prevRightIds = useRef(new Set<string>());

  const update = useCallback(() => {
    if (!map) return;
    if (!initRef.current) {
      if (!map.isStyleLoaded()) return;
      initRef.current = true;
    }

    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    const latStep = niceInterval(north - south);
    const lngStep = niceInterval(east - west);
    const latSub = latStep / SUBS;
    const lngSub = lngStep / SUBS;

    const w = map.getCanvas().clientWidth;
    const h = map.getCanvas().clientHeight;

    // Top edge — latitude ticks
    const newTop: Tick[] = [];
    const seenTop = new Set<string>();
    const newTopIds = new Set<string>();
    const latStart = Math.floor(south / latSub) * latSub;
    for (let lat = latStart; lat <= north + latSub; lat += latSub) {
      if (lat < south || lat > north) continue;
      const major = isMajor(lat, latStep);
      const text = major ? formatDeg(lat, latStep) : null;
      if (major && text && seenTop.has(text)) continue;
      if (major && text) seenTop.add(text);
      const pt = map.project([west, lat]);
      const x = w * (1 - pt.y / h);
      if (x < 0 || x > w) continue;
      const id = `lat-${lat.toFixed(8)}`;
      newTopIds.add(id);
      newTop.push({ id, pos: x, text, major, fresh: !prevTopIds.current.has(id) });
    }
    prevTopIds.current = newTopIds;
    setTopTicks(newTop);

    // Right edge — longitude ticks
    const newRight: Tick[] = [];
    const seenRight = new Set<string>();
    const newRightIds = new Set<string>();
    const lngStart = Math.floor(west / lngSub) * lngSub;
    for (let lng = lngStart; lng <= east + lngSub; lng += lngSub) {
      if (lng < west || lng > east) continue;
      const major = isMajor(lng, lngStep);
      const text = major ? formatDeg(lng, lngStep) : null;
      if (major && text && seenRight.has(text)) continue;
      if (major && text) seenRight.add(text);
      const pt = map.project([lng, north]);
      const y = h * (pt.x / w);
      if (y < 0 || y > h) continue;
      const id = `lng-${lng.toFixed(8)}`;
      newRightIds.add(id);
      newRight.push({ id, pos: y, text, major, fresh: !prevRightIds.current.has(id) });
    }
    prevRightIds.current = newRightIds;
    setRightTicks(newRight);
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const init = (): void => { update(); };
    if (map.isStyleLoaded()) init();
    else map.on('load', init);

    map.on('move', update);
    map.on('resize', update);
    return () => {
      map.off('load', init);
      map.off('move', update);
      map.off('resize', update);
    };
  }, [map, update]);

  if (!map) return null;

  const tickLabelStyle = {
    color: '#dc2626',
    textShadow: '0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8)',
  };

  return (
    <>
      {/* Top edge — tick touches border, label below */}
      {topTicks.map((t) => (
        <div
          key={t.id}
          className="absolute top-0 z-20 pointer-events-none select-none flex flex-col items-center"
          style={{
            left: t.pos,
            transform: 'translateX(-50%)',
            transition: `left 100ms ease-out, opacity ${FADE_MS}ms ease-in-out`,
            opacity: 1,
            animation: t.fresh ? `fadeIn ${FADE_MS}ms ease-out` : undefined,
          }}
        >
          <div
            style={{
              width: 1,
              height: t.major ? MAJOR_TICK : MINOR_TICK,
              backgroundColor: '#dc2626',
              opacity: t.major ? 0.4 : 0.25,
            }}
          />
          {t.text != null && (
            <span
              className="font-mono text-[10px] font-semibold tracking-wide leading-none"
              style={{ ...tickLabelStyle, opacity: 0.6, paddingTop: 2 }}
            >
              {t.text}
            </span>
          )}
        </div>
      ))}
      {/* Right edge — tick touches border, label to its left */}
      {rightTicks.map((t) => (
        <div
          key={t.id}
          className="absolute right-0 z-20 pointer-events-none select-none flex flex-row items-center"
          style={{
            top: t.pos,
            transform: 'translateY(-50%)',
            transition: `top 100ms ease-out, opacity ${FADE_MS}ms ease-in-out`,
            opacity: 1,
            animation: t.fresh ? `fadeIn ${FADE_MS}ms ease-out` : undefined,
          }}
        >
          {t.text != null && (
            <span
              className="font-mono text-[10px] font-semibold tracking-wide leading-none"
              style={{ ...tickLabelStyle, opacity: 0.6, paddingRight: 2 }}
            >
              {t.text}
            </span>
          )}
          <div
            style={{
              width: t.major ? MAJOR_TICK : MINOR_TICK,
              height: 1,
              backgroundColor: '#dc2626',
              opacity: t.major ? 0.4 : 0.25,
            }}
          />
        </div>
      ))}
    </>
  );
}

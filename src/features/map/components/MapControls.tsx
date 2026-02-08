import { useCallback, useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLat } from '@/shared/types/geo';

interface MapControlsProps {
  map: maplibregl.Map | null;
  is3D: boolean;
  onToggle3D: () => void;
  onGeolocate: (lngLat: LngLat) => void;
}

const BTN_BASE = 'w-[32px] h-[32px] flex items-center justify-center cursor-pointer transition-colors';
const BTN_OFF = `${BTN_BASE} bg-white text-neutral-900 hover:bg-neutral-900 hover:text-white`;
const BTN_ON = `${BTN_BASE} bg-neutral-900 text-white hover:bg-neutral-700`;

export function MapControls({ map, is3D, onToggle3D, onGeolocate }: MapControlsProps): React.ReactElement {
  const handleZoomIn = useCallback(() => { map?.zoomIn({ duration: 200 }); }, [map]);
  const handleZoomOut = useCallback(() => { map?.zoomOut({ duration: 200 }); }, [map]);

  // Track bearing for compass rotation
  const [bearing, setBearing] = useState(0);
  useEffect(() => {
    if (!map) return;
    const onRotate = (): void => { setBearing(map.getBearing()); };
    map.on('rotate', onRotate);
    return () => { map.off('rotate', onRotate); };
  }, [map]);

  const handleResetNorth = useCallback(() => {
    map?.easeTo({ bearing: 0, pitch: 0, duration: 400 });
  }, [map]);

  // Geolocate with loading indicator
  const [isLocating, setIsLocating] = useState(false);
  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lngLat: LngLat = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        map?.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 15, duration: 1200 });
        onGeolocate(lngLat);
        setIsLocating(false);
      },
      () => { setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [map, onGeolocate]);

  return (
    <div className="absolute bottom-4 left-3 z-10 flex flex-col border-2 border-neutral-900">
      {/* Zoom In */}
      <button onClick={handleZoomIn} className={BTN_OFF} title="Zoom in">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="3" x2="8" y2="13" />
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      </button>

      {/* Zoom Out */}
      <button onClick={handleZoomOut} className={`${BTN_OFF} border-t border-neutral-200`} title="Zoom out">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      </button>

      {/* Architectural north compass — rotates with map bearing */}
      <button onClick={handleResetNorth} className={`${BTN_OFF} border-t border-neutral-200 overflow-visible`} title="Reset north">
        <svg
          width="28" height="28" viewBox="0 0 28 28" fill="none"
          style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.1s ease-out' }}
        >
          {/* Outer circle */}
          <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="0.6" />
          {/* Inner circle */}
          <circle cx="14" cy="14" r="8.5" stroke="currentColor" strokeWidth="0.4" />
          {/* Crosshair — horizontal */}
          <line x1="3" y1="14" x2="5" y2="14" stroke="currentColor" strokeWidth="0.5" />
          <line x1="23" y1="14" x2="25" y2="14" stroke="currentColor" strokeWidth="0.5" />
          {/* Crosshair — vertical (short tick below) */}
          <line x1="14" y1="23" x2="14" y2="25" stroke="currentColor" strokeWidth="0.5" />
          {/* North needle — solid black rectangle */}
          <rect x="13" y="5" width="2" height="9" fill="currentColor" />
          {/* South needle — thin line */}
          <line x1="14" y1="14" x2="14" y2="23" stroke="currentColor" strokeWidth="0.6" />
          {/* N label */}
          <text x="14" y="3.5" textAnchor="middle" fontSize="4" fontWeight="800" fontFamily="monospace" fill="currentColor">N</text>
        </svg>
      </button>

      {/* 3D Toggle */}
      <button
        onClick={onToggle3D}
        className={`${is3D ? BTN_ON : BTN_OFF} border-t border-neutral-200 font-mono text-[11px] font-bold`}
        title={is3D ? 'Switch to 2D' : 'Switch to 3D'}
      >
        3D
      </button>

      {/* Geolocate */}
      <button
        onClick={handleGeolocate}
        className={`${isLocating ? BTN_ON : BTN_OFF} border-t border-neutral-200`}
        title="Go to my location"
      >
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          className={isLocating ? 'animate-pulse' : ''}
        >
          <circle cx="8" cy="8" r="3" />
          <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
          <line x1="8" y1="1" x2="8" y2="4" />
          <line x1="8" y1="12" x2="8" y2="15" />
          <line x1="1" y1="8" x2="4" y2="8" />
          <line x1="12" y1="8" x2="15" y2="8" />
        </svg>
      </button>
    </div>
  );
}

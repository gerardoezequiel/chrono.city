import { useCallback, useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLat } from '@/shared/types/geo';

interface MapControlsProps {
  map: maplibregl.Map | null;
  is3D: boolean;
  onToggle3D: () => void;
  onGeolocate: (lngLat: LngLat) => void;
  isMobile?: boolean;
}

const BTN_BASE_D = 'w-[32px] h-[32px] flex items-center justify-center cursor-pointer transition-colors';
const BTN_BASE_M = 'w-11 h-11 flex items-center justify-center cursor-pointer transition-colors';
const BTN_OFF_D = `${BTN_BASE_D} bg-white text-neutral-900 hover:bg-neutral-900 hover:text-white`;
const BTN_ON_D = `${BTN_BASE_D} bg-neutral-900 text-white hover:bg-neutral-700`;
const BTN_OFF_M = `${BTN_BASE_M} bg-white text-neutral-900 active:bg-neutral-900 active:text-white`;
const BTN_ON_M = `${BTN_BASE_M} bg-neutral-900 text-white active:bg-neutral-700`;

export function MapControls({ map, is3D, onToggle3D, onGeolocate, isMobile }: MapControlsProps): React.ReactElement {
  const BTN_OFF = isMobile ? BTN_OFF_M : BTN_OFF_D;
  const BTN_ON = isMobile ? BTN_ON_M : BTN_ON_D;
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
        // On desktop, fly to zoom 15. On mobile, App handles fitBounds via onGeolocate.
        if (!isMobile) {
          map?.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 15, duration: 1200 });
        }
        onGeolocate(lngLat);
        setIsLocating(false);
      },
      () => { setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [map, onGeolocate]);

  const iconSize = isMobile ? 20 : 16;
  const compassSize = isMobile ? 34 : 28;

  return (
    <div className={`absolute z-10 flex flex-col border-2 border-neutral-900 ${isMobile ? 'bottom-24 right-3' : 'bottom-4 left-3'}`}>
      {/* Zoom In */}
      <button onClick={handleZoomIn} className={BTN_OFF} title="Zoom in">
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="3" x2="8" y2="13" />
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      </button>

      {/* Zoom Out */}
      <button onClick={handleZoomOut} className={`${BTN_OFF} border-t border-neutral-200`} title="Zoom out">
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      </button>

      {/* Architectural north compass — rotates with map bearing */}
      <button onClick={handleResetNorth} className={`${BTN_OFF} border-t border-neutral-200 overflow-visible`} title="Reset north">
        <svg
          width={compassSize} height={compassSize} viewBox="0 0 28 28" fill="none"
          style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.1s ease-out' }}
        >
          <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="14" cy="14" r="8.5" stroke="currentColor" strokeWidth="0.4" />
          <line x1="3" y1="14" x2="5" y2="14" stroke="currentColor" strokeWidth="0.5" />
          <line x1="23" y1="14" x2="25" y2="14" stroke="currentColor" strokeWidth="0.5" />
          <line x1="14" y1="23" x2="14" y2="25" stroke="currentColor" strokeWidth="0.5" />
          <rect x="13" y="5" width="2" height="9" fill="currentColor" />
          <line x1="14" y1="14" x2="14" y2="23" stroke="currentColor" strokeWidth="0.6" />
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
          width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
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

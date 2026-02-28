import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { MapContainer, MapControls, CoordinateGrid, ScaleBar, BuildingTooltip, MapOverlays, IsochroneLayer, useMap } from '@/features/map';
import { useIsochrone } from '@/features/isochrone';
import { useGeocoder, reverseGeocode } from '@/features/geocoder';
import type { ReverseResult } from '@/features/geocoder';
import { Sidebar } from '@/features/sections';
import type { LngLat, StudyAreaMode } from '@/shared/types/geo';
import { ISOCHRONE_PRESETS } from '@/config/constants';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { MobileSheet } from '@/shared/components/MobileSheet';

const ISOCHRONE_SVG = `<svg width="22" height="22" viewBox="0 0 16 16" fill="none">
  <path d="M8 5.5C7 5.3 6 6 5.8 7C5.6 8 6.3 8.8 7 9.3C7.7 9.8 8.5 10 9.2 9.5C10 9 10.5 8 10.3 7C10.1 6 9 5.7 8 5.5Z" stroke="currentColor" stroke-width="1.2"/>
  <path d="M8 3.5C5.8 3.2 3.8 4.5 3.4 6.5C3 8.5 4 10 5.3 11C6.5 12 8.2 12.5 9.8 11.5C11.3 10.5 12.5 8.8 12.2 6.8C11.9 4.8 10.2 3.8 8 3.5Z" stroke="currentColor" stroke-width="0.9"/>
  <path d="M8 1.5C4.8 1.1 2 3 1.5 5.8C1 8.6 2.3 10.8 4 12.2C5.7 13.6 8 14.2 10.2 13C12.5 11.8 14.2 9.2 13.8 6.2C13.4 3.2 11.2 1.9 8 1.5Z" stroke="currentColor" stroke-width="0.7"/>
</svg>`;

const PEDSHED_SVG = `<svg width="22" height="22" viewBox="0 0 16 16" fill="none">
  <circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.2"/>
  <circle cx="8" cy="8" r="4.5" stroke="currentColor" stroke-width="0.9" stroke-dasharray="2.5 1.5"/>
  <circle cx="8" cy="8" r="6.8" stroke="currentColor" stroke-width="0.7" stroke-dasharray="2.5 1.5"/>
</svg>`;

function createMarkerElement(mode: StudyAreaMode): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'width:28px;height:28px;border-radius:50%;background:white;border:2px solid #0a0a0a;box-shadow:0 1px 4px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:#0a0a0a;cursor:grab;';
  el.innerHTML = mode === 'isochrone' ? ISOCHRONE_SVG : PEDSHED_SVG;
  return el;
}

export function App(): React.ReactElement {
  const { mapRef, onMapReady } = useMap();
  const { features, status, error, compute, clear } = useIsochrone();
  const geocoder = useGeocoder();
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [reverseResult, setReverseResult] = useState<ReverseResult | null>(null);
  const [studyAreaMode, setStudyAreaMode] = useState<StudyAreaMode>('ring');
  const [customMinutes, setCustomMinutes] = useState<number | null>(null); // null = presets
  const [is3D, setIs3D] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);

  // Derive contour array: presets [5,10,15] or custom [N]
  const contours = useMemo<number[]>(
    () => customMinutes != null ? [customMinutes] : [...ISOCHRONE_PRESETS],
    [customMinutes],
  );

  const handleMapClick = useCallback((lngLat: LngLat) => {
    setOrigin(lngLat);
    setReverseResult(null);
  }, []);

  // Reverse geocode when origin changes
  useEffect(() => {
    if (!origin) { setReverseResult(null); return; }

    reverseAbortRef.current?.abort();
    const controller = new AbortController();
    reverseAbortRef.current = controller;

    reverseGeocode(origin, controller.signal).then((result) => {
      if (result) setReverseResult(result);
    });

    return () => { controller.abort(); };
  }, [origin]);

  // Trigger computation when origin or contours change
  useEffect(() => {
    if (origin) {
      compute(origin, contours);
    }
  }, [origin, contours, compute]);

  // Manage draggable origin marker with mode-specific icon.
  // Uses isDraggingRef to prevent marker recreation during active drag
  // (setOrigin triggers this effect, which would destroy the marker mid-drag).
  const isDraggingRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // During active drag, skip marker recreation — just let IsochroneLayer react to new origin
    if (isDraggingRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (origin) {
      const el = createMarkerElement(studyAreaMode);
      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);

      marker.on('dragstart', () => {
        isDraggingRef.current = true;
        setIsDragging(true);
      });

      marker.on('drag', () => {
        const pos = marker.getLngLat();
        // Both modes: update origin every frame for instant visual feedback
        // Pedshed: circles + mask + buildings react to origin
        // Isochrone: shows pedshed circle as preview (IsochroneLayer handles this)
        setOrigin({ lng: pos.lng, lat: pos.lat });
      });

      marker.on('dragend', () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        const pos = marker.getLngLat();
        const lngLat = { lng: pos.lng, lat: pos.lat };
        setOrigin(lngLat);
        // In isochrone mode, compute the real isochrone on drop
        if (studyAreaMode === 'isochrone') {
          compute(lngLat, contours);
        }
      });

      markerRef.current = marker;
    }
  }, [origin, mapRef, compute, contours, studyAreaMode]);

  const handleClear = useCallback(() => {
    setOrigin(null);
    setReverseResult(null);
    clear();
    geocoder.clear();
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [clear, geocoder]);

  const handleGeocoderSelect = useCallback((lngLat: LngLat, displayName: string) => {
    setOrigin(lngLat);
    const parts = displayName.split(',').map((s) => s.trim());
    setReverseResult({
      street: parts[0] ?? '',
      city: parts[1] ?? '',
    });
    mapRef.current?.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 15 });
  }, [mapRef]);

  const handleCustomMinutesChange = useCallback((value: number | null) => {
    setCustomMinutes(value);
  }, []);

  const handleGeolocate = useCallback((lngLat: LngLat) => {
    setOrigin(lngLat);
    setReverseResult(null);
  }, []);

  const isMobile = useIsMobile();

  const sidebarEl = (
    <Sidebar
      origin={origin}
      reverseResult={reverseResult}
      status={status}
      error={error}
      mode={studyAreaMode}
      onModeChange={setStudyAreaMode}
      customMinutes={customMinutes}
      onCustomMinutesChange={handleCustomMinutesChange}
      onClear={handleClear}
      geocoder={geocoder}
      onGeocoderSelect={handleGeocoderSelect}
      map={mapRef.current}
      isMobile={isMobile}
    />
  );

  const mapArea = (
    <>
      <MapContainer onMapReady={onMapReady} onMapClick={handleMapClick} is3D={is3D} />
      <IsochroneLayer
        map={mapRef.current}
        features={features}
        origin={origin}
        mode={studyAreaMode}
        contours={contours}
        isDragging={isDragging}
      />
      <MapControls
        map={mapRef.current}
        is3D={is3D}
        onToggle3D={() => setIs3D((v) => !v)}
        onGeolocate={handleGeolocate}
        isMobile={isMobile}
      />
      <MapOverlays isMobile={isMobile} />
      <BuildingTooltip />
      <CoordinateGrid map={mapRef.current} isMobile={isMobile} />
      <ScaleBar map={mapRef.current} isMobile={isMobile} />
    </>
  );

  if (isMobile) {
    return (
      <div className="w-full h-full relative">
        <div className="absolute inset-0">{mapArea}</div>
        <MobileSheet>{sidebarEl}</MobileSheet>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {sidebarEl}
      <div className="absolute top-0 left-[400px] right-0 bottom-0">
        {mapArea}
      </div>
    </div>
  );
}

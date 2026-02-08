import { useState, useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { MapContainer, IsochroneLayer, useMap } from '@/features/map';
import { IsochroneControls, useIsochrone } from '@/features/isochrone';
import { GeocoderInput } from '@/features/geocoder';
import type { LngLat, StudyAreaMode } from '@/shared/types/geo';

export function App(): React.ReactElement {
  const { mapRef, onMapReady } = useMap();
  const { features, status, error, compute, clear } = useIsochrone();
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [studyAreaMode, setStudyAreaMode] = useState<StudyAreaMode>('isochrone');
  const [is3D, setIs3D] = useState(false);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const handleMapClick = useCallback((lngLat: LngLat) => {
    setOrigin(lngLat);
  }, []);

  // Trigger computation when origin changes
  useEffect(() => {
    if (origin) {
      compute(origin);
    }
  }, [origin, compute]);

  // Manage draggable origin marker — update isochrone while dragging
  const lastDragRef = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (origin) {
      const marker = new maplibregl.Marker({ color: '#6366f1', draggable: true })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);

      // Throttled live update while dragging (~3 req/s)
      marker.on('drag', () => {
        const now = Date.now();
        if (now - lastDragRef.current < 300) return;
        lastDragRef.current = now;
        const pos = marker.getLngLat();
        compute({ lng: pos.lng, lat: pos.lat });
      });

      // Final precise update on release
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        setOrigin({ lng: pos.lng, lat: pos.lat });
      });

      markerRef.current = marker;
    }
  }, [origin, mapRef, compute]);

  const handleClear = useCallback(() => {
    setOrigin(null);
    clear();
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [clear]);

  const handleGeocoderSelect = useCallback((lngLat: LngLat) => {
    mapRef.current?.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 15 });
  }, [mapRef]);

  return (
    <div className="w-full h-full relative">
      <MapContainer onMapReady={onMapReady} onMapClick={handleMapClick} is3D={is3D} />
      <IsochroneLayer
        map={mapRef.current}
        features={features}
        origin={origin}
        mode={studyAreaMode}
        is3D={is3D}
      />
      <GeocoderInput onSelect={handleGeocoderSelect} />
      <button
        onClick={() => setIs3D((v) => !v)}
        className="absolute top-28 right-2.5 z-10 w-[29px] h-[29px] rounded-sm text-xs font-bold cursor-pointer transition-colors"
        style={{
          background: is3D ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.9)',
          color: is3D ? '#fff' : '#333',
          border: '1px solid rgba(0,0,0,0.15)',
        }}
        title={is3D ? 'Switch to 2D' : 'Switch to 3D'}
      >
        3D
      </button>
      <IsochroneControls
        origin={origin}
        status={status}
        error={error}
        mode={studyAreaMode}
        onModeChange={setStudyAreaMode}
        onClear={handleClear}
      />
    </div>
  );
}

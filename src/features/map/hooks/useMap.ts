import { useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

interface UseMapReturn {
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  isReady: boolean;
  onMapReady: (map: maplibregl.Map) => void;
}

export function useMap(): UseMapReturn {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isReady, setIsReady] = useState(false);

  const onMapReady = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setIsReady(true);
  }, []);

  return { mapRef, isReady, onMapReady };
}

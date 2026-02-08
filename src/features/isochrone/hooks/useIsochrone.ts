import { useState, useCallback, useRef } from 'react';
import type { Feature, Polygon } from 'geojson';
import type { LngLat } from '@/shared/types/geo';
import { ISOCHRONE_PRESETS } from '@/config/constants';

const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de';

type IsochroneStatus = 'idle' | 'fetching' | 'done' | 'error';

interface UseIsochroneReturn {
  features: Feature<Polygon>[];
  status: IsochroneStatus;
  error: string | null;
  compute: (origin: LngLat) => Promise<void>;
  clear: () => void;
}

export function useIsochrone(): UseIsochroneReturn {
  const [features, setFeatures] = useState<Feature<Polygon>[]>([]);
  const [status, setStatus] = useState<IsochroneStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const compute = useCallback(async (origin: LngLat) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setStatus('fetching');
      setError(null);

      const params = {
        locations: [{ lat: origin.lat, lon: origin.lng }],
        costing: 'pedestrian',
        contours: ISOCHRONE_PRESETS.map((time) => ({ time })),
        polygons: true,
        denoise: 1,
        generalize: 0,
      };

      const url = `${VALHALLA_BASE}/isochrone?json=${encodeURIComponent(JSON.stringify(params))}`;
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Valhalla error ${res.status}: ${body}`);
      }

      const geojson = await res.json() as GeoJSON.FeatureCollection;
      const polys = geojson.features.filter(
        (f): f is Feature<Polygon> => f.geometry.type === 'Polygon'
      );

      setFeatures(polys);
      setStatus('done');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Isochrone computation failed');
      setFeatures([]);
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setFeatures([]);
    setStatus('idle');
    setError(null);
  }, []);

  return { features, status, error, compute, clear };
}

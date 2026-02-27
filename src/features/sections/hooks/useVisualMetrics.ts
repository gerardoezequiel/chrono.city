import { useState, useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLat } from '@/shared/types/geo';

export interface VisualMetrics {
  /** Approximate building count from rendered tiles */
  buildingCount: number;
  /** Approximate POI count from rendered tiles */
  poiCount: number;
}

const EMPTY: VisualMetrics = { buildingCount: 0, poiCount: 0 };
const THROTTLE_MS = 100;

/**
 * Fast approximate metrics from queryRenderedFeatures.
 * Used for real-time visual feedback during pedshed drag.
 * NOT used for final analytics (DuckDB provides exact numbers).
 */
export function useVisualMetrics(
  map: maplibregl.Map | null,
  origin: LngLat | null,
): VisualMetrics {
  const [metrics, setMetrics] = useState<VisualMetrics>(EMPTY);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!map || !origin) {
      setMetrics(EMPTY);
      return;
    }

    const compute = (): void => {
      const now = Date.now();
      if (now - lastRef.current < THROTTLE_MS) return;
      lastRef.current = now;

      let buildingCount = 0;
      let poiCount = 0;

      // Count unique buildings in rendered tiles
      const buildingLayers = ['buildings-fill', 'buildings-inside-fill'].filter(
        (id) => !!map.getLayer(id),
      );
      if (buildingLayers.length > 0) {
        const seen = new Set<string | number>();
        const features = map.queryRenderedFeatures(undefined as unknown as maplibregl.PointLike, {
          layers: buildingLayers,
        });
        for (const f of features) {
          if (f.id != null && !seen.has(f.id)) {
            seen.add(f.id);
            buildingCount++;
          }
        }
      }

      // Count POIs
      if (map.getLayer('places-dots')) {
        const pois = map.queryRenderedFeatures(undefined as unknown as maplibregl.PointLike, {
          layers: ['places-dots'],
        });
        poiCount = pois.length;
      }

      setMetrics({ buildingCount, poiCount });
    };

    compute();
    map.on('moveend', compute);
    map.on('idle', compute);

    return () => {
      map.off('moveend', compute);
      map.off('idle', compute);
    };
  }, [map, origin]);

  return metrics;
}

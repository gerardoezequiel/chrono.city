import { useState, useEffect, useCallback, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLat } from '@/shared/types/geo';
import type { DataState } from '@/shared/types/metrics';
import type { KonturH3Properties } from '@/shared/types/kontur';
import { KONTUR_LAYER_NAME } from '@/config/kontur';

interface KonturCellResult {
  cell: KonturH3Properties | null;
  state: DataState;
}

/**
 * Queries Kontur MVT tiles for the H3 cell containing the given origin point.
 * Listens for `sourcedata` events to re-query when tiles finish loading.
 * Pass `enabled=false` to skip queries (e.g. during marker drag).
 */
export function useKonturCell(
  map: maplibregl.Map | null,
  origin: LngLat | null,
  enabled = true,
): KonturCellResult {
  const [cell, setCell] = useState<KonturH3Properties | null>(null);
  const [state, setState] = useState<DataState>('idle');
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useCallback(() => {
    if (!map || !origin) {
      setCell(null);
      setState('idle');
      return;
    }

    setState('loading');

    try {
      const features = map.querySourceFeatures('kontur', {
        sourceLayer: KONTUR_LAYER_NAME,
      });

      if (features.length === 0) {
        // Tiles may not be loaded yet — stay in loading
        return;
      }

      // Find the cell nearest to origin by projected screen distance.
      const point = map.project([origin.lng, origin.lat]);
      let best: maplibregl.GeoJSONFeature | null = null;
      let bestDist = Infinity;

      for (const f of features) {
        const geom = f.geometry;
        if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          const coords = geom.type === 'Polygon'
            ? geom.coordinates[0]
            : geom.coordinates[0]?.[0];
          if (!coords) continue;

          // Rough centroid distance
          let cx = 0, cy = 0;
          const n = coords.length - 1;
          for (let i = 0; i < n; i++) {
            const c = coords[i];
            if (c) { cx += c[0] ?? 0; cy += c[1] ?? 0; }
          }
          if (n > 0) { cx /= n; cy /= n; }

          const projected = map.project([cx, cy]);
          const dx = projected.x - point.x;
          const dy = projected.y - point.y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = f;
          }
        }
      }

      if (best) {
        const newProps = best.properties as unknown as KonturH3Properties;
        setCell((prev) => {
          const prevH3 = prev ? (prev as unknown as Record<string, unknown>)['h3'] : null;
          const newH3 = (newProps as unknown as Record<string, unknown>)['h3'];
          return newH3 === prevH3 ? prev : newProps;
        });
        setState('loaded');
      }
    } catch (e) {
      console.warn('[useKonturCell] query failed:', e);
      setState('error');
    }
  }, [map, origin]);

  // Query on origin change and when tiles load (skip when disabled)
  useEffect(() => {
    if (!map || !origin || !enabled) {
      if (!origin) { setCell(null); setState('idle'); }
      return;
    }

    // Initial query
    query();

    // Re-query when kontur tiles finish loading
    const onSourceData = (e: maplibregl.MapSourceDataEvent): void => {
      if (e.sourceId === 'kontur' && e.isSourceLoaded) {
        // Debounce slightly to batch multiple tile loads
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(query, 100);
      }
    };

    map.on('sourcedata', onSourceData);
    return () => {
      map.off('sourcedata', onSourceData);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [map, origin, query, enabled]);

  return { cell, state };
}

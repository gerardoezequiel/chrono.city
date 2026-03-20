import { useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import { KONTUR_LAYER_NAME, KONTUR_TILE_URL } from '@/config/kontur';

interface KonturLayerProps {
  map: maplibregl.Map | null;
  visible: boolean;
}

const KONTUR_BUILDING_DENSITY_ID = 'kontur-building-density';
const KONTUR_POP_DENSITY_ID = 'kontur-pop-density';

const ALL_KONTUR_LAYERS = [KONTUR_BUILDING_DENSITY_ID, KONTUR_POP_DENSITY_ID];

function ensureKonturLayers(map: maplibregl.Map): boolean {
  if (map.getLayer(KONTUR_BUILDING_DENSITY_ID)) return true;

  try {
    // Insert below building layers
    const firstBuildingLayer = map.getStyle().layers?.find(
      (l) => l.id.startsWith('buildings-'),
    )?.id;

    console.log('[KonturLayer] Adding layers. beforeId:', firstBuildingLayer);

    // Building density — warm ramp by building count per H3 cell
    // coalesce tries multiple property name variants (Kontur API naming varies)
    map.addLayer(
      {
        id: KONTUR_BUILDING_DENSITY_ID,
        type: 'fill',
        source: 'kontur',
        'source-layer': KONTUR_LAYER_NAME,
        minzoom: 3,
        maxzoom: 13,
        paint: {
          'fill-color': [
            'interpolate', ['linear'],
            ['coalesce', ['get', 'all_buildings_count'], ['get', 'building_count'], ['get', 'total_building_count'], 0],
            0,    '#fef9f2',
            10,   '#fde8cd',
            50,   '#f5c99d',
            200,  '#e8a76c',
            500,  '#d4854a',
            2000, '#b05e2a',
            5000, '#8b3e15',
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'],
            3, 0.4,
            6, 0.55,
            9, 0.6,
            11, 0.45,
            12, 0.25,
            13, 0,
          ],
        },
      },
      firstBuildingLayer,
    );

    // Population density — grey tint for settlement context (below building density)
    map.addLayer(
      {
        id: KONTUR_POP_DENSITY_ID,
        type: 'fill',
        source: 'kontur',
        'source-layer': KONTUR_LAYER_NAME,
        minzoom: 3,
        maxzoom: 12,
        paint: {
          'fill-color': [
            'interpolate', ['linear'],
            ['coalesce', ['get', 'population_density'], ['get', 'population'], 0],
            0,     '#f5f5f5',
            50,    '#d4d4d4',
            200,   '#a3a3a3',
            1000,  '#737373',
            5000,  '#525252',
            20000, '#262626',
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'],
            3, 0.2,
            6, 0.3,
            9, 0.25,
            11, 0.15,
            12, 0,
          ],
        },
      },
      KONTUR_BUILDING_DENSITY_ID,
    );

    console.log('[KonturLayer] Layers added successfully');
    return true;
  } catch (e) {
    console.warn('[KonturLayer] ensureKonturLayers failed:', e);
    return false;
  }
}

export function KonturLayer({ map, visible }: KonturLayerProps): null {
  // Diagnose: check if kontur tiles actually load
  useEffect(() => {
    if (!map) return;

    // Test tile connectivity
    const testUrl = KONTUR_TILE_URL.replace('{z}', '3').replace('{x}', '4').replace('{y}', '3');
    console.log('[KonturLayer] Testing tile URL:', testUrl);
    fetch(testUrl, { mode: 'cors' })
      .then((r) => {
        console.log(`[KonturLayer] Tile fetch: ${r.status} ${r.statusText}, type: ${r.headers.get('content-type')}, size: ${r.headers.get('content-length')}`);
      })
      .catch((e) => {
        console.error('[KonturLayer] Tile fetch FAILED — tiles will not render:', e);
      });

    // Listen for source load events
    const onSourceData = (e: maplibregl.MapSourceDataEvent): void => {
      if (e.sourceId !== 'kontur') return;
      if (e.isSourceLoaded) {
        const features = map.querySourceFeatures('kontur', { sourceLayer: KONTUR_LAYER_NAME });
        console.log(`[KonturLayer] Source loaded. Features: ${features.length}`);
        if (features.length > 0) {
          const sample = features[0];
          console.log('[KonturLayer] Sample feature properties:', JSON.stringify(sample?.properties, null, 2));
          console.log('[KonturLayer] Sample geometry type:', sample?.geometry?.type);
        }
      }
    };

    const onError = (e: unknown): void => {
      const err = e as { sourceId?: string; error?: { message?: string } };
      if (err.sourceId === 'kontur') {
        console.error('[KonturLayer] Source error:', err.error?.message ?? err);
      }
    };

    map.on('sourcedata', onSourceData);
    map.on('error', onError);
    return () => {
      map.off('sourcedata', onSourceData);
      map.off('error', onError);
    };
  }, [map]);

  // Add layers when map is ready
  useEffect(() => {
    if (!map) return;
    if (map.isStyleLoaded()) {
      ensureKonturLayers(map);
    } else {
      const onLoad = (): void => { ensureKonturLayers(map); };
      map.on('load', onLoad);
      return () => { map.off('load', onLoad); };
    }
  }, [map]);

  // Toggle visibility
  useEffect(() => {
    if (!map || !ensureKonturLayers(map)) return;
    const vis = visible ? 'visible' : 'none';
    for (const id of ALL_KONTUR_LAYERS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }, [map, visible]);

  return null;
}

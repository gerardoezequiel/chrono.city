import { useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import { KONTUR_LAYER_NAME } from '@/config/kontur';

interface KonturLayerProps {
  map: maplibregl.Map | null;
  visible: boolean;
}

const KONTUR_DENSITY_ID = 'kontur-density';
const KONTUR_LAND_CLASS_ID = 'kontur-land-class';

/**
 * Land classification taxonomy (6-class, from wurman-maps).
 * Maps built_up_share / trees+grass / commercial / industrial thresholds
 * to a simplified color tint for district-scale context.
 */
const LAND_CLASS_COLORS = {
  residential: '#c9a9a9',   // warm muted rose
  green: '#a9c9a9',         // soft sage
  commercial: '#a9b8c9',    // steel blue-grey
  industrial: '#b8a9c9',    // lavender grey
  institutional: '#c9c0a9', // warm tan
  water: '#a9bfc9',         // pale teal
} as const;

function ensureKonturLayers(map: maplibregl.Map): boolean {
  if (map.getLayer(KONTUR_DENSITY_ID)) return true;

  try {
    // Insert below building layers — find first building layer
    const firstBuildingLayer = map.getStyle().layers?.find(
      (l) => l.id.startsWith('buildings-'),
    )?.id;

    // Population density choropleth — H3 fill
    map.addLayer(
      {
        id: KONTUR_DENSITY_ID,
        type: 'fill',
        source: 'kontur',
        'source-layer': KONTUR_LAYER_NAME,
        minzoom: 3,
        maxzoom: 12,
        paint: {
          'fill-color': [
            'interpolate', ['linear'],
            ['coalesce', ['get', 'population_density'], 0],
            0,     '#f5f5f5',
            50,    '#d4d4d4',
            200,   '#a3a3a3',
            1000,  '#737373',
            5000,  '#525252',
            20000, '#262626',
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'],
            3, 0.15,
            6, 0.25,
            9, 0.3,
            11, 0.15,
            12, 0,
          ],
        },
      },
      firstBuildingLayer,
    );

    // Land classification tint — subtle underlay
    map.addLayer(
      {
        id: KONTUR_LAND_CLASS_ID,
        type: 'fill',
        source: 'kontur',
        'source-layer': KONTUR_LAYER_NAME,
        minzoom: 5,
        maxzoom: 12,
        paint: {
          'fill-color': [
            'case',
            // Water-dominated
            ['>=', ['coalesce', ['get', 'water_share'], 0], 0.5],
            LAND_CLASS_COLORS.water,
            // Green-dominated (trees + grass > 50%)
            ['>=', ['+',
              ['coalesce', ['get', 'trees_share'], 0],
              ['coalesce', ['get', 'grass_share'], 0],
            ], 0.5],
            LAND_CLASS_COLORS.green,
            // Industrial
            ['>=', ['coalesce', ['get', 'industrial_buildings_count'], 0], 5],
            LAND_CLASS_COLORS.industrial,
            // Commercial
            ['>=', ['coalesce', ['get', 'commercial_buildings_count'], 0], 10],
            LAND_CLASS_COLORS.commercial,
            // Institutional (education + health + public service)
            ['>=', ['+',
              ['coalesce', ['get', 'education_count'], 0],
              ['coalesce', ['get', 'health_count'], 0],
              ['coalesce', ['get', 'public_service_count'], 0],
            ], 5],
            LAND_CLASS_COLORS.institutional,
            // Default: residential
            LAND_CLASS_COLORS.residential,
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'],
            5, 0.08,
            8, 0.12,
            10, 0.1,
            12, 0,
          ],
        },
      },
      KONTUR_DENSITY_ID,
    );

    return true;
  } catch (e) {
    console.warn('[KonturLayer] ensureKonturLayers failed:', e);
    return false;
  }
}

export function KonturLayer({ map, visible }: KonturLayerProps): null {
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
    for (const id of [KONTUR_DENSITY_ID, KONTUR_LAND_CLASS_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }, [map, visible]);

  return null;
}

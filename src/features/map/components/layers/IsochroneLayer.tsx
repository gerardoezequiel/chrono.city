import { useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';
import type { LngLat, StudyAreaMode } from '@/shared/types/geo';
import { ISOCHRONE_PRESETS } from '@/config/constants';

const ISO_SOURCE = 'isochrone-source';
const PED_SOURCE = 'pedshed-source';
const GLOW_SOURCE = 'study-area-glow';
const MASK_SOURCE = 'study-area-mask';
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Ring styling
const RING_COLORS: Record<number, string> = { 5: '#a5b4fc', 10: '#818cf8', 15: '#6366f1' };
const RING_WIDTHS: Record<number, number> = { 5: 3, 10: 2.5, 15: 2 };

// Geometry
const WALK_M_PER_MIN = 83.33;
const CIRCLE_SEGMENTS = 64;
const DEG_PER_METER_LAT = 1 / 111_139;

// World bounds for inverted mask (outer ring)
const WORLD: [number, number][] = [
  [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
];

interface IsochroneLayerProps {
  map: maplibregl.Map | null;
  features: Feature<Polygon>[];
  origin: LngLat | null;
  mode: StudyAreaMode;
  is3D: boolean;
}

function makeCircle(center: LngLat, radiusM: number, contour: number): Feature<Polygon> {
  const dLat = radiusM * DEG_PER_METER_LAT;
  const dLng = dLat / Math.cos(center.lat * Math.PI / 180);
  const coords: [number, number][] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const angle = (2 * Math.PI * i) / CIRCLE_SEGMENTS;
    coords.push([center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)]);
  }
  return { type: 'Feature', properties: { contour }, geometry: { type: 'Polygon', coordinates: [coords] } };
}

function getStudyAreaGeometry(
  origin: LngLat, features: Feature<Polygon>[], mode: StudyAreaMode,
): GeoJSON.Polygon | null {
  if (mode === 'ring' || mode === 'both') return makeCircle(origin, 15 * WALK_M_PER_MIN, 15).geometry;
  const outermost = features.find((f) => f.properties?.contour === 15) ?? features[features.length - 1];
  return outermost?.geometry ?? null;
}

/** Create inverted mask: world polygon with study area cut out as a hole */
function makeInvertedMask(hole: GeoJSON.Polygon): GeoJSON.Feature<GeoJSON.Polygon> {
  const reversedRings = hole.coordinates.map((ring) => [...ring].reverse());
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [WORLD, ...reversedRings] },
  };
}

/**
 * Idempotent layer setup — safe to call multiple times.
 * Each source/layer is checked individually before adding.
 * Returns true if all layers are ready.
 */
function ensureLayers(map: maplibregl.Map): boolean {
  // Fast path: everything already set up
  if (map.getLayer('isochrone-labels')) return true;

  try {
    // Sources (idempotent)
    if (!map.getSource(GLOW_SOURCE)) map.addSource(GLOW_SOURCE, { type: 'geojson', data: EMPTY_FC });
    if (!map.getSource(MASK_SOURCE)) map.addSource(MASK_SOURCE, { type: 'geojson', data: EMPTY_FC });
    if (!map.getSource(PED_SOURCE)) map.addSource(PED_SOURCE, { type: 'geojson', data: EMPTY_FC });
    if (!map.getSource(ISO_SOURCE)) map.addSource(ISO_SOURCE, { type: 'geojson', data: EMPTY_FC });

    // Layers — added bottom to top (each checked individually)
    if (!map.getLayer('study-area-glow')) {
      map.addLayer({
        id: 'study-area-glow', type: 'fill', source: GLOW_SOURCE,
        paint: { 'fill-color': '#1e1e55', 'fill-opacity': 0.6 },
      }, map.getLayer('buildings-fill') ? 'buildings-fill' : undefined);
    }

    if (!map.getLayer('study-area-mask')) {
      map.addLayer({
        id: 'study-area-mask', type: 'fill', source: MASK_SOURCE,
        paint: { 'fill-color': '#0a0a0f', 'fill-opacity': 0.82 },
      });
    }

    if (!map.getLayer('pedshed-line')) {
      map.addLayer({
        id: 'pedshed-line', type: 'line', source: PED_SOURCE,
        paint: {
          'line-color': ['match', ['get', 'contour'],
            5, RING_COLORS[5]!, 10, RING_COLORS[10]!, 15, RING_COLORS[15]!, '#6366f1',
          ],
          'line-width': ['match', ['get', 'contour'],
            5, RING_WIDTHS[5]!, 10, RING_WIDTHS[10]!, 15, RING_WIDTHS[15]!, 1,
          ],
          'line-dasharray': [4, 4],
        },
      });
    }

    if (!map.getLayer('pedshed-labels')) {
      map.addLayer({
        id: 'pedshed-labels', type: 'symbol', source: PED_SOURCE,
        layout: {
          'symbol-placement': 'line', 'symbol-spacing': 250,
          'text-field': ['concat', ['to-string', ['get', 'contour']], ' min'],
          'text-size': 10, 'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
          'text-letter-spacing': 0.1, 'text-anchor': 'center', 'text-keep-upright': true,
        },
        paint: {
          'text-color': 'rgba(255,255,255,0.85)',
          'text-halo-color': 'rgba(10,10,15,0.9)', 'text-halo-width': 2,
        },
      });
    }

    if (!map.getLayer('isochrone-line')) {
      map.addLayer({
        id: 'isochrone-line', type: 'line', source: ISO_SOURCE,
        paint: { 'line-color': '#818cf8', 'line-opacity': 1, 'line-width': 2.5 },
      });
    }

    if (!map.getLayer('isochrone-labels')) {
      map.addLayer({
        id: 'isochrone-labels', type: 'symbol', source: ISO_SOURCE,
        layout: {
          'symbol-placement': 'line', 'symbol-spacing': 200,
          'text-field': ['concat', ['to-string', ['get', 'contour']], ' min'],
          'text-size': 11, 'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
          'text-letter-spacing': 0.1, 'text-anchor': 'center', 'text-keep-upright': true,
        },
        paint: {
          'text-color': 'rgba(255,255,255,0.85)',
          'text-halo-color': 'rgba(10,10,15,0.9)', 'text-halo-width': 2,
        },
      });
    }

    return true;
  } catch (e) {
    console.warn('[IsochroneLayer] ensureLayers failed:', e);
    return false;
  }
}

const PED_LAYERS = ['pedshed-line', 'pedshed-labels'] as const;
const ISO_LAYERS = ['isochrone-line', 'isochrone-labels'] as const;

function setVis(map: maplibregl.Map, ids: readonly string[], visible: boolean): void {
  for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function IsochroneLayer({ map, features, origin, mode, is3D }: IsochroneLayerProps): null {
  // Init sources + layers on map ready
  useEffect(() => {
    if (!map) return;
    if (map.isStyleLoaded()) {
      ensureLayers(map);
    } else {
      const onLoad = (): void => { ensureLayers(map); };
      map.on('load', onLoad);
      return () => { map.off('load', onLoad); };
    }
  }, [map]);

  // Toggle ring/isochrone line visibility
  useEffect(() => {
    if (!map || !ensureLayers(map)) return;
    setVis(map, PED_LAYERS, mode === 'ring' || mode === 'both');
    setVis(map, ISO_LAYERS, mode === 'isochrone' || mode === 'both');
  }, [map, mode]);

  // Spotlight: glow inside + mask outside
  useEffect(() => {
    if (!map || !ensureLayers(map)) return;
    const glowSrc = map.getSource(GLOW_SOURCE) as maplibregl.GeoJSONSource | undefined;
    const maskSrc = map.getSource(MASK_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (!origin) {
      glowSrc?.setData(EMPTY_FC);
      maskSrc?.setData(EMPTY_FC);
      return;
    }

    const area = getStudyAreaGeometry(origin, features, mode);
    if (!area) { glowSrc?.setData(EMPTY_FC); maskSrc?.setData(EMPTY_FC); return; }

    glowSrc?.setData({ type: 'Feature', properties: {}, geometry: area });
    maskSrc?.setData(makeInvertedMask(area));
  }, [map, mode, features, origin]);

  // Dim 3D buildings outside study area (mask only covers 2D layers)
  useEffect(() => {
    if (!map || !map.getLayer('buildings-3d')) return;
    map.setPaintProperty('buildings-3d', 'fill-extrusion-opacity', (is3D && origin) ? 0.3 : 0.95);
  }, [map, is3D, origin]);

  // Update isochrone data
  useEffect(() => {
    if (!map || !ensureLayers(map)) return;
    const src = map.getSource(ISO_SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData(features.length > 0 ? { type: 'FeatureCollection', features } : EMPTY_FC);
  }, [map, features]);

  // Update pedshed circles
  useEffect(() => {
    if (!map || !ensureLayers(map)) return;
    const src = map.getSource(PED_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!origin) { src.setData(EMPTY_FC); return; }
    const circles = ISOCHRONE_PRESETS.map((m) => makeCircle(origin, m * WALK_M_PER_MIN, m));
    src.setData({ type: 'FeatureCollection', features: circles });
  }, [map, origin]);

  return null;
}

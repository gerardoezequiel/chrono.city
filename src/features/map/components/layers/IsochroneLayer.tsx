import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';
import type { LngLat, StudyAreaMode } from '@/shared/types/geo';

const ISO_SOURCE = 'isochrone-source';
const PED_SOURCE = 'pedshed-source';
const MASK_SOURCE = 'study-area-mask';
const RADIUS_SOURCE = 'radius-source';
const RADIUS_LABEL_SOURCE = 'radius-label-source';
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Monochrome contour styling — high contrast, clear differentiation
const CONTOUR_COLORS: Record<number, string> = { 5: '#0a0a0a', 10: '#525252', 15: '#a3a3a3' };
const CONTOUR_WIDTHS: Record<number, number> = { 5: 3, 10: 2.5, 15: 2 };
const DEFAULT_COLOR = '#0a0a0a';
const DEFAULT_WIDTH = 2.5;

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
  contours: number[];
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

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}


/** Build a radius line from origin at a screen-horizontal azimuth for a given distance in meters */
function makeRadiusLine(
  origin: LngLat, distM: number, contour: number, bearingDeg: number,
): GeoJSON.Feature<GeoJSON.LineString> {
  const azRad = ((90 + bearingDeg) * Math.PI) / 180;
  const cosLat = Math.cos(origin.lat * Math.PI / 180);
  const dLat = distM * Math.cos(azRad) * DEG_PER_METER_LAT;
  const dLng = distM * Math.sin(azRad) * DEG_PER_METER_LAT / cosLat;
  return {
    type: 'Feature',
    properties: { contour, distance: formatDistance(distM) },
    geometry: {
      type: 'LineString',
      coordinates: [[origin.lng, origin.lat], [origin.lng + dLng, origin.lat + dLat]],
    },
  };
}

/** Build a Point feature at the endpoint of a radius line for label placement at contour edge */
function makeRadiusLabelPoint(
  origin: LngLat, distM: number, contour: number, bearingDeg: number,
): GeoJSON.Feature<GeoJSON.Point> {
  const azRad = ((90 + bearingDeg) * Math.PI) / 180;
  const cosLat = Math.cos(origin.lat * Math.PI / 180);
  const dLat = distM * Math.cos(azRad) * DEG_PER_METER_LAT;
  const dLng = distM * Math.sin(azRad) * DEG_PER_METER_LAT / cosLat;
  return {
    type: 'Feature',
    properties: { contour, distance: formatDistance(distM) },
    geometry: {
      type: 'Point',
      coordinates: [origin.lng + dLng, origin.lat + dLat],
    },
  };
}

/** Cast a ray from origin at a given azimuth and find the nearest polygon ring intersection distance in meters */
function findEdgeDistAtAzimuth(origin: LngLat, ring: number[][], azimuthDeg: number): number | null {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const cosLat = Math.cos(origin.lat * Math.PI / 180);
  // Ray direction in degrees (lng, lat)
  const dirLng = Math.sin(azRad) * DEG_PER_METER_LAT / cosLat;
  const dirLat = Math.cos(azRad) * DEG_PER_METER_LAT;

  let minT = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]; const pj = ring[j];
    if (!pi || !pj) continue;
    // Segment from pj to pi
    const sx = (pj[0] ?? 0) - origin.lng;
    const sy = (pj[1] ?? 0) - origin.lat;
    const dx = (pi[0] ?? 0) - (pj[0] ?? 0);
    const dy = (pi[1] ?? 0) - (pj[1] ?? 0);
    // Solve: origin + t * dir = pj + u * (pi - pj)
    const denom = dirLng * dy - dirLat * dx;
    if (Math.abs(denom) < 1e-15) continue;
    const t = (sx * dy - sy * dx) / denom;
    const u = (sx * dirLat - sy * dirLng) / denom;
    if (t > 0.001 && u >= 0 && u <= 1 && t < minT) minT = t;
  }
  return minT === Infinity ? null : minT; // t is in meters (since dir is per-meter)
}

function getStudyAreaGeometry(
  origin: LngLat, features: Feature<Polygon>[], mode: StudyAreaMode, contours: number[],
): GeoJSON.Polygon | null {
  const maxMinutes = Math.max(...contours);
  if (mode === 'ring') return makeCircle(origin, maxMinutes * WALK_M_PER_MIN, maxMinutes).geometry;
  // Valhalla returns contours largest-first — find the one with max contour value
  let outermost: Feature<Polygon> | undefined;
  let maxContour = -1;
  for (const f of features) {
    const c = (f.properties?.contour as number) ?? 0;
    if (c > maxContour) { maxContour = c; outermost = f; }
  }
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

/** Ray-casting point-in-polygon test */
function pointInPolygon(pt: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ri = ring[i]; const rj = ring[j];
    if (!ri || !rj) continue;
    const xi = ri[0] ?? 0, yi = ri[1] ?? 0;
    const xj = rj[0] ?? 0, yj = rj[1] ?? 0;
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Rough centroid from polygon outer ring */
function roughCentroid(feature: maplibregl.MapGeoJSONFeature): [number, number] {
  const geom = feature.geometry;
  const ring: number[][] | undefined = geom.type === 'Polygon' ? geom.coordinates[0]
    : geom.type === 'MultiPolygon' ? geom.coordinates[0]?.[0]
    : undefined;
  if (!ring || ring.length < 2) return [0, 0];
  let x = 0, y = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) { const p = ring[i]; if (p) { x += p[0] ?? 0; y += p[1] ?? 0; } }
  return [x / n, y / n];
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
    if (!map.getSource(MASK_SOURCE)) map.addSource(MASK_SOURCE, { type: 'geojson', data: EMPTY_FC });
    if (!map.getSource(PED_SOURCE)) map.addSource(PED_SOURCE, { type: 'geojson', data: EMPTY_FC });
    if (!map.getSource(ISO_SOURCE)) map.addSource(ISO_SOURCE, { type: 'geojson', data: EMPTY_FC });
    if (!map.getSource(RADIUS_SOURCE)) map.addSource(RADIUS_SOURCE, { type: 'geojson', data: EMPTY_FC });
    if (!map.getSource(RADIUS_LABEL_SOURCE)) map.addSource(RADIUS_LABEL_SOURCE, { type: 'geojson', data: EMPTY_FC });

    // Inverted mask: dims everything outside study area
    if (!map.getLayer('study-area-mask')) {
      map.addLayer({
        id: 'study-area-mask', type: 'fill', source: MASK_SOURCE,
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.72 },
      });
    }

    // Buildings promoted above mask — centroid inside study area = fully visible (not clipped)
    if (!map.getLayer('buildings-inside-fill')) {
      map.addLayer({
        id: 'buildings-inside-fill', type: 'fill', source: 'buildings', 'source-layer': 'building',
        paint: {
          'fill-color': '#737373',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'inside'], false], 0.7, 0],
        },
      });
    }
    if (!map.getLayer('buildings-inside-outline')) {
      map.addLayer({
        id: 'buildings-inside-outline', type: 'line', source: 'buildings', 'source-layer': 'building',
        minzoom: 13,
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'inside'], false], '#525252', 'transparent'],
          'line-width': ['case', ['boolean', ['feature-state', 'inside'], false], 0.8, 0],
        },
      });
    }

    // Pedshed rings
    if (!map.getLayer('pedshed-line')) {
      map.addLayer({
        id: 'pedshed-line', type: 'line', source: PED_SOURCE,
        paint: {
          'line-color': ['match', ['get', 'contour'],
            5, CONTOUR_COLORS[5]!, 10, CONTOUR_COLORS[10]!, 15, CONTOUR_COLORS[15]!, DEFAULT_COLOR,
          ],
          'line-width': ['match', ['get', 'contour'],
            5, CONTOUR_WIDTHS[5]!, 10, CONTOUR_WIDTHS[10]!, 15, CONTOUR_WIDTHS[15]!, DEFAULT_WIDTH,
          ],
          'line-dasharray': [4, 4],
        },
      });
    }

    if (!map.getLayer('pedshed-labels')) {
      map.addLayer({
        id: 'pedshed-labels', type: 'symbol', source: PED_SOURCE,
        layout: {
          'symbol-placement': 'line', 'symbol-spacing': 400,
          'text-field': ['concat', ['to-string', ['get', 'contour']], ' min'],
          'text-size': 12, 'text-font': ['Open Sans Bold'],
          'text-letter-spacing': 0.08, 'text-anchor': 'center', 'text-keep-upright': true,
          'text-padding': 20,
        },
        paint: {
          'text-color': '#0a0a0a',
          'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 4, 'text-halo-blur': 1,
        },
      });
    }

    // Isochrone lines
    if (!map.getLayer('isochrone-line')) {
      map.addLayer({
        id: 'isochrone-line', type: 'line', source: ISO_SOURCE,
        paint: {
          'line-color': ['match', ['get', 'contour'],
            5, CONTOUR_COLORS[5]!, 10, CONTOUR_COLORS[10]!, 15, CONTOUR_COLORS[15]!, DEFAULT_COLOR,
          ],
          'line-width': ['match', ['get', 'contour'],
            5, CONTOUR_WIDTHS[5]!, 10, CONTOUR_WIDTHS[10]!, 15, CONTOUR_WIDTHS[15]!, DEFAULT_WIDTH,
          ],
          'line-opacity': 1,
        },
      });
    }

    if (!map.getLayer('isochrone-labels')) {
      map.addLayer({
        id: 'isochrone-labels', type: 'symbol', source: ISO_SOURCE,
        layout: {
          'symbol-placement': 'line', 'symbol-spacing': 400,
          'text-field': ['concat', ['to-string', ['get', 'contour']], ' min'],
          'text-size': 12, 'text-font': ['Open Sans Bold'],
          'text-letter-spacing': 0.08, 'text-anchor': 'center', 'text-keep-upright': true,
          'text-padding': 20,
        },
        paint: {
          'text-color': '#0a0a0a',
          'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 4, 'text-halo-blur': 1,
        },
      });
    }

    // Radius lines — horizontal from origin eastward
    if (!map.getLayer('radius-line')) {
      map.addLayer({
        id: 'radius-line', type: 'line', source: RADIUS_SOURCE,
        paint: {
          'line-color': '#0a0a0a',
          'line-width': 1.2,
          'line-dasharray': [3, 4],
          'line-opacity': 0.5,
        },
      });
    }

    if (!map.getLayer('radius-labels')) {
      map.addLayer({
        id: 'radius-labels', type: 'symbol', source: RADIUS_LABEL_SOURCE,
        layout: {
          'symbol-placement': 'point',
          'text-field': ['get', 'distance'],
          'text-size': 12,
          'text-font': ['Open Sans Bold'],
          'text-letter-spacing': 0.04,
          'text-anchor': 'left',
          'text-offset': [0.5, 0],
          'text-rotation-alignment': 'viewport',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#0a0a0a',
          'text-halo-color': 'rgba(255,255,255,0.94)',
          'text-halo-width': 6,
          'text-halo-blur': 0.5,
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

export function IsochroneLayer({ map, features, origin, mode, contours }: IsochroneLayerProps): null {
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
    setVis(map, PED_LAYERS, mode === 'ring');
    setVis(map, ISO_LAYERS, mode === 'isochrone');
  }, [map, mode]);

  // Spotlight: mask outside study area
  useEffect(() => {
    if (!map || !ensureLayers(map)) return;
    const maskSrc = map.getSource(MASK_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (!origin) {
      maskSrc?.setData(EMPTY_FC);
      return;
    }

    const area = getStudyAreaGeometry(origin, features, mode, contours);
    if (!area) { maskSrc?.setData(EMPTY_FC); return; }

    maskSrc?.setData(makeInvertedMask(area));
  }, [map, mode, features, origin, contours]);

  // Tag buildings inside study area with feature-state for color switching.
  // Uses queryRenderedFeatures + point-in-polygon on building centroids.
  // Throttled to avoid choking during rapid drag updates.
  const taggedIdsRef = useRef<Set<string | number>>(new Set());
  const tagThrottleRef = useRef(0);

  useEffect(() => {
    if (!map || !ensureLayers(map)) return;

    const clearStates = (): void => {
      try { map.removeFeatureState({ source: 'buildings', sourceLayer: 'building' }); } catch { /* ok */ }
      taggedIdsRef.current.clear();
    };

    if (!origin) { clearStates(); return; }

    const area = getStudyAreaGeometry(origin, features, mode, contours);
    if (!area) { clearStates(); return; }

    const ring = area.coordinates[0] as [number, number][];

    const tagBuildings = (): void => {
      // Throttle: max once per 150ms to keep drag smooth
      const now = Date.now();
      if (now - tagThrottleRef.current < 150) return;
      tagThrottleRef.current = now;

      clearStates();
      const rendered = map.queryRenderedFeatures(undefined as unknown as maplibregl.PointLike, {
        layers: ['buildings-fill', 'buildings-inside-fill', 'buildings-3d'].filter((id) => !!map.getLayer(id)),
      });
      for (const f of rendered) {
        if (f.id == null) continue;
        const c = roughCentroid(f);
        if (pointInPolygon(c, ring)) {
          map.setFeatureState(
            { source: 'buildings', sourceLayer: 'building', id: f.id },
            { inside: true },
          );
          taggedIdsRef.current.add(f.id);
        }
      }
    };

    tagBuildings();
    map.on('moveend', tagBuildings);
    map.on('idle', tagBuildings);
    return () => {
      map.off('moveend', tagBuildings);
      map.off('idle', tagBuildings);
    };
  }, [map, features, origin, mode, contours]);

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
    const circles = contours.map((m) => makeCircle(origin, m * WALK_M_PER_MIN, m));
    src.setData({ type: 'FeatureCollection', features: circles });
  }, [map, origin, contours]);

  // Update radius lines + centered labels — always screen-horizontal, redrawn on map rotation
  useEffect(() => {
    if (!map || !ensureLayers(map)) return;
    const lineSrc = map.getSource(RADIUS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    const labelSrc = map.getSource(RADIUS_LABEL_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!lineSrc || !labelSrc) return;
    if (!origin) { lineSrc.setData(EMPTY_FC); labelSrc.setData(EMPTY_FC); return; }

    const updateRadius = (): void => {
      const bearing = map.getBearing();
      const azimuth = 90 + bearing;

      let distances: { distM: number; contour: number }[] = [];

      if (mode === 'ring') {
        distances = contours.map((m) => ({ distM: m * WALK_M_PER_MIN, contour: m }));
      } else {
        for (const f of features) {
          const c = (f.properties?.contour as number) ?? 0;
          const ring = f.geometry.coordinates[0];
          if (!ring) continue;
          const distM = findEdgeDistAtAzimuth(origin, ring, azimuth);
          if (distM != null) distances.push({ distM, contour: c });
        }
        if (distances.length === 0) {
          distances = contours.map((m) => ({ distM: m * WALK_M_PER_MIN, contour: m }));
        }
      }

      const lines = distances.map(({ distM, contour }) => makeRadiusLine(origin, distM, contour, bearing));
      const labels = distances.map(({ distM, contour }) => makeRadiusLabelPoint(origin, distM, contour, bearing));
      lineSrc.setData({ type: 'FeatureCollection', features: lines });
      labelSrc.setData({ type: 'FeatureCollection', features: labels });
    };

    updateRadius();
    map.on('rotate', updateRadius);
    return () => { map.off('rotate', updateRadius); };
  }, [map, origin, contours, mode, features]);

  return null;
}

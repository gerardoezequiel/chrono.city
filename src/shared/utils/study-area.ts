import type { Feature, Polygon } from 'geojson';
import type { LngLat, BBox } from '@/shared/types/geo';

export const WALK_M_PER_MIN = 83.33;
export const CIRCLE_SEGMENTS = 64;
export const DEG_PER_METER_LAT = 1 / 111_139;

/** Generate a circle polygon for pedshed rings */
export function makeCircle(center: LngLat, radiusM: number, contour: number): Feature<Polygon> {
  const dLat = radiusM * DEG_PER_METER_LAT;
  const dLng = dLat / Math.cos(center.lat * Math.PI / 180);
  const coords: [number, number][] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const angle = (2 * Math.PI * i) / CIRCLE_SEGMENTS;
    coords.push([center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)]);
  }
  return { type: 'Feature', properties: { contour }, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** Get the outermost study area polygon (ring circle or isochrone) */
export function getStudyAreaPolygon(
  origin: LngLat, features: Feature<Polygon>[], mode: 'ring' | 'isochrone', contours: number[],
): Polygon | null {
  const maxMinutes = Math.max(...contours);
  if (mode === 'ring') return makeCircle(origin, maxMinutes * WALK_M_PER_MIN, maxMinutes).geometry;
  let outermost: Feature<Polygon> | undefined;
  let maxContour = -1;
  for (const f of features) {
    const c = (f.properties?.contour as number) ?? 0;
    if (c > maxContour) { maxContour = c; outermost = f; }
  }
  return outermost?.geometry ?? null;
}

/** Derive a bounding box from a polygon's coordinate extent */
export function bboxFromPolygon(polygon: Polygon): BBox {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const ring of polygon.coordinates) {
    for (const coord of ring) {
      const [lng, lat] = coord as [number, number];
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return { west, south, east, north };
}

/** Convert a GeoJSON Polygon to WKT string for DuckDB ST_GeomFromText */
export function polygonToWkt(polygon: Polygon): string {
  const rings = polygon.coordinates.map((ring) =>
    '(' + ring.map((c) => `${(c as [number, number])[0]} ${(c as [number, number])[1]}`).join(', ') + ')',
  );
  return `POLYGON(${rings.join(', ')})`;
}

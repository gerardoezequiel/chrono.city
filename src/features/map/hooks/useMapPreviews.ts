import { useState, useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';
import type { LngLat } from '@/shared/types/geo';
import type { BuildingMetrics, NetworkMetrics, AmenityMetrics, SectionId } from '@/shared/types/metrics';
import { computeOrientation } from '@/shared/utils/orientation';
import { classifyFifteenMin } from '@/shared/utils/fifteen-min';

const THROTTLE_MS = 300; // Reduced frequency — previews are gap-filler, not primary data
const PROXIMITY_RADIUS_M = 500; // Filter features to ~500m around origin (matches bbox quantize grid)

export type MapPreviews = Partial<Record<SectionId, Record<string, unknown> | null>>;

const DEG_TO_RAD = Math.PI / 180;

/** Approximate distance in meters between two [lng, lat] points */
function distanceM(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * 111_139;
  const dLng = (b[0] - a[0]) * 111_139 * Math.cos(((a[1] + b[1]) / 2) * DEG_TO_RAD);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Extract a representative [lng, lat] from any geometry type */
function representativePoint(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === 'Point') return geom.coordinates as [number, number];
  if (geom.type === 'LineString') {
    const mid = Math.floor(geom.coordinates.length / 2);
    return geom.coordinates[mid] as [number, number];
  }
  if (geom.type === 'Polygon') {
    const ring = geom.coordinates[0];
    if (!ring || ring.length === 0) return null;
    let cx = 0, cy = 0;
    const n = ring.length - 1; // exclude closing vertex
    for (let i = 0; i < n; i++) { cx += ring[i]![0]!; cy += ring[i]![1]!; }
    return n > 0 ? [cx / n, cy / n] : null;
  }
  if (geom.type === 'MultiLineString') {
    const line = geom.coordinates[0];
    if (!line) return null;
    const mid = Math.floor(line.length / 2);
    return line[mid] as [number, number];
  }
  if (geom.type === 'MultiPolygon') {
    const ring = geom.coordinates[0]?.[0];
    if (!ring || ring.length === 0) return null;
    let cx = 0, cy = 0;
    const n = ring.length - 1;
    for (let i = 0; i < n; i++) { cx += ring[i]![0]!; cy += ring[i]![1]!; }
    return n > 0 ? [cx / n, cy / n] : null;
  }
  return null;
}

/** Filter features to those within PROXIMITY_RADIUS_M of origin */
function filterNearOrigin(features: GeoJSON.Feature[], origin: LngLat): GeoJSON.Feature[] {
  const o: [number, number] = [origin.lng, origin.lat];
  return features.filter((f) => {
    const pt = representativePoint(f.geometry);
    return pt != null && distanceM(o, pt) <= PROXIMITY_RADIUS_M;
  });
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

/** Extract outermost polygon ring from isochrone features */
function getOuterRing(features: Feature<Polygon>[]): number[][] | null {
  let outermost: Feature<Polygon> | undefined;
  let maxContour = -1;
  for (const f of features) {
    const c = (f.properties?.contour as number) ?? 0;
    if (c > maxContour) { maxContour = c; outermost = f; }
  }
  return outermost?.geometry.coordinates[0] ?? null;
}

/** Filter features by pedshed polygon, falling back to radius from origin */
function filterByPedshed(features: GeoJSON.Feature[], origin: LngLat, pedshedRing: number[][] | null): GeoJSON.Feature[] {
  if (pedshedRing) {
    return features.filter((f) => {
      const pt = representativePoint(f.geometry);
      return pt != null && pointInPolygon(pt, pedshedRing);
    });
  }
  return filterNearOrigin(features, origin);
}

/** Deduplicate features by id — querySourceFeatures returns duplicates from overlapping tiles */
function dedup(features: GeoJSON.Feature[]): GeoJSON.Feature[] {
  const seen = new Set<string | number>();
  const result: GeoJSON.Feature[] = [];
  for (const f of features) {
    const id = f.id ?? f.properties?.id;
    if (id != null && seen.has(id)) continue;
    if (id != null) seen.add(id);
    result.push(f);
  }
  return result;
}

function computeBuildingPreview(features: GeoJSON.Feature[]): Partial<BuildingMetrics> {
  const unique = dedup(features);
  const count = unique.length;
  let withHeight = 0;
  let heightSum = 0;
  let withFloors = 0;
  let floorSum = 0;
  const typeDist: Record<string, number> = {};

  for (const f of unique) {
    const h = f.properties?.height as number | undefined;
    if (h != null && h > 0) { withHeight++; heightSum += h; }
    const fl = f.properties?.num_floors as number | undefined;
    if (fl != null && fl > 0) { withFloors++; floorSum += fl; }
    const cls = (f.properties?.class as string) ?? (f.properties?.subtype as string) ?? 'unknown';
    typeDist[cls] = (typeDist[cls] ?? 0) + 1;
  }

  return {
    buildingCount: count,
    buildingsWithHeight: withHeight,
    heightCoverage: count > 0 ? withHeight / count : 0,
    avgHeightM: withHeight > 0 ? heightSum / withHeight : null,
    avgFloors: withFloors > 0 ? floorSum / withFloors : null,
    buildingTypeDistribution: typeDist,
    // totalFootprintAreaM2, avgFootprintAreaM2 left undefined — needs DuckDB spatial
  };
}

function computeNetworkPreview(features: GeoJSON.Feature[]): Partial<NetworkMetrics> {
  const unique = dedup(features);
  const classDist: Record<string, number> = {};
  let totalLengthM = 0;

  for (const f of unique) {
    const cls = (f.properties?.class as string) ?? 'unknown';
    classDist[cls] = (classDist[cls] ?? 0) + 1;

    if (f.geometry.type === 'LineString') {
      const coords = f.geometry.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        totalLengthM += distanceM(coords[i] as [number, number], coords[i + 1] as [number, number]);
      }
    } else if (f.geometry.type === 'MultiLineString') {
      for (const line of f.geometry.coordinates) {
        for (let i = 0; i < line.length - 1; i++) {
          totalLengthM += distanceM(line[i] as [number, number], line[i + 1] as [number, number]);
        }
      }
    }
  }

  const orientation = computeOrientation(unique);

  return {
    segmentCount: unique.length,
    roadClassDistribution: classDist,
    totalLengthKm: totalLengthM / 1000,
    orientationEntropy: orientation.entropy,
    gridOrder: orientation.gridOrder,
    dominantBearing: orientation.dominantBearing,
    orientation: { bins: orientation.bins, dominantBearing: orientation.dominantBearing },
  };
}

function computeAmenityPreview(features: GeoJSON.Feature[]): Partial<AmenityMetrics> {
  const unique = dedup(features);
  const catDist: Record<string, number> = {};

  for (const f of unique) {
    const cat = (f.properties?.['@category'] as string) ?? 'uncategorized';
    catDist[cat] = (catDist[cat] ?? 0) + 1;
  }

  const topCategories = Object.entries(catDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  return {
    poiCount: unique.length,
    uniqueCategories: Object.keys(catDist).length,
    categoryDistribution: catDist,
    topCategories,
    fifteenMinCategories: classifyFifteenMin(catDist),
  };
}

const PREVIEW_SOURCES = new Set(['buildings', 'transportation', 'places']);

/**
 * Fast preview metrics from PMTiles source features.
 * Uses querySourceFeatures() for instant metrics on all sections.
 * Features are deduplicated by id (overlapping tiles return duplicates).
 * These are viewport/zoom-dependent approximations — DuckDB provides authoritative results.
 */
export function useMapPreviews(
  map: maplibregl.Map | null,
  origin: LngLat | null,
  pedshedFeatures?: Feature<Polygon>[],
): MapPreviews {
  const [previews, setPreviews] = useState<MapPreviews>({});
  const lastComputeRef = useRef(0);
  const rafRef = useRef(0);

  // Extract outermost polygon ring once per pedshed change
  const pedshedRing = pedshedFeatures?.length ? getOuterRing(pedshedFeatures) : null;

  useEffect(() => {
    if (!map || !origin) {
      setPreviews({});
      return;
    }

    const compute = (): void => {
      const now = Date.now();
      if (now - lastComputeRef.current < THROTTLE_MS) return;
      lastComputeRef.current = now;

      const buildingFeatures = filterNearOrigin(map.querySourceFeatures('buildings', {
        sourceLayer: 'building',
      }) as GeoJSON.Feature[], origin);

      // Network: use pedshed polygon when available, fall back to radius
      const networkFeatures = filterByPedshed(map.querySourceFeatures('transportation', {
        sourceLayer: 'segment',
        filter: ['==', ['get', 'subtype'], 'road'],
      }) as GeoJSON.Feature[], origin, pedshedRing);

      const amenityFeatures = filterNearOrigin(map.querySourceFeatures('places', {
        sourceLayer: 'place',
      }) as GeoJSON.Feature[], origin);

      const next: MapPreviews = {};
      if (buildingFeatures.length > 0) next.buildings = computeBuildingPreview(buildingFeatures) as Record<string, unknown>;
      if (networkFeatures.length > 0) next.network = computeNetworkPreview(networkFeatures) as Record<string, unknown>;
      if (amenityFeatures.length > 0) next.amenities = computeAmenityPreview(amenityFeatures) as Record<string, unknown>;

      setPreviews(next);
    };

    compute();

    // Recompute when tiles arrive
    const onSourceData = (e: maplibregl.MapSourceDataEvent): void => {
      if (PREVIEW_SOURCES.has(e.sourceId) && e.isSourceLoaded) {
        rafRef.current = requestAnimationFrame(compute);
      }
    };

    map.on('sourcedata', onSourceData);

    return () => {
      map.off('sourcedata', onSourceData);
      cancelAnimationFrame(rafRef.current);
    };
  }, [map, origin, pedshedRing]);

  return previews;
}

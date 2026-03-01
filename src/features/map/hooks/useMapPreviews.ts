import { useState, useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLat } from '@/shared/types/geo';
import type { BuildingMetrics, NetworkMetrics, AmenityMetrics, SectionId } from '@/shared/types/metrics';
import { computeOrientation } from '@/shared/utils/orientation';

const THROTTLE_MS = 120; // ~8fps during drag

export type MapPreviews = Partial<Record<SectionId, Record<string, unknown> | null>>;

const DEG_TO_RAD = Math.PI / 180;

/** Approximate distance in meters between two [lng, lat] points */
function distanceM(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * 111_139;
  const dLng = (b[0] - a[0]) * 111_139 * Math.cos(((a[1] + b[1]) / 2) * DEG_TO_RAD);
  return Math.sqrt(dLat * dLat + dLng * dLng);
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

  for (const f of unique) {
    const h = f.properties?.height as number | undefined;
    if (h != null && h > 0) { withHeight++; heightSum += h; }
    const fl = f.properties?.num_floors as number | undefined;
    if (fl != null && fl > 0) { withFloors++; floorSum += fl; }
  }

  return {
    buildingCount: count,
    buildingsWithHeight: withHeight,
    heightCoverage: count > 0 ? withHeight / count : 0,
    avgHeightM: withHeight > 0 ? heightSum / withHeight : null,
    avgFloors: withFloors > 0 ? floorSum / withFloors : null,
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
    categoryDistribution: catDist,
    topCategories,
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
): MapPreviews {
  const [previews, setPreviews] = useState<MapPreviews>({});
  const lastComputeRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!map || !origin) {
      setPreviews({});
      return;
    }

    const compute = (): void => {
      const now = Date.now();
      if (now - lastComputeRef.current < THROTTLE_MS) return;
      lastComputeRef.current = now;

      const buildingFeatures = map.querySourceFeatures('buildings', {
        sourceLayer: 'building',
      }) as GeoJSON.Feature[];

      const networkFeatures = map.querySourceFeatures('transportation', {
        sourceLayer: 'segment',
        filter: ['==', ['get', 'subtype'], 'road'],
      }) as GeoJSON.Feature[];

      const amenityFeatures = map.querySourceFeatures('places', {
        sourceLayer: 'place',
      }) as GeoJSON.Feature[];

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

    // Recompute after pan/zoom — different tiles in viewport
    const onMoveEnd = (): void => {
      rafRef.current = requestAnimationFrame(compute);
    };

    map.on('sourcedata', onSourceData);
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('sourcedata', onSourceData);
      map.off('moveend', onMoveEnd);
      cancelAnimationFrame(rafRef.current);
    };
  }, [map, origin]);

  return previews;
}

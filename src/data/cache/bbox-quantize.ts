import type { BBox, LngLat } from '@/shared/types/geo';
import { OVERTURE_RELEASE } from '@/config/constants';

const PRECISION = 0.005; // ~500m grid

/** Snap bbox to 0.005° grid so small pans = cache hit */
export function quantizeBbox(bbox: BBox): BBox {
  return {
    west: Math.floor(bbox.west / PRECISION) * PRECISION,
    south: Math.floor(bbox.south / PRECISION) * PRECISION,
    east: Math.ceil(bbox.east / PRECISION) * PRECISION,
    north: Math.ceil(bbox.north / PRECISION) * PRECISION,
  };
}

/** Build a bbox from origin + radius in degrees (~0.015° ≈ 1.67km) */
export function originToBbox(origin: LngLat, radiusDeg = 0.015): BBox {
  return {
    west: origin.lng - radiusDeg,
    south: origin.lat - radiusDeg,
    east: origin.lng + radiusDeg,
    north: origin.lat + radiusDeg,
  };
}

/** Cache key: version:quantized_bbox:section */
export function cacheKey(bbox: BBox, section: string): string {
  const q = quantizeBbox(bbox);
  return `${OVERTURE_RELEASE}:${q.west.toFixed(3)},${q.south.toFixed(3)},${q.east.toFixed(3)},${q.north.toFixed(3)}:${section}`;
}

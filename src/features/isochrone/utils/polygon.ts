import concave from '@turf/concave';
import convex from '@turf/convex';
import buffer from '@turf/buffer';
import { featureCollection, point } from '@turf/helpers';
import type { Feature, Polygon } from 'geojson';
import type { GraphNode } from '../types';

export function buildIsochronePolygon(
  reached: Map<string, number>,
  graph: Map<string, GraphNode>,
  maxCostSeconds: number,
): Feature<Polygon> | null {
  if (reached.size < 3) return null;

  // Use only nodes that were actually reached (not just the origin)
  const points = [];
  for (const [nodeId, cost] of reached) {
    if (cost > maxCostSeconds) continue;
    const node = graph.get(nodeId);
    if (node) {
      points.push(point([node.lon, node.lat]));
    }
  }

  if (points.length < 3) return null;

  const fc = featureCollection(points);

  // Try concave hull with generous maxEdge to avoid spiky artifacts
  let hull = concave(fc, { maxEdge: 0.5, units: 'kilometers' });

  // Fall back to convex hull if concave fails
  if (!hull || hull.geometry.type !== 'Polygon') {
    hull = convex(fc);
  }

  if (!hull || hull.geometry.type !== 'Polygon') {
    return null;
  }

  // Buffer outward slightly then inward to smooth jagged edges
  const buffered = buffer(hull, 0.05, { units: 'kilometers' });
  if (!buffered || buffered.geometry.type !== 'Polygon') {
    return hull as Feature<Polygon>;
  }

  // Simplify the polygon to reduce coordinate count
  const simplified = simplifyPolygon(buffered as Feature<Polygon>, 0.0001);
  return simplified;
}

/** Douglas-Peucker simplification on polygon coordinates */
function simplifyPolygon(
  poly: Feature<Polygon>,
  tolerance: number,
): Feature<Polygon> {
  const coords = poly.geometry.coordinates;
  const simplified = coords.map((ring) => douglasPeucker(ring, tolerance));
  return {
    ...poly,
    geometry: { type: 'Polygon', coordinates: simplified },
  };
}

function douglasPeucker(
  points: number[][],
  tolerance: number,
): number[][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDist(points[i]!, first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDist(
  pt: number[],
  lineStart: number[],
  lineEnd: number[],
): number {
  const dx = lineEnd[0]! - lineStart[0]!;
  const dy = lineEnd[1]! - lineStart[1]!;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = pt[0]! - lineStart[0]!;
    const ey = pt[1]! - lineStart[1]!;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const cross = Math.abs(
    (pt[0]! - lineStart[0]!) * dy - (pt[1]! - lineStart[1]!) * dx
  );
  return cross / Math.sqrt(lenSq);
}

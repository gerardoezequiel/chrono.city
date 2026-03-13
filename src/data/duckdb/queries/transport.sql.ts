import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { NetworkMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

const ACTIVE_CLASSES = new Set(['footway', 'pedestrian', 'path', 'cycleway', 'steps', 'living_street']);

interface RoadClassRow {
  road_class: string;
  segment_count: number;
  total_length_m: number;
}

interface DegreeRow {
  intersections: number;
  dead_ends: number;
  total_connectors: number;
}

function bboxAreaKm2(b: BBox): number {
  const DEG = Math.PI / 180;
  const dLat = (b.north - b.south) * 111.139;
  const dLng = (b.east - b.west) * 111.139 * Math.cos(((b.north + b.south) / 2) * DEG);
  return dLat * dLng;
}

/**
 * Road class aggregation + connector degree analysis.
 * Orientation is computed from PMTiles via useMapPreviews (instant, no S3 download needed).
 * Runs two queries in parallel — DuckDB caches the parquet metadata from the first.
 */
export async function queryTransport(bbox: BBox): Promise<NetworkMetrics> {
  const classSql = `
    SELECT
      class as road_class,
      COUNT(*) as segment_count,
      SUM(ST_Length_Spheroid(geometry)) as total_length_m
    FROM read_parquet('${S3_PATHS.segments}', hive_partitioning=1)
    WHERE ${BBOX_PRED(bbox)}
      AND subtype = 'road'
    GROUP BY class
    ORDER BY total_length_m DESC
  `;

  const degreeSql = `
    WITH connector_refs AS (
      SELECT c.connector_id AS cid
      FROM read_parquet('${S3_PATHS.segments}', hive_partitioning=1) AS s,
           UNNEST(s.connectors) AS c
      WHERE ${BBOX_PRED(bbox)}
        AND subtype = 'road'
    ),
    degrees AS (
      SELECT cid, COUNT(*) AS degree
      FROM connector_refs
      GROUP BY cid
    )
    SELECT
      COUNT(*) FILTER (WHERE degree >= 3) AS intersections,
      COUNT(*) FILTER (WHERE degree = 1) AS dead_ends,
      COUNT(*) AS total_connectors
    FROM degrees
  `;

  const [classRows, degreeRows] = await Promise.all([
    query<RoadClassRow>(classSql),
    query<DegreeRow>(degreeSql),
  ]);

  const roadClassDistribution: Record<string, number> = {};
  let totalSegments = 0;
  let totalLengthM = 0;
  let activeLengthM = 0;

  for (const row of classRows) {
    const cls = row.road_class ?? 'unknown';
    roadClassDistribution[cls] = Number(row.segment_count);
    totalSegments += Number(row.segment_count);
    totalLengthM += Number(row.total_length_m);
    if (ACTIVE_CLASSES.has(cls)) {
      activeLengthM += Number(row.total_length_m);
    }
  }

  const deg = degreeRows[0];
  const areaKm2 = bboxAreaKm2(bbox);

  return {
    segmentCount: totalSegments,
    totalLengthKm: totalLengthM / 1_000,
    roadClassDistribution,
    activeTransportShare: totalLengthM > 0 ? activeLengthM / totalLengthM : 0,
    intersectionDensity: areaKm2 > 0 && deg ? Number(deg.intersections) / areaKm2 : 0,
    deadEndRatio: deg && Number(deg.total_connectors) > 0
      ? Number(deg.dead_ends) / Number(deg.total_connectors)
      : 0,
  };
}

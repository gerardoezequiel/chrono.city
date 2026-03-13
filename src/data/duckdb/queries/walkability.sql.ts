import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { WalkabilityMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

const ACTIVE_CLASSES = ['footway', 'pedestrian', 'path', 'cycleway', 'steps'];

interface WalkabilityRow {
  segment_count: number;
  total_length_m: number;
  active_length_m: number;
  total_nodes: number;
  intersection_count: number;
  dead_end_count: number;
}

function bboxAreaKm2(bbox: BBox): number {
  const midLat = (bbox.north + bbox.south) / 2;
  const degToKm = 111.139;
  const width = (bbox.east - bbox.west) * Math.cos((midLat * Math.PI) / 180) * degToKm;
  const height = (bbox.north - bbox.south) * degToKm;
  return width * height;
}

export async function queryWalkability(bbox: BBox): Promise<WalkabilityMetrics> {
  const activeList = ACTIVE_CLASSES.map((c) => `'${c}'`).join(', ');

  const sql = `
    WITH segs AS (
      SELECT
        class,
        connectors,
        ST_Length_Spheroid(geometry) AS length_m
      FROM read_parquet('${S3_PATHS.segments}', hive_partitioning=1)
      WHERE ${BBOX_PRED(bbox)}
        AND subtype = 'road'
    ),
    class_stats AS (
      SELECT
        COUNT(*) AS segment_count,
        SUM(length_m) AS total_length_m,
        SUM(CASE WHEN class IN (${activeList}) THEN length_m ELSE 0 END) AS active_length_m
      FROM segs
    ),
    node_refs AS (
      SELECT UNNEST(connectors) AS cid FROM segs
    ),
    node_degrees AS (
      SELECT cid, COUNT(*) AS degree FROM node_refs GROUP BY cid
    ),
    node_stats AS (
      SELECT
        COUNT(*) AS total_nodes,
        COUNT(*) FILTER (WHERE degree >= 3) AS intersection_count,
        COUNT(*) FILTER (WHERE degree = 1) AS dead_end_count
      FROM node_degrees
    )
    SELECT * FROM class_stats, node_stats
  `;

  const rows = await query<WalkabilityRow>(sql);
  const r = rows[0];

  if (!r || r.segment_count === 0) {
    return {
      intersectionCount: 0,
      intersectionDensity: 0,
      deadEndCount: 0,
      deadEndRatio: 0,
      activeTransportShare: 0,
      totalNodes: 0,
      segmentCount: 0,
      totalLengthKm: 0,
    };
  }

  const areaKm2 = bboxAreaKm2(bbox);
  const totalNodes = Number(r.total_nodes);
  const intersectionCount = Number(r.intersection_count);
  const deadEndCount = Number(r.dead_end_count);
  const totalLengthM = Number(r.total_length_m);
  const activeLengthM = Number(r.active_length_m);

  return {
    intersectionCount,
    intersectionDensity: areaKm2 > 0 ? intersectionCount / areaKm2 : 0,
    deadEndCount,
    deadEndRatio: totalNodes > 0 ? deadEndCount / totalNodes : 0,
    activeTransportShare: totalLengthM > 0 ? activeLengthM / totalLengthM : 0,
    totalNodes,
    segmentCount: Number(r.segment_count),
    totalLengthKm: totalLengthM / 1_000,
  };
}

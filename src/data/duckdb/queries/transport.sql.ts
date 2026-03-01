import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { NetworkMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

interface RoadClassRow {
  road_class: string;
  segment_count: number;
  total_length_m: number;
}

/**
 * Road class aggregation only. Orientation is computed from PMTiles
 * via useMapPreviews (instant, no S3 download needed).
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

  const classRows = await query<RoadClassRow>(classSql);

  const roadClassDistribution: Record<string, number> = {};
  let totalSegments = 0;
  let totalLengthM = 0;

  for (const row of classRows) {
    const cls = row.road_class ?? 'unknown';
    roadClassDistribution[cls] = Number(row.segment_count);
    totalSegments += Number(row.segment_count);
    totalLengthM += Number(row.total_length_m);
  }

  return {
    segmentCount: totalSegments,
    totalLengthKm: totalLengthM / 1_000,
    roadClassDistribution,
  };
}

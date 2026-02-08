import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';

const BBOX_PREDICATE = (bbox: BBox): string =>
  `bbox.xmin <= ${bbox.east} AND bbox.xmax >= ${bbox.west} AND bbox.ymin <= ${bbox.north} AND bbox.ymax >= ${bbox.south}`;

export function segmentsQuery(bbox: BBox): string {
  return `
    SELECT
      id,
      class,
      connectors,
      ST_Length(geometry) * 111139 AS length_m
    FROM read_parquet('${S3_PATHS.segments}', hive_partitioning=1)
    WHERE ${BBOX_PREDICATE(bbox)}
      AND subtype = 'road'
      AND class NOT IN ('motorway', 'motorway_link', 'trunk', 'trunk_link')
  `;
}

export function connectorsQuery(bbox: BBox): string {
  return `
    SELECT
      id,
      ST_X(geometry) AS lon,
      ST_Y(geometry) AS lat
    FROM read_parquet('${S3_PATHS.connectors}', hive_partitioning=1)
    WHERE ${BBOX_PREDICATE(bbox)}
  `;
}

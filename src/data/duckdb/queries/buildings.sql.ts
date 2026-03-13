import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { BuildingMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';
import type { CoreRow, SubtypeRow, FootprintRow } from './buildings-types';
import { EMPTY_METRICS } from './buildings-types';
import { deriveBuildingMetrics } from './buildings-derive';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

export async function queryBuildings(bbox: BBox): Promise<BuildingMetrics> {
  const pred = BBOX_PRED(bbox);
  const src = `read_parquet('${S3_PATHS.buildings}', hive_partitioning=1)`;

  const coreSql = `
    WITH building_geom AS (
      SELECT ST_Area_Spheroid(geometry) as area_m2,
        ST_Perimeter_Spheroid(geometry) as perimeter_m, height, num_floors
      FROM ${src} WHERE ${pred}
    )
    SELECT COUNT(*) as building_count,
      SUM(area_m2) as total_footprint_area_m2,
      AVG(area_m2) as avg_footprint_area_m2,
      MEDIAN(area_m2) as median_footprint_area_m2,
      COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
      AVG(height) as avg_height_m, AVG(num_floors) as avg_floors,
      SUM(area_m2 * COALESCE(num_floors, ROUND(height / 3.5), 1)) as total_floor_area_m2,
      AVG((4 * PI() * area_m2) / POWER(perimeter_m, 2)) as avg_compactness,
      2.0 * LN(SUM(perimeter_m) / 4.0) / LN(SUM(area_m2)) as fractal_dimension,
      ST_Area_Spheroid(ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north})) as viewport_area_m2
    FROM building_geom`;

  const subtypeSql = `
    SELECT COALESCE(subtype, 'unknown') as subtype, COUNT(*) as count
    FROM ${src} WHERE ${pred}
    GROUP BY subtype ORDER BY count DESC`;

  const footprintSql = `
    SELECT ST_Area_Spheroid(geometry) as area_m2
    FROM ${src} WHERE ${pred} LIMIT 5000`;

  const [coreRows, subtypeRows, footprintRows] = await Promise.all([
    query<CoreRow>(coreSql),
    query<SubtypeRow>(subtypeSql),
    query<FootprintRow>(footprintSql),
  ]);

  const r = coreRows[0];
  if (!r || Number(r.building_count) === 0) return EMPTY_METRICS;

  return deriveBuildingMetrics(r, subtypeRows, footprintRows);
}

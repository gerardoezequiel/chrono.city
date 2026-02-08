import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { BuildingMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

interface BuildingRow {
  building_count: number;
  total_footprint_area_m2: number;
  avg_footprint_area_m2: number;
  buildings_with_height: number;
  avg_height_m: number | null;
  avg_floors: number | null;
}

export async function queryBuildings(bbox: BBox): Promise<BuildingMetrics> {
  const sql = `
    SELECT
      COUNT(*) as building_count,
      SUM(ST_Area_Spheroid(geometry)) as total_footprint_area_m2,
      AVG(ST_Area_Spheroid(geometry)) as avg_footprint_area_m2,
      COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
      AVG(height) as avg_height_m,
      AVG(num_floors) as avg_floors
    FROM read_parquet('${S3_PATHS.buildings}', hive_partitioning=1)
    WHERE ${BBOX_PRED(bbox)}
  `;

  const rows = await query<BuildingRow>(sql);
  const r = rows[0];

  if (!r || r.building_count === 0) {
    return {
      buildingCount: 0,
      totalFootprintAreaM2: 0,
      avgFootprintAreaM2: 0,
      buildingsWithHeight: 0,
      avgHeightM: null,
      avgFloors: null,
      heightCoverage: 0,
    };
  }

  return {
    buildingCount: Number(r.building_count),
    totalFootprintAreaM2: Number(r.total_footprint_area_m2),
    avgFootprintAreaM2: Number(r.avg_footprint_area_m2),
    buildingsWithHeight: Number(r.buildings_with_height),
    avgHeightM: r.avg_height_m != null ? Number(r.avg_height_m) : null,
    avgFloors: r.avg_floors != null ? Number(r.avg_floors) : null,
    heightCoverage: r.building_count > 0 ? Number(r.buildings_with_height) / Number(r.building_count) : 0,
  };
}

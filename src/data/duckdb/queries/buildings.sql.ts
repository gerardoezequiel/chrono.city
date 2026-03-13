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

interface HeightBinRow {
  height_bin: string;
  count: number;
}

export async function queryBuildings(bbox: BBox): Promise<BuildingMetrics> {
  const pred = BBOX_PRED(bbox);

  const statsSql = `
    SELECT
      COUNT(*) as building_count,
      SUM(ST_Area_Spheroid(geometry)) as total_footprint_area_m2,
      AVG(ST_Area_Spheroid(geometry)) as avg_footprint_area_m2,
      COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
      AVG(height) as avg_height_m,
      AVG(num_floors) as avg_floors
    FROM read_parquet('${S3_PATHS.buildings}', hive_partitioning=1)
    WHERE ${pred}
  `;

  const heightSql = `
    SELECT
      CASE
        WHEN height < 5 THEN '0-5m'
        WHEN height < 10 THEN '5-10m'
        WHEN height < 20 THEN '10-20m'
        WHEN height < 40 THEN '20-40m'
        WHEN height < 80 THEN '40-80m'
        ELSE '80m+'
      END as height_bin,
      COUNT(*) as count
    FROM read_parquet('${S3_PATHS.buildings}', hive_partitioning=1)
    WHERE ${pred} AND height IS NOT NULL
    GROUP BY height_bin
    ORDER BY MIN(height)
  `;

  const [statsRows, heightRows] = await Promise.all([
    query<BuildingRow>(statsSql),
    query<HeightBinRow>(heightSql),
  ]);

  const r = statsRows[0];

  const heightDistribution: Record<string, number> = {};
  for (const row of heightRows) {
    heightDistribution[row.height_bin] = Number(row.count);
  }

  if (!r || r.building_count === 0) {
    return {
      buildingCount: 0,
      totalFootprintAreaM2: 0,
      avgFootprintAreaM2: 0,
      buildingsWithHeight: 0,
      avgHeightM: null,
      avgFloors: null,
      heightCoverage: 0,
      heightDistribution,
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
    heightDistribution,
  };
}

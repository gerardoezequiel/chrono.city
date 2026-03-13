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
  total_floor_area_m2: number;
  avg_compactness: number | null;
  median_footprint_m2: number | null;
}

/**
 * Building morphology query — computes all Urban Fabric indicators.
 * GSI, FSI, OSR derived from footprint/floor areas and study area.
 * Compactness uses isoperimetric quotient (4*PI*area/perimeter²).
 * Urban grain = median footprint area.
 */
export async function queryBuildings(bbox: BBox): Promise<BuildingMetrics> {
  // Estimate study area in m² from bbox
  const latMid = (bbox.north + bbox.south) / 2;
  const dLat = (bbox.north - bbox.south) * 111139;
  const dLng = (bbox.east - bbox.west) * 111139 * Math.cos(latMid * Math.PI / 180);
  const studyAreaM2 = Math.max(dLat * dLng, 1);

  const sql = `
    SELECT
      COUNT(*) as building_count,
      SUM(ST_Area_Spheroid(geometry)) as total_footprint_area_m2,
      AVG(ST_Area_Spheroid(geometry)) as avg_footprint_area_m2,
      COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
      AVG(height) as avg_height_m,
      AVG(num_floors) as avg_floors,
      SUM(ST_Area_Spheroid(geometry) * COALESCE(num_floors, 1)) as total_floor_area_m2,
      AVG(
        CASE WHEN ST_Perimeter_Spheroid(geometry) > 0
        THEN (4.0 * PI() * ST_Area_Spheroid(geometry)) / (ST_Perimeter_Spheroid(geometry) * ST_Perimeter_Spheroid(geometry))
        ELSE NULL END
      ) as avg_compactness,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ST_Area_Spheroid(geometry)) as median_footprint_m2
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
      gsi: 0,
      fsi: 0,
      osr: null,
      compactness: null,
      medianFootprintM2: null,
    };
  }

  const totalFootprint = Number(r.total_footprint_area_m2);
  const totalFloorArea = Number(r.total_floor_area_m2);
  const gsi = totalFootprint / studyAreaM2;
  const fsi = totalFloorArea / studyAreaM2;
  const osr = fsi > 0 ? (1 - gsi) / fsi : null;

  return {
    buildingCount: Number(r.building_count),
    totalFootprintAreaM2: totalFootprint,
    avgFootprintAreaM2: Number(r.avg_footprint_area_m2),
    buildingsWithHeight: Number(r.buildings_with_height),
    avgHeightM: r.avg_height_m != null ? Number(r.avg_height_m) : null,
    avgFloors: r.avg_floors != null ? Number(r.avg_floors) : null,
    heightCoverage: r.building_count > 0 ? Number(r.buildings_with_height) / Number(r.building_count) : 0,
    gsi,
    fsi,
    osr,
    compactness: r.avg_compactness != null ? Number(r.avg_compactness) : null,
    medianFootprintM2: r.median_footprint_m2 != null ? Number(r.median_footprint_m2) : null,
  };
}

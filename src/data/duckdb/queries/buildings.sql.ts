import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { BuildingMetrics } from '@/shared/types/metrics';
import type { FabricIndicators } from '@/data/scoring/types';
import { scoreFabric } from '@/data/scoring/chapters/fabric';
import { query } from '@/data/duckdb/init';

// ─── Helpers ────────────────────────────────────────────────

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

// ─── Row interfaces ─────────────────────────────────────────

interface CoreRow {
  building_count: number;
  total_footprint_area_m2: number;
  avg_footprint_area_m2: number;
  median_footprint_area_m2: number;
  buildings_with_height: number;
  avg_height_m: number | null;
  avg_floors: number | null;
  total_floor_area_m2: number;
  avg_compactness: number;
  fractal_dimension: number | null;
  viewport_area_m2: number;
}

interface SubtypeRow {
  subtype: string;
  count: number;
}

interface FootprintRow {
  area_m2: number;
}

// ─── Empty result ───────────────────────────────────────────

const EMPTY_METRICS: BuildingMetrics = {
  buildingCount: 0,
  totalFootprintAreaM2: 0,
  avgFootprintAreaM2: 0,
  buildingsWithHeight: 0,
  avgHeightM: null,
  avgFloors: null,
  heightCoverage: 0,
  viewportAreaM2: 0,
  gsi: 0,
  fsi: null,
  osr: null,
  compactness: 0,
  urbanGrain: 0,
  fractalDimension: null,
  fabricScore: null,
  footprintDistribution: [],
  subtypeDistribution: {},
};

// ─── Main query ─────────────────────────────────────────────

export async function queryBuildings(bbox: BBox): Promise<BuildingMetrics> {
  const pred = BBOX_PRED(bbox);
  const src = `read_parquet('${S3_PATHS.buildings}', hive_partitioning=1)`;

  // Query 1 — Core aggregation with CTE
  const coreSql = `
    WITH building_geom AS (
      SELECT
        ST_Area_Spheroid(geometry) as area_m2,
        ST_Perimeter_Spheroid(geometry) as perimeter_m,
        height,
        num_floors
      FROM ${src}
      WHERE ${pred}
    )
    SELECT
      COUNT(*) as building_count,
      SUM(area_m2) as total_footprint_area_m2,
      AVG(area_m2) as avg_footprint_area_m2,
      MEDIAN(area_m2) as median_footprint_area_m2,
      COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
      AVG(height) as avg_height_m,
      AVG(num_floors) as avg_floors,
      SUM(area_m2 * COALESCE(num_floors, ROUND(height / 3.5), 1)) as total_floor_area_m2,
      AVG((4 * PI() * area_m2) / POWER(perimeter_m, 2)) as avg_compactness,
      2.0 * LN(SUM(perimeter_m) / 4.0) / LN(SUM(area_m2)) as fractal_dimension,
      ST_Area_Spheroid(ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north})) as viewport_area_m2
    FROM building_geom
  `;

  // Query 2 — Subtype distribution
  const subtypeSql = `
    SELECT
      COALESCE(subtype, 'unknown') as subtype,
      COUNT(*) as count
    FROM ${src}
    WHERE ${pred}
    GROUP BY subtype
    ORDER BY count DESC
  `;

  // Query 3 — Footprint distribution (for histogram chart)
  const footprintSql = `
    SELECT ST_Area_Spheroid(geometry) as area_m2
    FROM ${src}
    WHERE ${pred}
    LIMIT 5000
  `;

  // Run all three in parallel
  const [coreRows, subtypeRows, footprintRows] = await Promise.all([
    query<CoreRow>(coreSql),
    query<SubtypeRow>(subtypeSql),
    query<FootprintRow>(footprintSql),
  ]);

  const r = coreRows[0];
  if (!r || Number(r.building_count) === 0) {
    return EMPTY_METRICS;
  }

  // ── Derived metrics ─────────────────────────────────────

  const totalFootprint = Number(r.total_footprint_area_m2);
  const totalFloorArea = Number(r.total_floor_area_m2);
  const viewportArea = Number(r.viewport_area_m2);
  const buildingCount = Number(r.building_count);
  const buildingsWithHeight = Number(r.buildings_with_height);
  const heightCoverage = buildingCount > 0
    ? buildingsWithHeight / buildingCount
    : 0;

  const gsi = viewportArea > 0 ? totalFootprint / viewportArea : 0;

  const fsi = buildingsWithHeight > 0 && viewportArea > 0
    ? totalFloorArea / viewportArea
    : null;

  const osr = fsi != null && fsi > 0
    ? (1 - gsi) / fsi
    : null;

  // ── Subtype distribution ────────────────────────────────

  const subtypeDistribution: Record<string, number> = {};
  for (const row of subtypeRows) {
    subtypeDistribution[row.subtype] = Number(row.count);
  }

  // ── Footprint distribution ──────────────────────────────

  const footprintDistribution = footprintRows.map(
    (row) => Number(row.area_m2),
  );

  // ── Fabric score ────────────────────────────────────────

  const fabricIndicators: FabricIndicators = {
    gsi,
    fsi: fsi ?? 0,
    osr: osr ?? 0,
    compactness: Number(r.avg_compactness),
    urbanGrain: Number(r.median_footprint_area_m2),
    fractalDimension: r.fractal_dimension != null
      ? Number(r.fractal_dimension)
      : null,
    buildingCount,
    avgHeight: r.avg_height_m != null ? Number(r.avg_height_m) : null,
    heightCoverage,
    earliestConstructionYear: null,
    latestConstructionYear: null,
    recentOsmBuildings: null,
  };

  const fabricResult = scoreFabric(fabricIndicators);

  // ── Assemble result ─────────────────────────────────────

  return {
    buildingCount,
    totalFootprintAreaM2: totalFootprint,
    avgFootprintAreaM2: Number(r.avg_footprint_area_m2),
    buildingsWithHeight,
    avgHeightM: r.avg_height_m != null ? Number(r.avg_height_m) : null,
    avgFloors: r.avg_floors != null ? Number(r.avg_floors) : null,
    heightCoverage,
    viewportAreaM2: viewportArea,
    gsi,
    fsi,
    osr,
    compactness: Number(r.avg_compactness),
    urbanGrain: Number(r.median_footprint_area_m2),
    fractalDimension: r.fractal_dimension != null
      ? Number(r.fractal_dimension)
      : null,
    fabricScore: fabricResult.score,
    footprintDistribution,
    subtypeDistribution,
  };
}

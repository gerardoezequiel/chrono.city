import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { AmenityMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';
import { classifyFifteenMin } from '@/shared/utils/fifteen-min';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

interface CategoryRow {
  primary_category: string | null;
  count: number;
}

export async function queryPlaces(bbox: BBox, polygonWkt?: string): Promise<AmenityMetrics> {
  const spatialFilter = polygonWkt ? ` AND ST_Intersects(geometry, ST_GeomFromText('${polygonWkt}'))` : '';
  const sql = `
    SELECT
      categories.primary as primary_category,
      COUNT(*) as count
    FROM read_parquet('${S3_PATHS.places}', hive_partitioning=1)
    WHERE ${BBOX_PRED(bbox)}${spatialFilter}
    GROUP BY categories.primary
    ORDER BY count DESC
  `;

  const rows = await query<CategoryRow>(sql);

  const categoryDistribution: Record<string, number> = {};
  let totalPOIs = 0;

  for (const row of rows) {
    const cat = row.primary_category ?? 'uncategorized';
    categoryDistribution[cat] = Number(row.count);
    totalPOIs += Number(row.count);
  }

  // Top 10 categories
  const topCategories = Object.entries(categoryDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  return {
    poiCount: totalPOIs,
    uniqueCategories: Object.keys(categoryDistribution).length,
    categoryDistribution,
    topCategories,
    fifteenMinCategories: classifyFifteenMin(categoryDistribution),
  };
}

import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { WalkabilityMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';
import { FIFTEEN_MIN_CATEGORIES } from '@/config/walkability';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

interface CategoryRow {
  primary_category: string;
  cnt: number;
}

/**
 * Compute walkability metrics: 15-minute city completeness,
 * social density, and category-level service coverage.
 */
export async function queryWalkability(bbox: BBox): Promise<WalkabilityMetrics> {
  // Estimate study area in hectares
  const latMid = (bbox.north + bbox.south) / 2;
  const dLat = (bbox.north - bbox.south) * 111.139;
  const dLng = (bbox.east - bbox.west) * 111.139 * Math.cos(latMid * Math.PI / 180);
  const areaHa = Math.max(dLat * dLng * 100, 0.01); // km² → ha

  const sql = `
    SELECT
      categories.primary AS primary_category,
      COUNT(*) AS cnt
    FROM read_parquet('${S3_PATHS.places}', hive_partitioning=1)
    WHERE ${BBOX_PRED(bbox)}
    GROUP BY categories.primary
  `;

  const rows = await query<CategoryRow>(sql);

  // Map Overture categories to 15-minute city service groups
  const serviceCoverage: Record<string, boolean> = {};
  const serviceCount: Record<string, number> = {};
  let socialPlaceCount = 0;
  let totalPoi = 0;

  for (const group of Object.keys(FIFTEEN_MIN_CATEGORIES)) {
    serviceCoverage[group] = false;
    serviceCount[group] = 0;
  }

  for (const row of rows) {
    const cat = row.primary_category;
    const count = Number(row.cnt);
    totalPoi += count;

    for (const [group, categories] of Object.entries(FIFTEEN_MIN_CATEGORIES)) {
      if (categories.some((c) => cat?.toLowerCase().includes(c))) {
        serviceCoverage[group] = true;
        serviceCount[group] = (serviceCount[group] ?? 0) + count;
      }
    }

    // Social density: cafes, bars, libraries, parks, community centers
    const socialKeywords = ['cafe', 'coffee', 'bar', 'pub', 'library', 'park', 'community', 'social'];
    if (socialKeywords.some((k) => cat?.toLowerCase().includes(k))) {
      socialPlaceCount += count;
    }
  }

  const completeness = Object.values(serviceCoverage).filter(Boolean).length;
  const socialDensity = areaHa > 0 ? socialPlaceCount / areaHa : 0;

  return {
    fifteenMinCompleteness: completeness,
    totalServiceGroups: Object.keys(FIFTEEN_MIN_CATEGORIES).length,
    serviceCoverage,
    serviceCount,
    socialDensity,
    totalPoi,
  };
}

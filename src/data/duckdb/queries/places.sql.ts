import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import type { AmenityMetrics } from '@/shared/types/metrics';
import { query } from '@/data/duckdb/init';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

/** 15-minute city category groups mapped to Overture place categories */
const FIFTEEN_MIN_CATEGORIES: Record<string, string[]> = {
  Grocery: ['food', 'supermarket', 'meat_shop', 'seafood_market', 'beverage_store'],
  Healthcare: ['hospital', 'doctor', 'dentist', 'pharmacy', 'clinic', 'urgent_care_clinic', 'community_health_center'],
  Education: ['school', 'college_university', 'kindergarten', 'library'],
  Transport: ['airport', 'transportation', 'bus_ticket_agency', 'bus_station', 'bus_stop', 'subway_station', 'railway_station'],
  'Green Space': ['park', 'botanical_garden', 'nature_reserve', 'trail', 'beach', 'garden'],
  'Food & Drink': ['restaurant', 'cafe', 'bar'],
  'Sports & Rec': ['sports_and_recreation_venue', 'sports_and_fitness_instruction', 'playground', 'sports_centre'],
  Culture: ['museum', 'cinema', 'performing_arts', 'art_gallery', 'cultural_center', 'library'],
};

/** Categories that count as "third places" for social density */
const SOCIAL_CATEGORIES = new Set(['cafe', 'bar', 'library', 'park', 'community_center', 'restaurant']);

/** Build reverse lookup: category → group name */
function buildCategoryToGroup(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [group, cats] of Object.entries(FIFTEEN_MIN_CATEGORIES)) {
    for (const cat of cats) {
      if (!map.has(cat)) map.set(cat, group);
    }
  }
  return map;
}

const CATEGORY_TO_GROUP = buildCategoryToGroup();

/** Compute normalized Shannon entropy (0-1) from a distribution */
function shannonEntropy(distribution: Record<string, number>): number {
  const entries = Object.values(distribution);
  const total = entries.reduce((s, v) => s + v, 0);
  if (total === 0 || entries.length <= 1) return 0;

  let entropy = 0;
  for (const count of entries) {
    if (count <= 0) continue;
    const p = count / total;
    entropy -= p * Math.log(p);
  }
  const maxEntropy = Math.log(entries.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

interface CategoryRow {
  primary_category: string | null;
  count: number;
}

export async function queryPlaces(bbox: BBox): Promise<AmenityMetrics> {
  const sql = `
    SELECT
      categories.primary as primary_category,
      COUNT(*) as count
    FROM read_parquet('${S3_PATHS.places}', hive_partitioning=1)
    WHERE ${BBOX_PRED(bbox)}
      AND operating_status = 'open'
    GROUP BY categories.primary
    ORDER BY count DESC
  `;

  const rows = await query<CategoryRow>(sql);

  const categoryDistribution: Record<string, number> = {};
  let totalPOIs = 0;
  let socialPlaces = 0;

  const serviceGroupCounts: Record<string, number> = {};
  for (const group of Object.keys(FIFTEEN_MIN_CATEGORIES)) {
    serviceGroupCounts[group] = 0;
  }

  for (const row of rows) {
    const cat = row.primary_category ?? 'uncategorized';
    const count = Number(row.count);
    categoryDistribution[cat] = count;
    totalPOIs += count;

    if (SOCIAL_CATEGORIES.has(cat)) {
      socialPlaces += count;
    }

    const group = CATEGORY_TO_GROUP.get(cat);
    if (group) {
      serviceGroupCounts[group] = (serviceGroupCounts[group] ?? 0) + count;
    }
  }

  const servicePresence: Record<string, boolean> = {};
  let completeness = 0;
  for (const group of Object.keys(FIFTEEN_MIN_CATEGORIES)) {
    const present = (serviceGroupCounts[group] ?? 0) > 0;
    servicePresence[group] = present;
    if (present) completeness++;
  }

  const categoryCount = Object.keys(categoryDistribution).length;

  const topCategories = Object.entries(categoryDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  return {
    poiCount: totalPOIs,
    categoryDistribution,
    topCategories,
    categoryCount,
    fifteenMinCompleteness: completeness,
    servicePresence,
    serviceGroupCounts,
    poiDiversity: shannonEntropy(categoryDistribution),
    socialPlaces,
  };
}

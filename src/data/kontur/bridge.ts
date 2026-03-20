import type { KonturH3Properties } from '@/shared/types/kontur';
import type { OverviewMetrics, BuildingMetrics, NetworkMetrics, AmenityMetrics } from '@/shared/types/metrics';
import { classifyFifteenMin } from '@/shared/utils/fifteen-min';

/**
 * Extracts overview-level urban indicators from a Kontur H3 cell.
 * Simple pass-through + aggregation — no proxy calculations.
 * Full 7-chapter scoring bridge comes with the scoring branch merger.
 */
export function konturToOverview(props: KonturH3Properties): OverviewMetrics {
  return {
    population: props.population ?? 0,
    builtUpFraction: props.built_up_share ?? 0,
    greenCover: (props.trees_share ?? 0) + (props.grass_share ?? 0),
    poiCount: props.all_pois_count ?? 0,
    roadLengthKm: props.all_roads_length_km ?? 0,
    informRisk: props.inform_risk ?? null,
    nightLights: props.nighttime_lights ?? null,
  };
}

/**
 * Maps Kontur H3 building aggregates to BuildingMetrics.
 * Height data is not available in Kontur — those fields are null/zero.
 */
export function konturToBuildings(props: KonturH3Properties): Partial<BuildingMetrics> {
  const typeDist: Record<string, number> = {};
  if (props.residential_buildings_count) typeDist['residential'] = props.residential_buildings_count;
  if (props.commercial_buildings_count) typeDist['commercial'] = props.commercial_buildings_count;
  if (props.industrial_buildings_count) typeDist['industrial'] = props.industrial_buildings_count;

  return {
    buildingCount: props.all_buildings_count ?? 0,
    totalFootprintAreaM2: props.all_buildings_area ?? 0,
    avgFootprintAreaM2: props.all_buildings_avg_area ?? 0,
    buildingsWithHeight: 0,
    avgHeightM: null,
    avgFloors: null,
    heightCoverage: 0,
    buildingTypeDistribution: typeDist,
  };
}

/**
 * Maps Kontur H3 road aggregates to NetworkMetrics.
 * Orientation data cannot be derived from Kontur length aggregates.
 */
export function konturToNetwork(props: KonturH3Properties): Partial<NetworkMetrics> {
  const distribution: Record<string, number> = {};
  if (props.primary_roads_length_km) distribution['primary'] = props.primary_roads_length_km;
  if (props.secondary_roads_length_km) distribution['secondary'] = props.secondary_roads_length_km;
  if (props.tertiary_roads_length_km) distribution['tertiary'] = props.tertiary_roads_length_km;
  if (props.residential_roads_length_km) distribution['residential'] = props.residential_roads_length_km;
  if (props.unclassified_roads_length_km) distribution['unclassified'] = props.unclassified_roads_length_km;

  return {
    totalLengthKm: props.all_roads_length_km ?? 0,
    roadClassDistribution: distribution,
  };
}

/**
 * Maps Kontur H3 POI aggregates to AmenityMetrics.
 * Category names follow Kontur naming (DuckDB overwrites with Overture categories on resolve).
 */
export function konturToAmenities(props: KonturH3Properties): Partial<AmenityMetrics> {
  const distribution: Record<string, number> = {};
  const entries: Array<{ category: string; count: number }> = [];

  const categories: Array<[string, number | null]> = [
    ['food_and_drink', props.food_and_drink_count],
    ['education', props.education_count],
    ['health', props.health_count],
    ['leisure_and_sport', props.leisure_and_sport_count],
    ['shopping', props.shopping_count],
    ['public_service', props.public_service_count],
    ['accommodation', props.accommodation_count],
    ['finance', props.finance_count],
  ];

  for (const [name, value] of categories) {
    if (value != null && value > 0) {
      distribution[name] = value;
      entries.push({ category: name, count: value });
    }
  }

  // Sort descending by count for topCategories
  entries.sort((a, b) => b.count - a.count);

  return {
    poiCount: props.all_pois_count ?? 0,
    uniqueCategories: Object.keys(distribution).length,
    categoryDistribution: distribution,
    topCategories: entries,
    fifteenMinCategories: classifyFifteenMin(distribution),
  };
}

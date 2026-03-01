import type { KonturH3Properties } from '@/shared/types/kontur';
import type { OverviewMetrics } from '@/shared/types/metrics';

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

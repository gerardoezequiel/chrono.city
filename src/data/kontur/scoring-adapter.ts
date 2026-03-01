import type { KonturH3Properties as SharedProps } from '@/shared/types/kontur';
import type { KonturH3Properties as ScoringProps } from '@/data/scoring/types';

/**
 * Maps shared KonturH3Properties (descriptive names) to
 * scoring KonturH3Properties (raw Kontur MVT property names).
 *
 * The shared type was designed for sidebar display with descriptive names,
 * while the scoring type matches Kontur's actual tile property names.
 */
export function sharedToScoringProps(shared: SharedProps): ScoringProps {
  return {
    // Demographics
    population: shared.population ?? undefined,
    // Built Environment
    builtup: shared.built_up_share ?? undefined,
    residential: shared.residential_buildings_count != null
      ? shared.residential_buildings_count
      : undefined,
    industrial_area: shared.industrial_buildings_count != null
      ? shared.industrial_buildings_count
      : undefined,
    building_count: shared.all_buildings_count ?? undefined,
    total_building_count: shared.all_buildings_count ?? undefined,
    total_road_length: shared.all_roads_length_km ?? undefined,
    night_lights_intensity: shared.nighttime_lights ?? undefined,
    // Land Cover
    area_km2: shared.land_total_area_km2 ?? undefined,
    forest: shared.trees_share ?? undefined,
    herbage: shared.grass_share ?? undefined,
    shrubs: shared.shrub_share ?? undefined,
    bare_vegetation: shared.bare_soil_share ?? undefined,
    cropland: shared.crop_share ?? undefined,
    permanent_water: shared.water_share ?? undefined,
    snow_ice: shared.snow_share ?? undefined,
    moss_lichen: shared.moss_share ?? undefined,
    // POIs
    foursquare_os_places_count: shared.all_pois_count ?? undefined,
    eatery_count: shared.food_and_drink_count ?? undefined,
    osm_hospitals_count: shared.health_count ?? undefined,
    osm_schools_count: shared.education_count ?? undefined,
    retail_fsq_count: shared.shopping_count ?? undefined,
    sports_recreation_fsq_count: shared.leisure_and_sport_count ?? undefined,
    // Climate
    avg_temperature: shared.avg_temperature ?? undefined,
    // Risk
    inform_risk_index: shared.inform_risk ?? undefined,
    hazard_exposure: shared.hazard_and_exposure ?? undefined,
    vulnerability: shared.vulnerability ?? undefined,
    lack_of_coping: shared.lack_of_coping_capacity ?? undefined,
  };
}

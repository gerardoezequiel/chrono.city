/**
 * Kontur H3 cell properties from bivariate MVT tiles.
 * Each H3 hex carries 196+ pre-aggregated urban indicators.
 * Grouped by domain for readability.
 */

// ─── Population & Settlement ─────────────────────────────────
export interface KonturPopulationProps {
  population: number | null;
  populated_area_km2: number | null;
  population_density: number | null;
}

// ─── Built Environment ───────────────────────────────────────
export interface KonturBuiltEnvProps {
  urban_core_share: number | null;
  all_buildings_count: number | null;
  all_buildings_avg_area: number | null;
  all_buildings_area: number | null;
  residential_buildings_count: number | null;
  residential_buildings_avg_area: number | null;
  commercial_buildings_count: number | null;
  commercial_buildings_avg_area: number | null;
  industrial_buildings_count: number | null;
  industrial_buildings_avg_area: number | null;
}

// ─── Land Cover ──────────────────────────────────────────────
export interface KonturLandCoverProps {
  land_total_area_km2: number | null;
  trees_share: number | null;
  grass_share: number | null;
  shrub_share: number | null;
  bare_soil_share: number | null;
  built_up_share: number | null;
  water_share: number | null;
  crop_share: number | null;
  snow_share: number | null;
  moss_share: number | null;
  flooded_vegetation_share: number | null;
}

// ─── Points of Interest ──────────────────────────────────────
export interface KonturPOIProps {
  all_pois_count: number | null;
  food_and_drink_count: number | null;
  education_count: number | null;
  health_count: number | null;
  leisure_and_sport_count: number | null;
  shopping_count: number | null;
  public_service_count: number | null;
  accommodation_count: number | null;
  finance_count: number | null;
}

// ─── Transport Infrastructure ────────────────────────────────
export interface KonturTransportProps {
  all_roads_length_km: number | null;
  primary_roads_length_km: number | null;
  secondary_roads_length_km: number | null;
  tertiary_roads_length_km: number | null;
  residential_roads_length_km: number | null;
  unclassified_roads_length_km: number | null;
  railway_length_km: number | null;
}

// ─── Climate & Night Lights ──────────────────────────────────
export interface KonturClimateProps {
  avg_temperature: number | null;
  avg_precipitation: number | null;
  nighttime_lights: number | null;
}

// ─── Risk (INFORM) ───────────────────────────────────────────
export interface KonturRiskProps {
  inform_risk: number | null;
  hazard_and_exposure: number | null;
  vulnerability: number | null;
  lack_of_coping_capacity: number | null;
}

// ─── Combined H3 cell interface ──────────────────────────────

export interface KonturH3Properties extends
  KonturPopulationProps,
  KonturBuiltEnvProps,
  KonturLandCoverProps,
  KonturPOIProps,
  KonturTransportProps,
  KonturClimateProps,
  KonturRiskProps {}

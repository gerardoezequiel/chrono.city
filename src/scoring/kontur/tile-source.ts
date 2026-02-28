/**
 * Kontur Bivariate Tile Source Configuration
 *
 * Defines the MapLibre source and layer configuration for
 * consuming Kontur's H3 indicator tiles. The tiles provide
 * pre-aggregated data at H3 resolution 0–8 (zoom-dependent).
 *
 * 222 datasets organized across 20 categories:
 *   Demographics, Built Environment, Vegetation, Water,
 *   Institutional, Financial, Hospitality, Culture & Heritage,
 *   Waste, Commercial (FSQ), Economic, Climate, INFORM Risk,
 *   Disasters, Energy, OSM Activity, Fire Risk, Displacement
 */

/** Kontur bivariate tile endpoint */
export const KONTUR_TILE_URL =
  'https://disaster.ninja/active/api/tiles/bivariate/v1/{z}/{x}/{y}.mvt?indicatorsClass=general';

/** The single layer name in Kontur MVT tiles */
export const KONTUR_LAYER_NAME = 'stats';

/** Maximum native zoom (data resolution caps at H3 r8) */
export const KONTUR_MAX_ZOOM = 8;

/** Tile extent (Kontur uses 8192, not the default 4096) */
export const KONTUR_TILE_EXTENT = 8192;

/** Zoom → H3 resolution mapping (Kontur's formula) */
export const ZOOM_TO_H3_RES: Record<number, number> = {
  0: 0, 1: 0, 2: 0,
  3: 1,
  4: 2,
  5: 3, 6: 3,
  7: 4,
  8: 5, 9: 5,
  10: 6,
  11: 7,
  12: 8, 13: 8,
};

/**
 * MapLibre source configuration for Kontur indicator tiles.
 */
export const konturSourceConfig = {
  type: 'vector' as const,
  tiles: [KONTUR_TILE_URL],
  tileSize: 512,
  maxzoom: KONTUR_MAX_ZOOM,
  attribution: '© <a href="https://www.kontur.io">Kontur</a>',
};

/**
 * All properties available in Kontur tile features.
 * Organized by domain for clarity.
 */
export const KONTUR_PROPERTY_KEYS = [
  // ── Spatial ──
  'h3', 'area_km2',
  // ── Demographics ──
  'population', 'distance_to_populated',
  'children_0_5', 'elderly_65_plus', 'poverty_households',
  'non_english_speakers', 'workers_without_car', 'people_with_disabilities',
  // ── Built Environment ──
  'builtup', 'residential', 'industrial_area',
  'building_count', 'total_building_count',
  'ghs_avg_building_height', 'total_road_length',
  'night_lights_intensity', 'communication_lines_length',
  'osm_building_earliest_year', 'osm_building_latest_year',
  'osm_recent_buildings_count',
  // ── Vegetation & Land Cover ──
  'forest', 'evergreen_needle_leaved_forest', 'unknown_forest',
  'cropland', 'herbage', 'shrubs', 'bare_vegetation',
  'moss_lichen', 'snow_ice', 'ndvi', 'canopy_height',
  // ── Water ──
  'permanent_water', 'wetland',
  // ── Institutional (OSM) ──
  'osm_schools_count', 'osm_universities_count',
  'osm_colleges_count', 'osm_kindergartens_count',
  'osm_hospitals_count',
  // ── Financial (OSM) ──
  'osm_atm_count', 'osm_bank_count',
  // ── Hospitality (OSM) ──
  'osm_hotel_count', 'osm_hotel_avg_level', 'osm_hotel_max_level',
  // ── Culture & Heritage (OSM) ──
  'osm_art_venues_count', 'osm_cultural_centers_count',
  'osm_entertainment_venues_count', 'osm_heritage_sites_count',
  'osm_museums_historical_count', 'heritage_protection_level',
  // ── Waste Management (OSM) ──
  'waste_containers_count', 'waste_container_coverage',
  // ── Commercial (Foursquare) ──
  'foursquare_os_places_count', 'eatery_count',
  'dining_and_drinking_fsq_count', 'retail_fsq_count',
  'arts_entertainment_fsq_count', 'sports_recreation_fsq_count',
  'landmarks_outdoor_fsq_count', 'travel_transport_fsq_count',
  'business_services_fsq_count', 'events_fsq_count',
  'coffee_shops_fsq_count',
  // ── Economic ──
  'gdp_population',
  // ── Climate ──
  'hot_days_32c_plus1c', 'hot_days_32c_plus2c',
  'hot_nights_25c_plus1c', 'hot_nights_25c_plus2c',
  'wet_bulb_32c_plus2c', 'solar_irradiance',
  'relative_humidity', 'max_wind_speed',
  'avg_temperature', 'temperature_amplitude',
  'min_temperature', 'max_temperature',
  // ── INFORM Risk (0–10 scale) ──
  'inform_risk_index', 'hazard_exposure', 'vulnerability',
  'lack_of_coping', 'conflict_severity', 'water_scarcity',
  'healthcare_access', 'infrastructure_resilience',
  'shelter_availability', 'hdi',
  'earthquake_risk', 'disease_risk', 'governance_stability',
  // ── Disaster Frequency ──
  'flood_days_count', 'cyclone_days_count',
  'drought_days_count', 'volcano_days_count',
  'wildfire_days_count', 'hazardous_days_count',
  // ── Energy ──
  'solar_suitability', 'mv_grid_length',
  // ── OSM Activity ──
  'osm_mapping_hours', 'osm_editor_count', 'osm_avg_edit_date',
  // ── Fire Risk ──
  'fire_risk_score',
  // ── Displacement ──
  'displacement_percentage',
] as const;

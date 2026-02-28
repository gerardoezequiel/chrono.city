/**
 * Chrono Urban Scoring Framework — Domain Types
 *
 * The framework produces a hierarchical score:
 *   Raw Indicators → Normalized [0–100] → Chapter Scores → Chrono Score
 *
 * 7 chapters:
 *   1. Fabric       — How is the city built?
 *   2. Resilience    — Is it mixed, green, and permeable?
 *   3. Vitality      — Can I live here without a car?
 *   4. Connectivity  — Is the grid walkable and efficient?
 *   5. Prosperity    — Is the area economically vibrant?
 *   6. Environment   — What's the forward-looking climate risk?
 *   7. Culture       — What's the cultural infrastructure?
 *
 * Two input modes:
 *   1. Pedshed (browser): DuckDB-WASM queries Overture S3 for a single isochrone
 *   2. H3 Grid (batch): Kontur pre-aggregated indicators per H3 cell
 *
 * Output is audience-agnostic: same scores serve researchers, city councils,
 * real estate platforms, and site selection tools.
 */

// ─── Spatial Context ─────────────────────────────────────────

/** The geometry over which indicators are computed */
export type ScoringContext =
  | { mode: 'pedshed'; origin: { lng: number; lat: number }; minutes: number; areaKm2: number }
  | { mode: 'h3'; h3Index: string; resolution: number; areaKm2: number }
  | { mode: 'bbox'; west: number; south: number; east: number; north: number; areaKm2: number };

// ─── Raw Indicators ──────────────────────────────────────────

// Chapter 1: Urban Fabric (Morphology)

export interface FabricIndicators {
  /** Ground Space Index: footprint area / total area (0–1) */
  gsi: number;
  /** Floor Space Index: total floor area / total area */
  fsi: number;
  /** Open Space Ratio: (1 - GSI) / FSI */
  osr: number;
  /** Building Compactness: avg (4π·area / perimeter²), 0–1 */
  compactness: number;
  /** Median footprint area in m² */
  urbanGrain: number;
  /** Fractal dimension of building perimeters, 1.0–2.0 */
  fractalDimension: number | null;
  /** Total building count */
  buildingCount: number;
  /** Average building height in metres */
  avgHeight: number | null;
  /** Fraction of buildings with height data (data quality) */
  heightCoverage: number;
  /** Earliest building construction year from OSM */
  earliestConstructionYear: number | null;
  /** Latest building construction year from OSM */
  latestConstructionYear: number | null;
  /** Buildings mapped in OSM in last 6 months (data freshness) */
  recentOsmBuildings: number | null;
}

// Chapter 2: Land Use & Resilience

export interface ResilienceIndicators {
  /** Land use entropy (Shannon), normalized 0–1 */
  landUseMix: number;
  /** Green / vegetation cover fraction, 0–1 */
  canopyCover: number;
  /** Distance to nearest park ≥0.5ha, in metres */
  parkProximity: number;
  /** Impervious surface fraction: (buildings + roads) / area */
  imperviousness: number;
  /** Fraction of street frontage with commercial/civic use */
  activeFrontage: number | null;
  /** Night lights intensity (proxy for heat island) */
  nightLights: number | null;
  /** Average max temperature (WorldClim) */
  avgMaxTemp: number | null;
  /** Hot nights per year — min temp > 25°C */
  hotNightsPerYear: number | null;
  /** Normalized Difference Vegetation Index, -1 to 1 */
  ndvi: number | null;
  /** Average canopy height in metres (tree maturity) */
  canopyHeight: number | null;
  /** Wetland fraction of area */
  wetlandFraction: number | null;
  /** Bare/sparse vegetation fraction */
  bareVegetation: number | null;
}

// Chapter 3: Amenities (Vitality)

export interface VitalityIndicators {
  /** Count of distinct 15-min city category groups present (0–8) */
  fifteenMinCompleteness: number;
  /** Average nearest-neighbor distance for retail, normalized */
  retailClustering: number | null;
  /** Third places (café, pub, library, park) per hectare */
  socialDensity: number;
  /** Distance to nearest supermarket/market in metres */
  freshFoodAccess: number;
  /** Weighted sum: grocery + pharmacy + school + transit (0–100) */
  dailyNeedsIndex: number;
  /** Total POI count */
  poiCount: number;
  /** Shannon entropy of POI categories, normalized 0–1 */
  poiDiversity: number;
  /** Foursquare / OSM place count */
  foursquarePlaces: number | null;
  /** Dining & drinking venues */
  diningDrinking: number | null;
  /** Eatery count */
  eateryCount: number | null;
  /** Retail venue count */
  retailCount: number | null;
  /** Arts & entertainment FSQ POIs */
  artsEntertainmentPoi: number | null;
  /** Sports & recreation FSQ POIs */
  sportsRecreationPoi: number | null;
  /** Coffee shop POIs */
  coffeeShopPoi: number | null;
  /** Landmarks & outdoor FSQ POIs */
  landmarksOutdoorPoi: number | null;
  /** Travel & transportation FSQ POIs */
  travelTransportPoi: number | null;
  /** Hospital/healthcare facility count */
  hospitalCount: number | null;
  /** Waste container area coverage fraction */
  wasteContainerCoverage: number | null;
}

// Chapter 4: Network (Connectivity)

export interface ConnectivityIndicators {
  /** Intersections (3+ way) per km² */
  intersectionDensity: number;
  /** Network efficiency: isochrone area / circle area (0–1) */
  alphaScore: number;
  /** Street orientation entropy (0–1, 1 = perfectly uniform) */
  orientationEntropy: number;
  /** Dead-end nodes / total nodes (0–1) */
  deadEndRatio: number;
  /** (footway + cycleway length) / total road length */
  activeTransportShare: number;
  /** Total road length in km */
  totalRoadLength: number;
  /** Total intersection count */
  intersectionCount: number;
  /** Total communication line length in km */
  communicationLinesLength: number | null;
}

// Chapter 5: Prosperity (Economic Vibrancy)

export interface ProsperityIndicators {
  /** GDP per capita × population in area (spending power proxy) */
  gdpPopulation: number | null;
  /** Night lights intensity (economic activity proxy) */
  nightLightsEconomic: number | null;
  /** Hotel count from OSM */
  hotelCount: number | null;
  /** Average hotel quality level (OSM stars) */
  hotelAvgLevel: number | null;
  /** Max hotel quality level in area */
  hotelMaxLevel: number | null;
  /** ATM count from OSM (financial infrastructure) */
  atmCount: number | null;
  /** Bank count from OSM */
  bankCount: number | null;
  /** Business & professional services POIs (FSQ) */
  businessServicesPoi: number | null;
  /** Industrial area fraction */
  industrialArea: number | null;
  /** Retail FSQ POI count (commercial density) */
  retailPoiEconomic: number | null;
  /** Events POIs (FSQ — event economy) */
  eventsPoi: number | null;
}

// Chapter 6: Environment (Climate & Disaster Risk)

export interface EnvironmentIndicators {
  /** Days/year with max temp >32°C at +1°C warming */
  hotDaysPlus1C: number | null;
  /** Days/year with max temp >32°C at +2°C warming */
  hotDaysPlus2C: number | null;
  /** Days/year with min temp >25°C at +1°C warming (tropical nights) */
  hotNightsPlus1C: number | null;
  /** Days/year with min temp >25°C at +2°C warming */
  hotNightsPlus2C: number | null;
  /** Days/year with wet-bulb temp >32°C at +2°C (lethal heat) */
  wetBulbDaysPlus2C: number | null;
  /** Total shortwave solar irradiance (kWh/m²) */
  solarIrradiance: number | null;
  /** Relative humidity percentage */
  relativeHumidity: number | null;
  /** Max wind speed (m/s) */
  maxWindSpeed: number | null;
  /** Monthly average air temperature (°C) */
  avgTemperature: number | null;
  /** INFORM Risk composite index (0–10) */
  informRiskIndex: number | null;
  /** INFORM hazard exposure sub-index (0–10) */
  hazardExposure: number | null;
  /** INFORM vulnerability sub-index (0–10) */
  vulnerability: number | null;
  /** INFORM lack of coping capacity (0–10) */
  lackOfCoping: number | null;
  /** Water scarcity risk (0–10) */
  waterScarcity: number | null;
  /** Flood days in last year */
  floodDaysCount: number | null;
  /** Cyclone days in last year */
  cycloneDaysCount: number | null;
  /** Drought days in last year */
  droughtDaysCount: number | null;
  /** Wildfire/thermal anomaly days per year */
  wildfireDaysCount: number | null;
  /** Volcano days in last year */
  volcanoDaysCount: number | null;
  /** Total hazardous days in last year */
  hazardousDaysCount: number | null;
  /** Solar farm suitability (0–1) */
  solarSuitability: number | null;
}

// Chapter 7: Culture (Cultural Capital)

export interface CultureIndicators {
  /** Art venue count from OSM */
  artVenues: number | null;
  /** Cultural & community center count from OSM */
  culturalCenters: number | null;
  /** Entertainment venue count from OSM */
  entertainmentVenues: number | null;
  /** Heritage site count from OSM */
  heritageSites: number | null;
  /** Museums & historical site count from OSM */
  museumsHistorical: number | null;
  /** Heritage protection level (admin significance) */
  heritageProtectionLevel: number | null;
  /** Arts & entertainment POIs from Foursquare */
  artsEntertainmentFsq: number | null;
  /** Landmarks & outdoor POIs from Foursquare */
  landmarksOutdoorFsq: number | null;
  /** Events POIs from Foursquare */
  eventsFsq: number | null;
  /** College count (cultural/academic hubs) */
  collegeCount: number | null;
  /** University count (knowledge infrastructure) */
  universityCount: number | null;
}

// ─── Aggregate Raw Indicators ────────────────────────────────

/** All raw indicators for a single spatial unit */
export interface RawIndicators {
  fabric: FabricIndicators;
  resilience: ResilienceIndicators;
  vitality: VitalityIndicators;
  connectivity: ConnectivityIndicators;
  prosperity: ProsperityIndicators;
  environment: EnvironmentIndicators;
  culture: CultureIndicators;
}

// ─── Normalization ───────────────────────────────────────────

/** How a raw value maps to 0–100 */
export type NormalizationCurve =
  | { type: 'linear'; min: number; max: number; invert?: boolean }
  | { type: 'triangular'; peak: number; min: number; max: number }
  | { type: 'logarithmic'; min: number; max: number; invert?: boolean }
  | { type: 'threshold'; thresholds: number[]; scores: number[] }
  | { type: 'sigmoid'; midpoint: number; steepness: number; invert?: boolean };

export interface NormalizationSpec {
  key: string;
  label: string;
  curve: NormalizationCurve;
  /** Academic reference for the chosen range */
  reference: string;
  /** What a high score means in plain language */
  interpretation: string;
}

// ─── Chapter Scores ──────────────────────────────────────────

export interface ChapterWeight {
  indicatorKey: string;
  weight: number;
  /** Human explanation of why this weight */
  rationale: string;
}

export interface ChapterScore {
  /** Chapter name */
  chapter: ChapterName;
  /** Composite score 0–100 */
  score: number;
  /** Letter grade */
  grade: Grade;
  /** Individual normalized indicator scores (0–100 each) */
  components: Record<string, number>;
  /** Confidence 0–1 based on data availability */
  confidence: number;
  /** Plain-language summary for city council audiences */
  summary: string;
}

export type ChapterName =
  | 'fabric'
  | 'resilience'
  | 'vitality'
  | 'connectivity'
  | 'prosperity'
  | 'environment'
  | 'culture';

// ─── Composite Score ─────────────────────────────────────────

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ChronoScore {
  /** Master score 0–100 */
  score: number;
  /** Letter grade */
  grade: Grade;
  /** Breakdown by chapter */
  chapters: Record<ChapterName, ChapterScore>;
  /** Spatial context this was computed for */
  context: ScoringContext;
  /** Overall data confidence 0–1 */
  confidence: number;
  /** ISO timestamp of computation */
  computedAt: string;
  /** Framework version for reproducibility */
  version: string;
}

// ─── Kontur H3 Bridge ────────────────────────────────────────

/** Properties available in Kontur bivariate MVT tile features.
 *
 * This is the exhaustive set of indicators available from
 * Kontur's 222-dataset catalog, organized by domain.
 * All properties are optional since coverage varies by region.
 */
export interface KonturH3Properties {
  // ── Spatial ──
  h3?: string;
  area_km2?: number;

  // ── Demographics ──
  population?: number;
  /** Distance to nearest populated cell (pop>80), metres */
  distance_to_populated?: number;
  /** US: children ages 0–5 (ACS) */
  children_0_5?: number;
  /** US: elderly 65+ (ACS) */
  elderly_65_plus?: number;
  /** US: households below poverty line (ACS) */
  poverty_households?: number;
  /** US: difficulty speaking English (ACS) */
  non_english_speakers?: number;
  /** US: workers without a car (ACS) */
  workers_without_car?: number;
  /** US: people with disabilities (ACS) */
  people_with_disabilities?: number;

  // ── Built Environment ──
  builtup?: number;
  residential?: number;
  industrial_area?: number;
  building_count?: number;
  total_building_count?: number;
  ghs_avg_building_height?: number;
  total_road_length?: number;
  night_lights_intensity?: number;
  /** Total length of communication lines (km) */
  communication_lines_length?: number;
  /** Earliest construction year of buildings in OSM */
  osm_building_earliest_year?: number;
  /** Latest construction year of buildings in OSM */
  osm_building_latest_year?: number;
  /** Buildings mapped in OSM in last 6 months */
  osm_recent_buildings_count?: number;

  // ── Vegetation & Land Cover ──
  forest?: number;
  evergreen_needle_leaved_forest?: number;
  unknown_forest?: number;
  cropland?: number;
  herbage?: number;
  shrubs?: number;
  bare_vegetation?: number;
  moss_lichen?: number;
  snow_ice?: number;
  /** Normalized Difference Vegetation Index */
  ndvi?: number;
  /** Canopy height in metres (ML-derived from satellite) */
  canopy_height?: number;

  // ── Water ──
  permanent_water?: number;
  wetland?: number;

  // ── Institutional (OSM) ──
  osm_schools_count?: number;
  osm_universities_count?: number;
  osm_colleges_count?: number;
  osm_kindergartens_count?: number;
  osm_hospitals_count?: number;

  // ── Financial (OSM) ──
  osm_atm_count?: number;
  osm_bank_count?: number;

  // ── Hospitality (OSM) ──
  osm_hotel_count?: number;
  osm_hotel_avg_level?: number;
  osm_hotel_max_level?: number;

  // ── Culture & Heritage (OSM) ──
  osm_art_venues_count?: number;
  osm_cultural_centers_count?: number;
  osm_entertainment_venues_count?: number;
  osm_heritage_sites_count?: number;
  osm_museums_historical_count?: number;
  heritage_protection_level?: number;

  // ── Waste Management (OSM) ──
  waste_containers_count?: number;
  waste_container_coverage?: number;

  // ── Commercial (Foursquare) ──
  foursquare_os_places_count?: number;
  eatery_count?: number;
  dining_and_drinking_fsq_count?: number;
  retail_fsq_count?: number;
  arts_entertainment_fsq_count?: number;
  sports_recreation_fsq_count?: number;
  landmarks_outdoor_fsq_count?: number;
  travel_transport_fsq_count?: number;
  business_services_fsq_count?: number;
  events_fsq_count?: number;
  coffee_shops_fsq_count?: number;

  // ── Economic ──
  /** GDP per capita × population in cell */
  gdp_population?: number;

  // ── Climate (WorldClim + Kontur) ──
  /** Days/year max temp >32°C at +1°C warming */
  hot_days_32c_plus1c?: number;
  /** Days/year max temp >32°C at +2°C warming */
  hot_days_32c_plus2c?: number;
  /** Days/year min temp >25°C at +1°C warming */
  hot_nights_25c_plus1c?: number;
  /** Days/year min temp >25°C at +2°C warming */
  hot_nights_25c_plus2c?: number;
  /** Days/year wet-bulb >32°C at +2°C warming */
  wet_bulb_32c_plus2c?: number;
  /** Shortwave solar irradiance (kWh/m²) */
  solar_irradiance?: number;
  /** Relative humidity (%) */
  relative_humidity?: number;
  /** Max wind speed, 60min (m/s) */
  max_wind_speed?: number;
  /** Monthly average air temperature (°C) */
  avg_temperature?: number;
  /** Monthly temperature amplitude (°C) */
  temperature_amplitude?: number;
  /** Monthly minimum temperature (°C) */
  min_temperature?: number;
  /** Monthly maximum temperature (°C) */
  max_temperature?: number;

  // ── INFORM Risk Sub-indices (0–10 scale) ──
  inform_risk_index?: number;
  hazard_exposure?: number;
  vulnerability?: number;
  lack_of_coping?: number;
  conflict_severity?: number;
  water_scarcity?: number;
  healthcare_access?: number;
  infrastructure_resilience?: number;
  shelter_availability?: number;
  /** Human Development Index (0–1) */
  hdi?: number;
  /** Earthquake risk (0–10) */
  earthquake_risk?: number;
  /** Disease outbreak risk (0–10) */
  disease_risk?: number;
  /** Governance stability (0–10) */
  governance_stability?: number;

  // ── Disaster Frequency ──
  flood_days_count?: number;
  cyclone_days_count?: number;
  drought_days_count?: number;
  volcano_days_count?: number;
  wildfire_days_count?: number;
  hazardous_days_count?: number;

  // ── Energy ──
  /** Solar farm suitability (0–1) */
  solar_suitability?: number;
  /** Medium voltage grid presence */
  mv_grid_length?: number;

  // ── OSM Mapping Activity ──
  osm_mapping_hours?: number;
  osm_editor_count?: number;
  osm_avg_edit_date?: number;

  // ── Fire Risk ──
  fire_risk_score?: number;

  // ── Displacement ──
  displacement_percentage?: number;
}

// ─── Output Formats ──────────────────────────────────────────

/** Flat row for CSV/Parquet export or API response */
export interface ScoredH3Cell {
  h3_index: string;
  resolution: number;
  area_km2: number;
  // Master
  chrono_score: number;
  chrono_grade: Grade;
  // Chapters (all 7)
  fabric_score: number;
  resilience_score: number;
  vitality_score: number;
  connectivity_score: number;
  prosperity_score: number;
  environment_score: number;
  culture_score: number;
  // Key indicators (flattened for easy consumption)
  population: number;
  building_density: number;
  green_cover: number;
  poi_density: number;
  intersection_density: number;
  gdp_proxy: number;
  inform_risk: number;
  cultural_pois: number;
  // Confidence
  data_confidence: number;
}

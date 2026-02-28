/**
 * Chrono Urban Scoring Framework — Domain Types
 *
 * The framework produces a hierarchical score:
 *   Raw Indicators → Normalized [0–100] → Chapter Scores → Chrono Score
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

/** Raw values before normalization — the measured reality */
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
}

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
  /** Night lights intensity (Kontur, proxy for heat island) */
  nightLights: number | null;
  /** Average max temperature (Kontur climate indicator) */
  avgMaxTemp: number | null;
  /** Hot nights per year — min temp > 25°C (Kontur) */
  hotNightsPerYear: number | null;
}

export interface VitalityIndicators {
  /** Count of distinct 15-min city category groups present (0–6) */
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
  /** Foursquare / OSM place count (Kontur) */
  foursquarePlaces: number | null;
  /** Dining & drinking venues (Kontur) */
  diningDrinking: number | null;
  /** Eatery count (Kontur) */
  eateryCount: number | null;
  /** Retail venue count (Kontur) */
  retailCount: number | null;
}

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
}

/** All raw indicators for a single spatial unit */
export interface RawIndicators {
  fabric: FabricIndicators;
  resilience: ResilienceIndicators;
  vitality: VitalityIndicators;
  connectivity: ConnectivityIndicators;
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

export type ChapterName = 'fabric' | 'resilience' | 'vitality' | 'connectivity';

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

/** Properties available in a Kontur bivariate MVT tile feature */
export interface KonturH3Properties {
  // Spatial
  h3?: string;
  area_km2?: number;
  // Demographics
  population?: number;
  // Built environment
  builtup?: number;
  residential?: number;
  industrial_area?: number;
  building_count?: number;
  total_building_count?: number;
  ghs_avg_building_height?: number;
  total_road_length?: number;
  night_lights_intensity?: number;
  // Vegetation & land cover
  forest?: number;
  evergreen_needle_leaved_forest?: number;
  unknown_forest?: number;
  cropland?: number;
  herbage?: number;
  shrubs?: number;
  bare_vegetation?: number;
  moss_lichen?: number;
  snow_ice?: number;
  // Water
  permanent_water?: number;
  wetland?: number;
  // Institutional
  osm_schools_count?: number;
  osm_universities_count?: number;
  osm_colleges_count?: number;
  osm_kindergartens_count?: number;
  // Commercial
  foursquare_os_places_count?: number;
  eatery_count?: number;
  dining_and_drinking_fsq_count?: number;
  retail_fsq_count?: number;
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
  // Chapters
  fabric_score: number;
  resilience_score: number;
  vitality_score: number;
  connectivity_score: number;
  // Key indicators (flattened for easy consumption)
  population: number;
  building_density: number;
  green_cover: number;
  poi_density: number;
  intersection_density: number;
  // Confidence
  data_confidence: number;
}

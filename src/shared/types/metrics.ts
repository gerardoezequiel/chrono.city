export type DataState = 'idle' | 'loading' | 'loaded' | 'error';

export interface SectionData<T> {
  state: DataState;
  data: T | null;
  error: string | null;
  queryMs: number | null;
}

export type MetricUnit =
  | 'integer'
  | 'decimal'
  | 'ratio'
  | 'percentage'
  | 'm2'
  | 'ha'
  | 'km'
  | 'per_km2'
  | 'bits'
  | 'score';

export interface MetricDescriptor {
  key: string;
  label: string;
  unit: MetricUnit;
  description: string;
  precision?: number;
  lazy?: boolean;
  requiresIsochrone?: boolean;
}

// ─── Section metrics interfaces ─────────────────────────────

export interface BuildingMetrics {
  buildingCount: number;
  totalFootprintAreaM2: number;
  avgFootprintAreaM2: number;
  buildingsWithHeight: number;
  avgHeightM: number | null;
  avgFloors: number | null;
  heightCoverage: number;
  /** Ground Space Index: footprint area / study area (0–1) */
  gsi?: number;
  /** Floor Space Index: total floor area / study area */
  fsi?: number;
  /** Open Space Ratio: (1 - GSI) / FSI */
  osr?: number | null;
  /** Building Compactness: avg (4*PI*area / perimeter²), 0–1 */
  compactness?: number | null;
  /** Median building footprint area in m² (urban grain) */
  medianFootprintM2?: number | null;
}

export interface NetworkMetrics {
  segmentCount: number;
  totalLengthKm: number;
  roadClassDistribution: Record<string, number>;
  orientationEntropy?: number;
  gridOrder?: number;
  dominantBearing?: number;
  orientation?: { bins: number[]; dominantBearing: number };
  /** Advanced metrics (Phase 4) */
  intersectionDensity?: number;
  intersectionCount?: number;
  deadEndRatio?: number;
  activeTransportShare?: number;
  /** Beta index: edges / nodes — higher = more connected */
  betaIndex?: number;
  /** Gamma index: edges / max possible edges (0–1) */
  gammaIndex?: number;
}

export interface AmenityMetrics {
  poiCount: number;
  categoryDistribution: Record<string, number>;
  topCategories: Array<{ category: string; count: number }>;
}

// ─── Overview metrics (Kontur H3) ───────────────────────────

export interface OverviewMetrics {
  population: number;
  builtUpFraction: number;
  greenCover: number;
  poiCount: number;
  roadLengthKm: number;
  informRisk: number | null;
  nightLights: number | null;
}

// ─── Walkability metrics (Phase 7) ──────────────────────────

export interface WalkabilityMetrics {
  /** Count of distinct 15-min city service groups present */
  fifteenMinCompleteness: number;
  /** Total possible service groups */
  totalServiceGroups: number;
  /** Per-group boolean coverage */
  serviceCoverage: Record<string, boolean>;
  /** Per-group POI count */
  serviceCount: Record<string, number>;
  /** Third places (cafe, bar, library, park) per hectare */
  socialDensity: number;
  /** Total POI count */
  totalPoi: number;
}

// ─── Type-safe section → metrics mapping ────────────────────

export interface SectionMetricsMap {
  overview: OverviewMetrics;
  buildings: BuildingMetrics;
  network: NetworkMetrics;
  amenities: AmenityMetrics;
  walkability: WalkabilityMetrics;
}

export type SectionId = keyof SectionMetricsMap;

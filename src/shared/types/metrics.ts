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
  heightDistribution: Record<string, number>;
}

export interface NetworkMetrics {
  segmentCount: number;
  totalLengthKm: number;
  roadClassDistribution: Record<string, number>;
  orientationEntropy?: number;
  gridOrder?: number;
  dominantBearing?: number;
  orientation?: { bins: number[]; dominantBearing: number };
  activeTransportShare?: number;
  intersectionDensity?: number;
  deadEndRatio?: number;
}

export interface AmenityMetrics {
  poiCount: number;
  categoryDistribution: Record<string, number>;
  topCategories: Array<{ category: string; count: number }>;
  categoryCount: number;
  fifteenMinCompleteness: number;
  servicePresence: Record<string, boolean>;
  serviceGroupCounts: Record<string, number>;
  poiDiversity: number;
  socialPlaces: number;
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

export interface WalkabilityMetrics {
  intersectionCount: number;
  intersectionDensity: number;
  deadEndCount: number;
  deadEndRatio: number;
  activeTransportShare: number;
  totalNodes: number;
  segmentCount: number;
  totalLengthKm: number;
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

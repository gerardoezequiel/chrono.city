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
}

export interface NetworkMetrics {
  segmentCount: number;
  totalLengthKm: number;
  roadClassDistribution: Record<string, number>;
}

export interface AmenityMetrics {
  poiCount: number;
  categoryDistribution: Record<string, number>;
  topCategories: Array<{ category: string; count: number }>;
}

// ─── Type-safe section → metrics mapping ────────────────────

export interface SectionMetricsMap {
  overview: Record<string, never>;
  buildings: BuildingMetrics;
  network: NetworkMetrics;
  amenities: AmenityMetrics;
}

export type SectionId = keyof SectionMetricsMap;

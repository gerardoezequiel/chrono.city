import type { BuildingMetrics } from '@/shared/types/metrics';

export interface CoreRow {
  building_count: number;
  total_footprint_area_m2: number;
  avg_footprint_area_m2: number;
  median_footprint_area_m2: number;
  buildings_with_height: number;
  avg_height_m: number | null;
  avg_floors: number | null;
  total_floor_area_m2: number;
  avg_compactness: number;
  fractal_dimension: number | null;
  viewport_area_m2: number;
}

export interface SubtypeRow {
  subtype: string;
  count: number;
}

export interface FootprintRow {
  area_m2: number;
}

export const EMPTY_METRICS: BuildingMetrics = {
  buildingCount: 0,
  totalFootprintAreaM2: 0,
  avgFootprintAreaM2: 0,
  buildingsWithHeight: 0,
  avgHeightM: null,
  avgFloors: null,
  heightCoverage: 0,
  viewportAreaM2: 0,
  gsi: 0,
  fsi: null,
  osr: null,
  compactness: 0,
  urbanGrain: 0,
  fractalDimension: null,
  fabricScore: null,
  footprintDistribution: [],
  subtypeDistribution: {},
};

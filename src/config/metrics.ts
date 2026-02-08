import type { MetricDescriptor } from '@/shared/types/metrics';

export const BUILDING_METRICS: MetricDescriptor[] = [
  { key: 'buildingCount', label: 'Buildings', unit: 'integer', description: 'Total building footprints in area' },
  { key: 'totalFootprintAreaM2', label: 'Total Footprint', unit: 'ha', description: 'Sum of all building ground-floor areas' },
  { key: 'avgFootprintAreaM2', label: 'Avg Footprint', unit: 'm2', description: 'Mean building ground-floor area' },
  { key: 'avgHeightM', label: 'Avg Height', unit: 'decimal', description: 'Mean building height (where available)', precision: 1 },
  { key: 'heightCoverage', label: 'Height Data', unit: 'percentage', description: 'Proportion of buildings with height data' },
];

export const NETWORK_METRICS: MetricDescriptor[] = [
  { key: 'segmentCount', label: 'Road Segments', unit: 'integer', description: 'Total road segments in area' },
  { key: 'totalLengthKm', label: 'Network Length', unit: 'decimal', description: 'Total road network length in km', precision: 1 },
];

export const AMENITY_METRICS: MetricDescriptor[] = [
  { key: 'poiCount', label: 'Places', unit: 'integer', description: 'Total points of interest' },
];

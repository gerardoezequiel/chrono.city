import type { MetricDescriptor } from '@/shared/types/metrics';

export const OVERVIEW_METRICS: MetricDescriptor[] = [
  { key: 'population', label: 'Population', unit: 'integer', description: 'Estimated population in H3 cell' },
  { key: 'builtUpFraction', label: 'Built-up', unit: 'percentage', description: 'Share of land covered by built structures' },
  { key: 'greenCover', label: 'Green Cover', unit: 'percentage', description: 'Combined tree and grass coverage' },
  { key: 'poiCount', label: 'POIs', unit: 'integer', description: 'Points of interest in cell' },
  { key: 'roadLengthKm', label: 'Road Network', unit: 'decimal', description: 'Total road length in km', precision: 1 },
  { key: 'informRisk', label: 'INFORM Risk', unit: 'score', description: 'INFORM risk index (0–10)' },
  { key: 'nightLights', label: 'Night Lights', unit: 'decimal', description: 'Nighttime radiance index', precision: 1 },
];

export const BUILDING_METRICS: MetricDescriptor[] = [
  { key: 'buildingCount', label: 'Buildings', unit: 'integer', description: 'Total building footprints in area' },
  { key: 'totalFootprintAreaM2', label: 'Total Footprint', unit: 'ha', description: 'Sum of all building ground-floor areas' },
  { key: 'gsi', label: 'Ground Coverage', unit: 'ratio', description: 'Building footprint / viewport area (GSI)', precision: 2 },
  { key: 'fsi', label: 'Floor Intensity', unit: 'ratio', description: 'Total floor area / viewport area (FSI)', precision: 2 },
  { key: 'osr', label: 'Open Space Ratio', unit: 'ratio', description: 'Available open space per m² of floor area', precision: 2 },
  { key: 'compactness', label: 'Compactness', unit: 'ratio', description: 'Avg shape efficiency (1.0=circle)', precision: 2 },
  { key: 'urbanGrain', label: 'Urban Grain', unit: 'm2', description: 'Median building footprint area' },
  { key: 'fractalDimension', label: 'Complexity', unit: 'ratio', description: 'Geometric complexity (1.0-2.0)', precision: 2 },
  { key: 'avgHeightM', label: 'Avg Height', unit: 'decimal', description: 'Mean building height (where available)', precision: 1 },
  { key: 'heightCoverage', label: 'Height Data', unit: 'percentage', description: 'Buildings with height data' },
  { key: 'fabricScore', label: 'Fabric Score', unit: 'score', description: 'Composite urban fabric quality (0-100)' },
];

export const NETWORK_METRICS: MetricDescriptor[] = [
  { key: 'segmentCount', label: 'Road Segments', unit: 'integer', description: 'Total road segments in area' },
  { key: 'totalLengthKm', label: 'Network Length', unit: 'decimal', description: 'Total road network length in km', precision: 1 },
  { key: 'orientationEntropy', label: 'Grid Entropy', unit: 'ratio', description: 'Street orientation uniformity (0=grid, 1=random)', precision: 2 },
  { key: 'gridOrder', label: 'Grid Order', unit: 'ratio', description: 'Directional concentration of street network', precision: 2 },
];

export const AMENITY_METRICS: MetricDescriptor[] = [
  { key: 'poiCount', label: 'Places', unit: 'integer', description: 'Total points of interest' },
];

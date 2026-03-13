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
  { key: 'avgFootprintAreaM2', label: 'Avg Footprint', unit: 'm2', description: 'Mean building ground-floor area' },
  { key: 'avgHeightM', label: 'Avg Height', unit: 'decimal', description: 'Mean building height (where available)', precision: 1 },
  { key: 'heightCoverage', label: 'Height Data', unit: 'percentage', description: 'Proportion of buildings with height data' },
];

export const NETWORK_METRICS: MetricDescriptor[] = [
  { key: 'segmentCount', label: 'Road Segments', unit: 'integer', description: 'Total road segments in area' },
  { key: 'totalLengthKm', label: 'Network Length', unit: 'decimal', description: 'Total road network length in km', precision: 1 },
  { key: 'orientationEntropy', label: 'Grid Entropy', unit: 'ratio', description: 'Street orientation uniformity (0=grid, 1=random)', precision: 2 },
  { key: 'gridOrder', label: 'Grid Order', unit: 'ratio', description: 'Directional concentration of street network', precision: 2 },
];

export const AMENITY_METRICS: MetricDescriptor[] = [
  { key: 'poiCount', label: 'Places', unit: 'integer', description: 'Total points of interest' },
  { key: 'categoryCount', label: 'Categories', unit: 'integer', description: 'Distinct place categories' },
  { key: 'fifteenMinCompleteness', label: '15-Min Score', unit: 'score', description: 'Essential service groups present (0-8)' },
  { key: 'poiDiversity', label: 'Diversity', unit: 'ratio', description: 'Category diversity (Shannon entropy)', precision: 2 },
  { key: 'socialPlaces', label: 'Social Places', unit: 'integer', description: 'Third places: cafes, bars, libraries, parks' },
];

export const WALKABILITY_METRICS: MetricDescriptor[] = [
  { key: 'intersectionCount', label: 'Intersections', unit: 'integer', description: 'Nodes where 3+ roads meet' },
  { key: 'intersectionDensity', label: 'Intersection Density', unit: 'per_km2', description: 'Intersections per km² (>100 = walkable)', precision: 0 },
  { key: 'deadEndRatio', label: 'Dead-End Ratio', unit: 'percentage', description: 'Fraction of nodes that are cul-de-sacs' },
  { key: 'activeTransportShare', label: 'Active Transport', unit: 'percentage', description: 'Footway + cycleway share of network' },
  { key: 'totalLengthKm', label: 'Network Length', unit: 'decimal', description: 'Total road network length in km', precision: 1 },
];

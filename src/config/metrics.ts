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
  { key: 'gsi', label: 'GSI', unit: 'ratio', description: 'Ground Space Index: footprint coverage. >0.5 = compact, <0.15 = sprawl', precision: 2 },
  { key: 'fsi', label: 'FSI', unit: 'ratio', description: 'Floor Space Index: building intensity accounting for height', precision: 2 },
  { key: 'osr', label: 'OSR', unit: 'ratio', description: 'Open Space Ratio: pressure on open space per m² of floor area', precision: 2 },
  { key: 'compactness', label: 'Compactness', unit: 'ratio', description: 'Building shape efficiency (1.0 = circle, lower = irregular)', precision: 2 },
  { key: 'medianFootprintM2', label: 'Urban Grain', unit: 'm2', description: 'Median building size. <150m² = fine grain, >1000m² = mega-structures' },
  { key: 'avgHeightM', label: 'Avg Height', unit: 'decimal', description: 'Mean building height (where available)', precision: 1 },
  { key: 'heightCoverage', label: 'Height Data', unit: 'percentage', description: 'Proportion of buildings with height data' },
];

export const NETWORK_METRICS: MetricDescriptor[] = [
  { key: 'segmentCount', label: 'Road Segments', unit: 'integer', description: 'Total road segments in area' },
  { key: 'totalLengthKm', label: 'Network Length', unit: 'decimal', description: 'Total road network length in km', precision: 1 },
  { key: 'intersectionDensity', label: 'Intersections', unit: 'per_km2', description: 'Intersections (3+ way) per km². >100 = walkable, <50 = car-dependent', precision: 0 },
  { key: 'deadEndRatio', label: 'Dead Ends', unit: 'percentage', description: 'Dead-end nodes / total nodes. Lower = more connected grid', precision: 1 },
  { key: 'activeTransportShare', label: 'Active Transport', unit: 'percentage', description: 'Footway + cycleway share of total road length', precision: 1 },
  { key: 'betaIndex', label: 'Beta Index', unit: 'ratio', description: 'Edges/nodes — >1 indicates a connected network', precision: 2 },
  { key: 'gammaIndex', label: 'Gamma Index', unit: 'ratio', description: 'Edges/max edges — network completeness (0–1)', precision: 2 },
  { key: 'orientationEntropy', label: 'Grid Entropy', unit: 'ratio', description: 'Street orientation uniformity (0=grid, 1=random)', precision: 2 },
  { key: 'gridOrder', label: 'Grid Order', unit: 'ratio', description: 'Directional concentration of street network', precision: 2 },
];

export const AMENITY_METRICS: MetricDescriptor[] = [
  { key: 'poiCount', label: 'Places', unit: 'integer', description: 'Total points of interest' },
];

export const WALKABILITY_METRICS: MetricDescriptor[] = [
  { key: 'fifteenMinCompleteness', label: '15-Min Score', unit: 'integer', description: 'Service groups present out of 6 essential categories' },
  { key: 'socialDensity', label: 'Social Density', unit: 'decimal', description: 'Third places (cafes, bars, libraries, parks) per hectare', precision: 2 },
  { key: 'totalPoi', label: 'Total Services', unit: 'integer', description: 'Total points of interest in study area' },
];

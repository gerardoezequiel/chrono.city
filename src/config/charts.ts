import type { ChartBinding } from '@/features/charts/types';

/** Road class → color map. Shared between map layer styling and chart legend. */
export const ROAD_CLASS_COLORS: Record<string, string> = {
  motorway: '#7f1d1d',
  trunk: '#991b1b',
  primary: '#b91c1c',
  secondary: '#dc2626',
  tertiary: '#ef4444',
  residential: '#f87171',
  living_street: '#fca5a5',
  unclassified: '#fb923c',
  footway: '#171717',
  pedestrian: '#171717',
  path: '#404040',
  cycleway: '#525252',
  unknown: '#a3a3a3',
};

export const OVERVIEW_CHARTS: ChartBinding[] = [];

export const BUILDING_CHARTS: ChartBinding[] = [
  { type: 'bar', dataKey: 'heightDistribution', title: 'Height Distribution' },
];

export const NETWORK_CHARTS: ChartBinding[] = [
  {
    type: 'bar',
    dataKey: 'roadClassDistribution',
    title: 'Road Classes',
    options: { colorMap: ROAD_CLASS_COLORS },
  },
  { type: 'rose', dataKey: 'orientation', title: 'Street Orientation' },
];

/** 15-min city service group → color map */
export const SERVICE_GROUP_COLORS: Record<string, string> = {
  Grocery: '#16a34a',
  Healthcare: '#dc2626',
  Education: '#2563eb',
  Transport: '#7c3aed',
  'Green Space': '#15803d',
  'Food & Drink': '#ea580c',
  'Sports & Rec': '#0891b2',
  Culture: '#c026d3',
};

export const AMENITY_CHARTS: ChartBinding[] = [
  { type: 'checklist', dataKey: 'servicePresence', title: '15-Minute City Services' },
  { type: 'bar', dataKey: 'serviceGroupCounts', title: 'Service Coverage', options: { colorMap: SERVICE_GROUP_COLORS } },
];

export const WALKABILITY_CHARTS: ChartBinding[] = [];

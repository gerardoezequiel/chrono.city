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

export const BUILDING_CHARTS: ChartBinding[] = [];

export const NETWORK_CHARTS: ChartBinding[] = [
  {
    type: 'bar',
    dataKey: 'roadClassDistribution',
    title: 'Road Classes',
    options: { colorMap: ROAD_CLASS_COLORS },
  },
  { type: 'rose', dataKey: 'orientation', title: 'Street Orientation' },
];

export const AMENITY_CHARTS: ChartBinding[] = [
  { type: 'bar', dataKey: 'categoryDistribution', title: 'Place Categories' },
];

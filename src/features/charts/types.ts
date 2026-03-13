export type ChartType = 'bar' | 'distribution' | 'donut' | 'rose' | 'radar' | 'checklist';

export interface ChartBinding {
  type: ChartType;
  dataKey: string;
  title: string;
  options?: ChartOptions;
}

export interface ChartOptions {
  maxCategories?: number;
  height?: number;
  colorScheme?: string[];
  /** Per-label color map — turns chart into a legend */
  colorMap?: Record<string, string>;
  logScale?: boolean;
}

/** Common props accepted by all chart components */
export interface ChartProps {
  data: unknown;
  options?: ChartOptions;
}

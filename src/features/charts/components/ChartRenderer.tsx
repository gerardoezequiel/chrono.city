import { memo } from 'react';
import type { ChartBinding, ChartProps } from '../types';
import { MiniBar } from './MiniBar';
import { MiniDonut } from './MiniDonut';
import { MiniRadar } from './MiniRadar';
import { ServiceChecklist } from './ServiceChecklist';
import { OrientationRose } from './OrientationRose';

type ChartComponent = React.ComponentType<ChartProps>;

/** Adapter: wraps OrientationRose to accept ChartProps */
function RoseAdapter({ data }: ChartProps): React.ReactElement | null {
  if (!data || typeof data !== 'object') return null;
  const result = data as { bins?: number[]; dominantBearing?: number };
  if (!Array.isArray(result.bins)) return null;
  return <OrientationRose bins={result.bins} dominantBearing={result.dominantBearing ?? 0} />;
}

const CHART_COMPONENTS: Record<string, ChartComponent> = {
  bar: MiniBar,
  donut: MiniDonut,
  radar: MiniRadar,
  checklist: ServiceChecklist,
  rose: RoseAdapter,
};

interface ChartRendererProps {
  binding: ChartBinding;
  data: Record<string, unknown> | null;
}

/**
 * Maps a ChartBinding → the correct chart component.
 * Returns null if data key is missing or component not found.
 */
function ChartRendererRaw({ binding, data }: ChartRendererProps): React.ReactElement | null {
  if (!data) return null;

  const chartData = data[binding.dataKey];
  if (chartData == null) return null;

  const Component = CHART_COMPONENTS[binding.type];
  if (!Component) return null;

  return (
    <div className="mt-3">
      <h4 className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1">{binding.title}</h4>
      <Component data={chartData} options={binding.options} />
    </div>
  );
}

export const ChartRenderer = memo(ChartRendererRaw);

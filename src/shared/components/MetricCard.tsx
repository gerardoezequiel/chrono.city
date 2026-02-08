import type { MetricUnit } from '@/shared/types/metrics';
import { formatMetric } from '@/shared/utils/format';

interface MetricCardProps {
  label: string;
  value: number | null | undefined;
  unit: MetricUnit;
  precision?: number;
}

export function MetricCard({ label, value, unit, precision }: MetricCardProps): React.ReactElement {
  const formatted = formatMetric(value, unit, precision);

  return (
    <div className="border border-neutral-200 p-3 text-center">
      <p className="font-mono text-lg font-bold text-neutral-900 tabular-nums tracking-tight">
        {formatted}
      </p>
      <p className="font-mono text-[9px] text-neutral-400 mt-1 uppercase tracking-widest">
        {label}
      </p>
    </div>
  );
}

import { memo } from 'react';
import type { MetricUnit } from '@/shared/types/metrics';
import { formatMetric } from '@/shared/utils/format';
import { useCountUp } from '@/shared/hooks/useCountUp';

interface MetricCardProps {
  label: string;
  value: number | null | undefined;
  unit: MetricUnit;
  precision?: number;
  /** Skip count-up animation (e.g. during drag for instant feedback) */
  instant?: boolean;
}

function MetricCardRaw({ label, value, unit, precision, instant }: MetricCardProps): React.ReactElement {
  const animated = useCountUp(instant ? null : value);
  const displayValue = instant ? value : animated;
  const formatted = formatMetric(displayValue, unit, precision);

  return (
    <div className="border border-neutral-200 p-3 text-center">
      <p className="font-mono text-lg font-bold text-neutral-900 tabular-nums tracking-tight">
        {formatted}
      </p>
      <p className="font-mono text-[11px] md:text-[9px] text-neutral-400 mt-1 uppercase tracking-widest">
        {label}
      </p>
    </div>
  );
}

export const MetricCard = memo(MetricCardRaw);

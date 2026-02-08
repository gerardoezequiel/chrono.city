import type { MetricDescriptor, DataState } from '@/shared/types/metrics';
import { MetricCard } from '@/shared/components/MetricCard';
import { SkeletonMetric } from '@/shared/components/SkeletonMetric';

interface SectionShellProps {
  title: string;
  description: string;
  state: DataState;
  error: string | null;
  descriptors: MetricDescriptor[];
  data: Record<string, unknown> | null;
  queryMs: number | null;
  children?: React.ReactNode;
}

export function SectionShell({
  title,
  description,
  state,
  error,
  descriptors,
  data,
  queryMs,
  children,
}: SectionShellProps): React.ReactElement {
  return (
    <div className="px-6 py-5 border-b border-neutral-200">
      <div className="flex items-baseline justify-between">
        <h3 className="font-heading text-sm font-bold text-neutral-900 uppercase tracking-tight">{title}</h3>
        {state === 'loaded' && queryMs != null && (
          <span className="font-mono text-[8px] text-neutral-300 tabular-nums">{queryMs.toFixed(0)}ms</span>
        )}
      </div>
      <p className="font-mono text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wider">{description}</p>

      {state === 'error' && error && (
        <p className="font-mono text-[10px] text-red-500 mt-3">{error}</p>
      )}

      {(state === 'idle' || state === 'loading') && descriptors.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {descriptors.map((d) => <SkeletonMetric key={d.key} />)}
        </div>
      )}

      {state === 'loaded' && data && descriptors.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {descriptors.map((d) => (
            <MetricCard
              key={d.key}
              label={d.label}
              value={data[d.key] as number | null}
              unit={d.unit}
              precision={d.precision}
            />
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

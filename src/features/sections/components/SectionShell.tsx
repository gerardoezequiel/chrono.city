import { memo } from 'react';
import type { MetricDescriptor, DataState } from '@/shared/types/metrics';
import type { ChartBinding } from '@/features/charts/types';
import { MetricCard } from '@/shared/components/MetricCard';
import { SkeletonMetric } from '@/shared/components/SkeletonMetric';
import { ChartRenderer } from '@/features/charts';

interface SectionShellProps {
  title: string;
  description: string;
  state: DataState;
  error: string | null;
  descriptors: MetricDescriptor[];
  data: Record<string, unknown> | null;
  queryMs: number | null;
  /** Narrative intro text shown immediately (visual phase) */
  narrative?: string;
  /** Map hint text shown during visual phase */
  mapHint?: string;
  /** Chart bindings to render after resolved metrics */
  charts?: ChartBinding[];
  /** True when showing PMTiles preview data before DuckDB resolves */
  isEstimate?: boolean;
  children?: React.ReactNode;
}

/**
 * Three-phase section reveal:
 * 1. VISUAL — narrative text + map hint (instant, 0ms)
 * 2. COMPUTING — narrative + skeleton metrics + progress (1-15s)
 * 3. RESOLVED — narrative + animated metrics + charts (instant transition)
 */
function SectionShellRaw({
  title,
  description,
  state,
  error,
  descriptors,
  data,
  queryMs,
  narrative,
  mapHint,
  charts,
  isEstimate,
  children,
}: SectionShellProps): React.ReactElement {
  const hasMetrics = descriptors.length > 0;
  const isLoading = state === 'idle' || state === 'loading';
  const isResolved = state === 'loaded' && data != null;

  return (
    <div className="px-4 md:px-6 py-4 md:py-5 border-b border-neutral-200">
      {/* Header with timing badge */}
      <div className="flex items-baseline justify-between">
        <h3 className="font-heading text-sm font-bold text-neutral-900 uppercase tracking-tight">{title}</h3>
        <div className="flex items-center gap-2">
          {isEstimate && (
            <span className="font-mono text-[11px] md:text-[8px] text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-neutral-400 animate-pulse" />
              Preview
            </span>
          )}
          {!isEstimate && state === 'loading' && (
            <span className="font-mono text-[11px] md:text-[8px] text-neutral-400 uppercase tracking-wider animate-pulse">
              Analyzing...
            </span>
          )}
          {isResolved && queryMs != null && !isEstimate && (
            <span className="font-mono text-[11px] md:text-[8px] text-neutral-300 tabular-nums">{queryMs.toFixed(0)}ms</span>
          )}
        </div>
      </div>
      <p className="font-mono text-[12px] md:text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wider">{description}</p>

      {/* Phase 1: Narrative — always visible when available */}
      {narrative && (
        <p className="font-mono text-[13px] md:text-[11px] text-neutral-500 mt-3 leading-relaxed">
          {narrative}
        </p>
      )}

      {/* Map hint — shown during visual/loading phase */}
      {mapHint && isLoading && hasMetrics && (
        <p className="font-mono text-[12px] md:text-[10px] text-neutral-400 mt-2 italic leading-relaxed">
          {mapHint}
        </p>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <p className="font-mono text-[12px] md:text-[10px] text-red-500 mt-3">{error}</p>
      )}

      {/* Phase 2: Skeleton metrics — loading phase */}
      {isLoading && hasMetrics && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {descriptors.map((d) => <SkeletonMetric key={d.key} />)}
        </div>
      )}

      {/* Phase 3: Resolved metrics with count-up animation */}
      {isResolved && hasMetrics && (
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

      {/* Charts — rendered after resolved metrics */}
      {isResolved && charts && charts.length > 0 && charts.map((b) => (
        <ChartRenderer key={b.dataKey} binding={b} data={data} />
      ))}

      {children}
    </div>
  );
}

export const SectionShell = memo(SectionShellRaw);

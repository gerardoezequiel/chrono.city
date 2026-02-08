import type { MetricUnit } from '@/shared/types/metrics';

/** Format a metric value for display based on unit type */
export function formatMetric(value: number | null | undefined, unit: MetricUnit, precision?: number): string {
  if (value == null) return '—';

  switch (unit) {
    case 'integer':
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    case 'decimal':
      return value.toLocaleString('en-US', { minimumFractionDigits: precision ?? 1, maximumFractionDigits: precision ?? 1 });
    case 'ratio':
      return value.toFixed(precision ?? 2);
    case 'percentage':
      return `${(value * 100).toFixed(precision ?? 0)}%`;
    case 'm2':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} m²`;
    case 'ha':
      return `${(value / 10_000).toFixed(precision ?? 1)} ha`;
    case 'km':
      return `${(value / 1_000).toFixed(precision ?? 1)} km`;
    case 'per_km2':
      return `${value.toFixed(precision ?? 0)} / km²`;
    case 'bits':
      return `${value.toFixed(precision ?? 2)} bits`;
    case 'score':
      return value.toFixed(precision ?? 0);
    default:
      return String(value);
  }
}

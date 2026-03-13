import type { SectionId } from '@/shared/types/metrics';
import type { MetricDescriptor } from '@/shared/types/metrics';
import { SECTION_REGISTRY } from '@/config/sections';

/**
 * Export all loaded section metrics as a CSV file.
 * Generates a single-row CSV with all metrics flattened.
 */
export function exportMetricsCsv(
  sectionData: Partial<Record<SectionId, Record<string, unknown> | null>>,
  origin?: { lat: number; lng: number } | null,
): void {
  const headers: string[] = [];
  const values: string[] = [];

  if (origin) {
    headers.push('latitude', 'longitude');
    values.push(origin.lat.toFixed(6), origin.lng.toFixed(6));
  }

  for (const section of SECTION_REGISTRY) {
    const data = sectionData[section.id];
    if (!data) continue;

    for (const metric of section.metrics) {
      const key = `${section.id}_${metric.key}`;
      const value = data[metric.key];
      headers.push(key);
      values.push(formatValue(value, metric));
    }
  }

  if (headers.length === 0) return;

  const csv = headers.join(',') + '\n' + values.join(',') + '\n';
  downloadCsv(csv, `chrono-city-${new Date().toISOString().slice(0, 10)}.csv`);
}

function formatValue(value: unknown, descriptor: MetricDescriptor): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    return descriptor.precision != null
      ? value.toFixed(descriptor.precision)
      : String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

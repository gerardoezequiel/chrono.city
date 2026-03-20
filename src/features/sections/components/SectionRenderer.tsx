import { useRef, useMemo, memo } from 'react';
import type { BBox } from '@/shared/types/geo';
import type { SectionId } from '@/shared/types/metrics';
import { useSectionData } from '@/data/hooks/useSectionData';
import { getSectionConfig } from '@/config/sections';
import { SECTION_NARRATIVES } from '@/config/narratives';
import { SectionShell } from './SectionShell';

interface SectionRendererProps {
  sectionId: SectionId;
  bbox: BBox | null;
  activeSection: SectionId;
  isDragging: boolean;
  preview?: Record<string, unknown> | null;
  konturData?: Record<string, unknown> | null;
  polygonWkt?: string;
}

/**
 * Generic registry-driven section component.
 * Reads config from SECTION_REGISTRY and renders SectionShell
 * with the section's metrics, charts, and narrative.
 *
 * High watermark: once a section becomes active, it stays enabled
 * forever (never unloads data on scroll-away).
 *
 * Preview merge: PMTiles preview fills metrics instantly,
 * DuckDB overrides when ready.
 */
function SectionRendererRaw({ sectionId, bbox, activeSection, isDragging, preview, konturData, polygonWkt }: SectionRendererProps): React.ReactElement | null {
  const config = getSectionConfig(sectionId);

  // High watermark — once scrolled to, stay enabled forever
  const hasBeenActiveRef = useRef(false);
  if (activeSection === sectionId) hasBeenActiveRef.current = true;
  const enabled = hasBeenActiveRef.current && !isDragging;

  const { data, state, error, queryMs } = useSectionData(sectionId, bbox, enabled, polygonWkt);
  const narrative = SECTION_NARRATIVES[sectionId as keyof typeof SECTION_NARRATIVES];

  // Three-source merge: DuckDB > PMTiles > Kontur (last write wins)
  const { displayData, dataSource } = useMemo(() => {
    if (data) {
      const base = data as Record<string, unknown>;
      const merged = preview ? { ...preview, ...base } : base;
      return { displayData: merged, dataSource: 'duckdb' as const };
    }
    if (preview) {
      const merged = konturData ? { ...konturData, ...preview } : preview;
      return { displayData: merged, dataSource: 'pmtiles' as const };
    }
    if (konturData) {
      return { displayData: konturData, dataSource: 'kontur' as const };
    }
    return { displayData: null, dataSource: null };
  }, [data, preview, konturData]);

  // If any pre-DuckDB data available, skip skeletons
  const displayState = (!data && displayData) ? 'loaded' as const : state;

  if (!config) return null;

  return (
    <div data-section-id={sectionId}>
      <SectionShell
        title={config.name}
        description={config.description}
        state={displayState}
        error={error}
        descriptors={config.metrics}
        data={displayData}
        queryMs={queryMs}
        narrative={narrative?.intro}
        mapHint={narrative?.mapHint}
        charts={config.charts}
        dataSource={dataSource}
      />
    </div>
  );
}

export const SectionRenderer = memo(SectionRendererRaw);

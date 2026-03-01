import { useRef, useMemo, memo } from 'react';
import type { BBox } from '@/shared/types/geo';
import type { SectionId } from '@/shared/types/metrics';
import { useSectionData } from '@/data/hooks/useSectionData';
import { getSectionConfig } from '@/config/sections';
import { SECTION_NARRATIVES } from '@/config/narratives';
import { SectionShell } from './SectionShell';

interface SectionRendererProps {
  sectionId: SectionId;
  bbox: BBox;
  activeSection: SectionId;
  isDragging: boolean;
  preview?: Record<string, unknown> | null;
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
function SectionRendererRaw({ sectionId, bbox, activeSection, isDragging, preview }: SectionRendererProps): React.ReactElement | null {
  const config = getSectionConfig(sectionId);

  // High watermark — once scrolled to, stay enabled forever
  const hasBeenActiveRef = useRef(false);
  if (activeSection === sectionId) hasBeenActiveRef.current = true;
  const enabled = hasBeenActiveRef.current && !isDragging;

  const { data, state, error, queryMs } = useSectionData(sectionId, bbox, enabled);
  const narrative = SECTION_NARRATIVES[sectionId as keyof typeof SECTION_NARRATIVES];

  // Merge: DuckDB overrides preview, preview fills gaps
  const displayData = useMemo(() => {
    if (data) {
      const base = data as Record<string, unknown>;
      return preview ? { ...preview, ...base } : base;
    }
    return preview ?? null;
  }, [data, preview]);

  // If preview available but DuckDB not yet loaded, skip skeletons
  const displayState = (!data && preview) ? 'loaded' as const : state;
  const isEstimate = state !== 'loaded' && preview != null;

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
        isEstimate={isEstimate}
      />
    </div>
  );
}

export const SectionRenderer = memo(SectionRendererRaw);

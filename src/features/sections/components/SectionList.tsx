import { useMemo } from 'react';
import type { DataState } from '@/shared/types/metrics';
import type { KonturH3Properties } from '@/shared/types/kontur';
import type { ChronoScore as ChronoScoreType } from '@/data/scoring/types';
import type { LngLat } from '@/shared/types/geo';
import { originToBbox } from '@/data/cache/bbox-quantize';
import { OVERVIEW_METRICS } from '@/config/metrics';
import { SECTION_REGISTRY } from '@/config/sections';
import { SECTION_NARRATIVES } from '@/config/narratives';
import { konturToOverview } from '@/data/kontur/bridge';
import type { SectionId } from '@/shared/types/metrics';
import type { MapPreviews } from '@/features/map';
import { SectionShell } from './SectionShell';
import { SectionRenderer } from './SectionRenderer';
import { ChronoScore } from './ChronoScore';

interface SectionListProps {
  origin: LngLat;
  konturCell: KonturH3Properties | null;
  konturState: DataState;
  chronoScore: ChronoScoreType | null;
  activeSection: SectionId;
  isDragging: boolean;
  previews: MapPreviews;
}

export function SectionList({ origin, konturCell, konturState, chronoScore, activeSection, isDragging, previews }: SectionListProps): React.ReactElement {
  const bbox = useMemo(() => originToBbox(origin), [origin]);

  return (
    <div className="flex flex-col">
      <KonturOverviewSection
        konturCell={konturCell}
        konturState={konturState}
        chronoScore={chronoScore}
      />
      {SECTION_REGISTRY
        .filter((s) => s.id !== 'overview' && s.query != null)
        .map((s) => (
          <SectionRenderer
            key={s.id}
            sectionId={s.id}
            bbox={bbox}
            activeSection={activeSection}
            isDragging={isDragging}
            preview={previews[s.id] ?? null}
          />
        ))}
    </div>
  );
}

// ─── Overview section with Kontur H3 data + progressive Chrono Score ──────────

function KonturOverviewSection({
  konturCell,
  konturState,
  chronoScore,
}: {
  konturCell: KonturH3Properties | null;
  konturState: DataState;
  chronoScore: ChronoScoreType | null;
}): React.ReactElement {
  const narrative = SECTION_NARRATIVES.overview;
  const overview = useMemo(
    () => konturCell ? konturToOverview(konturCell) : null,
    [konturCell],
  );
  const overviewCharts = SECTION_REGISTRY.find((s) => s.id === 'overview')?.charts;

  return (
    <div data-section-id="overview">
      <ChronoScore score={chronoScore} />
      <SectionShell
        title="Overview"
        description="Key walkability metrics at a glance"
        state={konturState}
        error={null}
        descriptors={OVERVIEW_METRICS}
        data={overview as Record<string, unknown> | null}
        queryMs={null}
        narrative={narrative?.intro}
        mapHint={narrative?.mapHint}
        charts={overviewCharts}
      />
    </div>
  );
}

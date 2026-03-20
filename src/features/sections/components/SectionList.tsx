import { useMemo } from 'react';
import type { DataState } from '@/shared/types/metrics';
import type { KonturH3Properties } from '@/shared/types/kontur';
import type { ChronoScore as ChronoScoreType } from '@/data/scoring/types';
import type { StudyArea } from '@/shared/types/geo';
import { OVERVIEW_METRICS } from '@/config/metrics';
import { SECTION_REGISTRY } from '@/config/sections';
import { SECTION_NARRATIVES } from '@/config/narratives';
import { konturToOverview } from '@/data/kontur/bridge';
import { useKonturSectionData } from '@/data/hooks/useKonturSectionData';
import type { SectionId } from '@/shared/types/metrics';
import type { MapPreviews } from '@/features/map';
import { SectionShell } from './SectionShell';
import { SectionRenderer } from './SectionRenderer';
import { ChronoScore } from './ChronoScore';

interface SectionListProps {
  studyArea: StudyArea | null;
  konturCell: KonturH3Properties | null;
  konturState: DataState;
  chronoScore: ChronoScoreType | null;
  activeSection: SectionId;
  isDragging: boolean;
  previews: MapPreviews;
}

export function SectionList({ studyArea, konturCell, konturState, chronoScore, activeSection, isDragging, previews }: SectionListProps): React.ReactElement {

  // Static hook calls — hooks can't be in loops/conditionals
  const konturBuildings = useKonturSectionData(konturCell, 'buildings');
  const konturNetwork = useKonturSectionData(konturCell, 'network');
  const konturAmenities = useKonturSectionData(konturCell, 'amenities');

  const konturMap: Partial<Record<SectionId, Record<string, unknown> | null>> = {
    buildings: konturBuildings,
    network: konturNetwork,
    amenities: konturAmenities,
  };

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
            bbox={studyArea?.bbox ?? null}
            activeSection={activeSection}
            isDragging={isDragging}
            preview={previews[s.id] ?? null}
            konturData={konturMap[s.id] ?? null}
            polygonWkt={studyArea?.polygonWkt}
          />
        ))}
    </div>
  );
}

// ─── Overview section with Kontur H3 data + progressive Chrono Score ──────────

const CHAPTER_LABELS: Record<string, string> = {
  fabric: 'Fabric',
  resilience: 'Resilience',
  vitality: 'Vitality',
  connectivity: 'Connectivity',
  prosperity: 'Prosperity',
  environment: 'Environment',
  culture: 'Culture',
};

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

  // Merge chapter scores into overview data for the radar chart
  const overviewWithChapters = useMemo(() => {
    if (!overview) return null;
    const base = { ...overview } as Record<string, unknown>;
    if (chronoScore) {
      base.chapterScores = Object.entries(chronoScore.chapters).map(([key, ch]) => ({
        label: CHAPTER_LABELS[key] ?? key,
        value: ch.score,
        max: 100,
      }));
    }
    return base;
  }, [overview, chronoScore]);

  return (
    <div data-section-id="overview">
      <ChronoScore score={chronoScore} />
      <SectionShell
        title="Overview"
        description="Key walkability metrics at a glance"
        state={konturState}
        error={null}
        descriptors={OVERVIEW_METRICS}
        data={overviewWithChapters}
        queryMs={null}
        narrative={narrative?.intro}
        mapHint={narrative?.mapHint}
        charts={overviewCharts}
      />
    </div>
  );
}

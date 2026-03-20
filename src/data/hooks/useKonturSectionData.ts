import { useMemo } from 'react';
import type { KonturH3Properties } from '@/shared/types/kontur';
import type { SectionId } from '@/shared/types/metrics';
import { konturToBuildings, konturToNetwork, konturToAmenities } from '@/data/kontur/bridge';

/**
 * Derives section-specific metrics from a Kontur H3 cell.
 * Returns null when konturCell is null or section has no Kontur mapping.
 * Overview is handled separately by KonturOverviewSection.
 */
export function useKonturSectionData(
  konturCell: KonturH3Properties | null,
  sectionId: SectionId,
): Record<string, unknown> | null {
  return useMemo(() => {
    if (!konturCell) return null;

    switch (sectionId) {
      case 'buildings':
        return konturToBuildings(konturCell) as Record<string, unknown>;
      case 'network':
        return konturToNetwork(konturCell) as Record<string, unknown>;
      case 'amenities':
        return konturToAmenities(konturCell) as Record<string, unknown>;
      default:
        return null;
    }
  }, [konturCell, sectionId]);
}

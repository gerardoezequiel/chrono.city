import { useMemo } from 'react';
import type { KonturH3Properties } from '@/shared/types/kontur';
import type { ChronoScore } from '@/data/scoring/types';
import { sharedToScoringProps } from '@/data/kontur/scoring-adapter';
import { scoreH3Cell } from '@/data/scoring';

/**
 * Computes a full 7-chapter Chrono Score from a Kontur H3 cell.
 * Maps shared properties → scoring properties → RawIndicators → ChronoScore.
 * Memoized on cell reference.
 */
export function useChronoScore(konturCell: KonturH3Properties | null): ChronoScore | null {
  return useMemo(() => {
    if (!konturCell) return null;

    try {
      const scoringProps = sharedToScoringProps(konturCell);
      const h3Index = (konturCell as unknown as Record<string, unknown>)['h3'] as string | undefined;
      return scoreH3Cell(scoringProps, h3Index ?? 'unknown');
    } catch (e) {
      console.warn('[useChronoScore] scoring failed:', e);
      return null;
    }
  }, [konturCell]);
}

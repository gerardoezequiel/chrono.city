/**
 * Chapter 1: Urban Fabric (Morphology)
 *
 * Question: "How is the city built?"
 * Audience value:
 *   - Researchers: GSI/FSI/OSR classification system
 *   - City council: "Is this neighborhood too dense or too sparse?"
 *   - Real estate: "What kind of development fits here?"
 *   - Site selection: "Is this area compact-walkable or sprawl?"
 *
 * References:
 *   Berghauser Pont & Haupt (2010) — Spacematrix density typology
 *   Alexander (1977) — A Pattern Language: urban grain
 *   Fleischmann et al. (2021) — Morphometric analysis
 *   Batty & Longley (1994) — Fractal Cities
 *   Jacobs (1961) — The Death and Life of Great American Cities
 */

import type { FabricIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { FABRIC_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeFabric } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'gsi', weight: 0.25, rationale: 'Ground coverage is the primary density measure in Spacematrix' },
  { indicatorKey: 'urbanGrain', weight: 0.25, rationale: 'Fine grain is the strongest predictor of walkable neighborhoods' },
  { indicatorKey: 'compactness', weight: 0.20, rationale: 'Energy-efficient form reduces environmental impact' },
  { indicatorKey: 'fractalDimension', weight: 0.10, rationale: 'Complexity indicates evolved, mature urban form' },
  { indicatorKey: 'fsi', weight: 0.10, rationale: 'Intensity supports diversity but weighs less than ground form' },
  { indicatorKey: 'buildingAge', weight: 0.10, rationale: 'Building age diversity supports mixed use and character' },
];

export function scoreFabric(indicators: FabricIndicators): ChapterScore {
  const norm = (key: string, value: number | null): number => {
    const spec = FABRIC_NORMS.find(n => n.key === key);
    return spec ? normalize(value, spec.curve) : 0;
  };

  const components: Record<string, number> = {
    gsi: norm('gsi', indicators.gsi),
    fsi: norm('fsi', indicators.fsi),
    compactness: norm('compactness', indicators.compactness),
    urbanGrain: norm('urbanGrain', indicators.urbanGrain),
    fractalDimension: norm('fractalDimension', indicators.fractalDimension),
    buildingAge: norm('buildingAge', indicators.earliestConstructionYear),
  };

  // Confidence: penalize if we're missing height data (needed for FSI)
  let confidence = 1.0;
  if (indicators.heightCoverage < 0.3) {
    confidence *= 0.7;
    components['fsi'] = (components['fsi'] ?? 0) * indicators.heightCoverage / 0.3;
  }
  if (indicators.fractalDimension == null) {
    confidence *= 0.9;
    components['fractalDimension'] = 50;
  }
  if (indicators.earliestConstructionYear == null) {
    confidence *= 0.95;
    components['buildingAge'] = 50;
  }

  // Boost confidence if we have recent OSM mapping activity
  if (indicators.recentOsmBuildings != null && indicators.recentOsmBuildings > 10) {
    confidence = Math.min(confidence * 1.05, 1.0);
  }

  const score = weightedAverage(components, WEIGHTS);

  return {
    chapter: 'fabric',
    score,
    grade: computeGrade(score),
    components,
    confidence,
    summary: summarizeFabric(score, indicators),
  };
}

/**
 * Chapter 2: Land Use & Resilience
 *
 * Question: "Is it mixed, green, and climate-ready?"
 * Audience value:
 *   - Researchers: Land use entropy, imperviousness metrics
 *   - City council: "Are we hitting the 3-30-300 green targets?"
 *   - Real estate: "Is this area climate-resilient long term?"
 *   - Site selection: "Flood risk? Heat island? Green premium?"
 *
 * References:
 *   Song et al. (2013) — Land use mix measurement
 *   Konijnendijk (2023) — 3-30-300 Rule for urban forestry
 *   WHO (2016) — Urban Green Spaces and Health
 *   White et al. (2020) — Imperviousness and flood risk
 */

import type { ResilienceIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { RESILIENCE_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeResilience } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'landUseMix', weight: 0.25, rationale: 'Functional mix is the strongest predictor of car-independence' },
  { indicatorKey: 'canopyCover', weight: 0.25, rationale: '3-30-300 Rule: 30% canopy is the established green benchmark' },
  { indicatorKey: 'imperviousness', weight: 0.20, rationale: 'Sealed surfaces drive flood risk and urban heat island' },
  { indicatorKey: 'parkProximity', weight: 0.15, rationale: 'WHO: every home within 300m of a park' },
  { indicatorKey: 'hotNightsPerYear', weight: 0.15, rationale: 'Climate adaptation is increasingly critical for livability' },
];

export function scoreResilience(indicators: ResilienceIndicators): ChapterScore {
  const norm = (key: string, value: number | null): number => {
    const spec = RESILIENCE_NORMS.find(n => n.key === key);
    return spec ? normalize(value, spec.curve) : 0;
  };

  const components: Record<string, number> = {
    landUseMix: norm('landUseMix', indicators.landUseMix),
    canopyCover: norm('canopyCover', indicators.canopyCover),
    imperviousness: norm('imperviousness', indicators.imperviousness),
    parkProximity: norm('parkProximity', indicators.parkProximity),
    hotNightsPerYear: norm('hotNightsPerYear', indicators.hotNightsPerYear),
  };

  // Confidence: climate data may not be available everywhere
  let confidence = 1.0;
  if (indicators.hotNightsPerYear == null) {
    confidence *= 0.85;
    components['hotNightsPerYear'] = 50; // Neutral
  }
  if (indicators.activeFrontage == null) {
    confidence *= 0.95; // Minor reduction
  }
  // Kontur land cover fractions may be 0 for unmapped areas
  if (indicators.canopyCover === 0 && indicators.imperviousness === 0) {
    confidence *= 0.5; // Likely missing data, not actually bare
  }

  const score = weightedAverage(components, WEIGHTS);

  return {
    chapter: 'resilience',
    score,
    grade: computeGrade(score),
    components,
    confidence,
    summary: summarizeResilience(score, indicators),
  };
}

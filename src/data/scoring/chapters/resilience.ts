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
 *   Tucker (1979) — NDVI as vegetation health proxy
 *   Nowak & Greenfield (2018) — Tree canopy services
 */

import type { ResilienceIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { RESILIENCE_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeResilience } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'landUseMix', weight: 0.20, rationale: 'Functional mix is the strongest predictor of car-independence' },
  { indicatorKey: 'canopyCover', weight: 0.20, rationale: '3-30-300 Rule: 30% canopy is the established green benchmark' },
  { indicatorKey: 'imperviousness', weight: 0.15, rationale: 'Sealed surfaces drive flood risk and urban heat island' },
  { indicatorKey: 'parkProximity', weight: 0.15, rationale: 'WHO: every home within 300m of a park' },
  { indicatorKey: 'hotNightsPerYear', weight: 0.10, rationale: 'Climate adaptation is increasingly critical for livability' },
  { indicatorKey: 'ndvi', weight: 0.10, rationale: 'NDVI captures vegetation health, not just presence' },
  { indicatorKey: 'canopyHeight', weight: 0.10, rationale: 'Mature trees provide 70x more ecosystem services than saplings' },
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
    ndvi: norm('ndvi', indicators.ndvi),
    canopyHeight: norm('canopyHeight', indicators.canopyHeight),
  };

  // Confidence: climate data may not be available everywhere
  let confidence = 1.0;
  if (indicators.hotNightsPerYear == null) {
    confidence *= 0.85;
    components['hotNightsPerYear'] = 50;
  }
  if (indicators.activeFrontage == null) {
    confidence *= 0.95;
  }
  if (indicators.ndvi == null) {
    confidence *= 0.9;
    components['ndvi'] = 50;
  }
  if (indicators.canopyHeight == null) {
    confidence *= 0.9;
    components['canopyHeight'] = 50;
  }
  // Kontur land cover fractions may be 0 for unmapped areas
  if (indicators.canopyCover === 0 && indicators.imperviousness === 0) {
    confidence *= 0.5;
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

/**
 * Chapter 3: Amenities (Vitality)
 *
 * Question: "Can I live here without a car?"
 * Audience value:
 *   - Researchers: 15-minute city completeness, agglomeration metrics
 *   - City council: "Which neighborhoods are underserved?"
 *   - Real estate: "Amenity premium" — POI density correlates with property value
 *   - Site selection: "Is this area self-sufficient for daily needs?"
 *
 * Now with 8 categories (expanded from 6 with culture + transport):
 *   Food, Health, Education, Shopping, Leisure, Civic, Culture, Transport
 *
 * References:
 *   Moreno et al. (2021) — 15-Minute City
 *   Ewing & Cervero (2010) — Travel and the Built Environment
 *   Oldenburg (1989) — The Great Good Place: third places
 *   WHO (2010) — Healthcare facility density standards
 *   Gehl (2010) — Cities for People
 */

import type { VitalityIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { VITALITY_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeVitality } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'fifteenMinCompleteness', weight: 0.25, rationale: 'Core 15-min city metric: are all essential categories present?' },
  { indicatorKey: 'dailyNeedsIndex', weight: 0.20, rationale: 'Weighted sum of daily essentials reflects practical convenience' },
  { indicatorKey: 'socialDensity', weight: 0.15, rationale: 'Third places build community and reduce isolation' },
  { indicatorKey: 'freshFoodAccess', weight: 0.10, rationale: 'Food access is a basic equity and health metric' },
  { indicatorKey: 'poiDiversity', weight: 0.10, rationale: 'Diverse amenities serve more population segments' },
  { indicatorKey: 'healthcareAccess', weight: 0.10, rationale: 'Healthcare proximity is critical for emergencies and routine care' },
  { indicatorKey: 'leisureDensity', weight: 0.10, rationale: 'Sports, arts, and recreation support quality of life' },
];

export function scoreVitality(indicators: VitalityIndicators): ChapterScore {
  const norm = (key: string, value: number | null): number => {
    const spec = VITALITY_NORMS.find(n => n.key === key);
    return spec ? normalize(value, spec.curve) : 0;
  };

  // Healthcare access: hospital count as density proxy
  const healthcareDensity = indicators.hospitalCount ?? 0;

  // Leisure density: sports + arts + entertainment
  const leisureDensity =
    (indicators.sportsRecreationPoi ?? 0) +
    (indicators.artsEntertainmentPoi ?? 0);

  const components: Record<string, number> = {
    fifteenMinCompleteness: norm('fifteenMinCompleteness', indicators.fifteenMinCompleteness),
    socialDensity: norm('socialDensity', indicators.socialDensity),
    freshFoodAccess: norm('freshFoodAccess', indicators.freshFoodAccess),
    poiDiversity: norm('poiDiversity', indicators.poiDiversity),
    dailyNeedsIndex: norm('dailyNeedsIndex', indicators.dailyNeedsIndex),
    healthcareAccess: norm('healthcareAccess', healthcareDensity),
    leisureDensity: norm('leisureDensity', leisureDensity),
  };

  // Confidence: POI data varies hugely by region
  let confidence = 1.0;
  if (indicators.poiCount < 10) {
    confidence *= 0.4;
  } else if (indicators.poiCount < 50) {
    confidence *= 0.7;
  }
  // Foursquare data supplements OSM in undermapped areas
  if (indicators.foursquarePlaces != null && indicators.foursquarePlaces > indicators.poiCount * 0.5) {
    confidence = Math.min(confidence + 0.1, 1.0);
  }
  // Hospital data may be missing
  if (indicators.hospitalCount == null) {
    confidence *= 0.9;
    components['healthcareAccess'] = 40;
  }

  const score = weightedAverage(components, WEIGHTS);

  return {
    chapter: 'vitality',
    score,
    grade: computeGrade(score),
    components,
    confidence,
    summary: summarizeVitality(score, indicators),
  };
}

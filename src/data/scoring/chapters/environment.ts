/**
 * Chapter 6: Environment (Climate & Disaster Risk)
 *
 * Question: "What's the forward-looking climate risk?"
 * Audience value:
 *   - Researchers: INFORM risk sub-indices, climate scenarios
 *   - City council: "Which areas need climate adaptation investment?"
 *   - Real estate: "What's the long-term climate risk for assets?"
 *   - Insurance: "What's the disaster exposure profile?"
 *
 * This chapter is INVERTED: high raw values (many hot days, high risk)
 * produce LOW scores. A high Environment score means LOW risk.
 *
 * References:
 *   INFORM Risk Index (EU JRC) — Humanitarian risk assessment
 *   Raymond et al. (2020) — Wet-bulb temperature survivability, Science Advances
 *   Royé (2017) — Tropical nights and mortality
 *   EM-DAT International Disaster Database
 *   Kontur Climate Indicators — WorldClim + warming scenarios
 */

import type { EnvironmentIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { ENVIRONMENT_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeEnvironment } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'informRiskIndex', weight: 0.25, rationale: 'INFORM is the gold-standard composite humanitarian risk index' },
  { indicatorKey: 'hotDaysPlus2C', weight: 0.20, rationale: 'Future heat stress is the #1 climate adaptation challenge' },
  { indicatorKey: 'wetBulbDaysPlus2C', weight: 0.15, rationale: 'Wet-bulb >32°C is a life-threatening threshold' },
  { indicatorKey: 'disasterFrequency', weight: 0.15, rationale: 'Historical disaster frequency predicts future exposure' },
  { indicatorKey: 'hotNightsPlus1C', weight: 0.10, rationale: 'Tropical nights disrupt recovery and raise mortality' },
  { indicatorKey: 'waterScarcity', weight: 0.10, rationale: 'Water stress affects long-term habitability' },
  { indicatorKey: 'solarPotential', weight: 0.05, rationale: 'Renewable energy transition readiness (positive signal)' },
];

export function scoreEnvironment(indicators: EnvironmentIndicators): ChapterScore {
  const norm = (key: string, value: number | null): number => {
    const spec = ENVIRONMENT_NORMS.find(n => n.key === key);
    return spec ? normalize(value, spec.curve) : 0;
  };

  // Aggregate disaster frequency: sum all disaster day counts
  const disasterFrequency =
    (indicators.floodDaysCount ?? 0) +
    (indicators.cycloneDaysCount ?? 0) +
    (indicators.droughtDaysCount ?? 0) +
    (indicators.wildfireDaysCount ?? 0) +
    (indicators.volcanoDaysCount ?? 0);

  const components: Record<string, number> = {
    informRiskIndex: norm('informRiskIndex', indicators.informRiskIndex),
    hotDaysPlus2C: norm('hotDaysPlus2C', indicators.hotDaysPlus2C),
    wetBulbDaysPlus2C: norm('wetBulbDaysPlus2C', indicators.wetBulbDaysPlus2C),
    disasterFrequency: norm('disasterFrequency', disasterFrequency),
    hotNightsPlus1C: norm('hotNightsPlus1C', indicators.hotNightsPlus1C),
    waterScarcity: norm('waterScarcity', indicators.waterScarcity),
    solarPotential: norm('solarPotential', indicators.solarSuitability),
  };

  // Confidence: climate data is available globally but INFORM varies
  let confidence = 1.0;
  let nullCount = 0;
  if (indicators.informRiskIndex == null) nullCount++;
  if (indicators.hotDaysPlus2C == null) nullCount++;
  if (indicators.wetBulbDaysPlus2C == null) nullCount++;
  if (indicators.hotNightsPlus1C == null) nullCount++;
  if (indicators.waterScarcity == null) nullCount++;
  if (indicators.hazardousDaysCount == null &&
      indicators.floodDaysCount == null &&
      indicators.cycloneDaysCount == null) nullCount++;

  confidence = Math.max(0.2, 1.0 - nullCount * 0.12);

  // If no environment data at all, use neutral assumptions
  if (nullCount >= 5) {
    confidence = 0.15;
    for (const key of Object.keys(components)) {
      if (components[key] === 0) components[key] = 50;
    }
  }

  const score = weightedAverage(components, WEIGHTS);

  return {
    chapter: 'environment',
    score,
    grade: computeGrade(score),
    components,
    confidence,
    summary: summarizeEnvironment(score, indicators),
  };
}

/**
 * Chapter 5: Prosperity (Economic Vibrancy)
 *
 * Question: "Is the area economically vibrant?"
 * Audience value:
 *   - Researchers: GDP proxy, night lights as economic output
 *   - City council: "Where are the underserved commercial areas?"
 *   - Real estate: "What's the local spending power?"
 *   - Site selection: "Is the market viable for my business?"
 *
 * References:
 *   Henderson et al. (2012) — Measuring Economic Growth from Outer Space, AER
 *   World Bank (2017) — Financial Inclusion indicators
 *   Dolega & Celinska-Janowicz (2019) — Retail vitality
 *   Florida (2002) — The Rise of the Creative Class
 */

import type { ProsperityIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { PROSPERITY_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeProsperity } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'gdpPopulation', weight: 0.25, rationale: 'Spending power is the #1 signal for commercial viability' },
  { indicatorKey: 'nightLightsEconomic', weight: 0.20, rationale: 'Night lights are the best satellite proxy for economic output' },
  { indicatorKey: 'retailDensity', weight: 0.20, rationale: 'Active retail landscape signals current economic health' },
  { indicatorKey: 'financialInfra', weight: 0.15, rationale: 'ATM/bank access indicates financial inclusion and commercial density' },
  { indicatorKey: 'hotelDensity', weight: 0.10, rationale: 'Hotel presence indicates visitor/tourism economy' },
  { indicatorKey: 'businessServicesDensity', weight: 0.10, rationale: 'Business services indicate local employment centers' },
];

export function scoreProsperity(indicators: ProsperityIndicators): ChapterScore {
  const norm = (key: string, value: number | null): number => {
    const spec = PROSPERITY_NORMS.find(n => n.key === key);
    return spec ? normalize(value, spec.curve) : 0;
  };

  // Derived composite indicators
  const hotelDensity = indicators.hotelCount ?? 0;
  const financialInfra = (indicators.atmCount ?? 0) + (indicators.bankCount ?? 0);
  const businessDensity = indicators.businessServicesPoi ?? 0;
  const retailDensity = (indicators.retailPoiEconomic ?? 0) + (indicators.eventsPoi ?? 0);

  const components: Record<string, number> = {
    gdpPopulation: norm('gdpPopulation', indicators.gdpPopulation),
    nightLightsEconomic: norm('nightLightsEconomic', indicators.nightLightsEconomic),
    hotelDensity: norm('hotelDensity', hotelDensity),
    financialInfra: norm('financialInfra', financialInfra),
    businessServicesDensity: norm('businessServicesDensity', businessDensity),
    retailDensity: norm('retailDensity', retailDensity),
  };

  // Confidence: economic data varies hugely by region
  let confidence = 1.0;
  let nullCount = 0;
  if (indicators.gdpPopulation == null) nullCount++;
  if (indicators.nightLightsEconomic == null) nullCount++;
  if (indicators.hotelCount == null) nullCount++;
  if (indicators.atmCount == null && indicators.bankCount == null) nullCount++;
  if (indicators.businessServicesPoi == null) nullCount++;
  if (indicators.retailPoiEconomic == null) nullCount++;

  // Each missing source reduces confidence
  confidence = Math.max(0.2, 1.0 - nullCount * 0.15);

  // If no economic data at all, very low confidence
  if (nullCount >= 5) {
    confidence = 0.1;
    // Use neutral defaults for missing data
    for (const key of Object.keys(components)) {
      if (components[key] === 0) components[key] = 30;
    }
  }

  const score = weightedAverage(components, WEIGHTS);

  return {
    chapter: 'prosperity',
    score,
    grade: computeGrade(score),
    components,
    confidence,
    summary: summarizeProsperity(score, indicators),
  };
}

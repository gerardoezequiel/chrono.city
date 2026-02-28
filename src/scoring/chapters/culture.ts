/**
 * Chapter 7: Culture (Cultural Capital)
 *
 * Question: "What's the cultural infrastructure?"
 * Audience value:
 *   - Researchers: Cultural capital metrics, creative economy indicators
 *   - City council: "Where should we invest in cultural facilities?"
 *   - Real estate: "Cultural premium" — arts districts appreciate faster
 *   - Tourism: "What's the cultural draw of this area?"
 *
 * References:
 *   UNESCO Creative Cities Network — Cultural venue density metrics
 *   ICOMOS — Heritage significance classification
 *   Florida (2002) — The Rise of the Creative Class
 *   Glaeser (2011) — Triumph of the City: knowledge infrastructure
 *   Throsby (2001) — Economics and Culture: cultural capital theory
 */

import type { CultureIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { CULTURE_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeCulture } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'culturalVenueDensity', weight: 0.25, rationale: 'Core measure of cultural infrastructure availability' },
  { indicatorKey: 'heritageDensity', weight: 0.20, rationale: 'Heritage sites represent irreplaceable cultural value' },
  { indicatorKey: 'entertainmentDensity', weight: 0.20, rationale: 'Night economy and event infrastructure signal cultural vibrancy' },
  { indicatorKey: 'heritageProtection', weight: 0.15, rationale: 'Protection level reflects commitment to cultural preservation' },
  { indicatorKey: 'knowledgeInfra', weight: 0.10, rationale: 'Universities/colleges drive knowledge economy and innovation' },
  { indicatorKey: 'culturalDiversity', weight: 0.10, rationale: 'Diverse cultural types serve a broader population' },
];

export function scoreCulture(indicators: CultureIndicators): ChapterScore {
  const norm = (key: string, value: number | null): number => {
    const spec = CULTURE_NORMS.find(n => n.key === key);
    return spec ? normalize(value, spec.curve) : 0;
  };

  // Cultural venue density: art + museums + cultural centers
  const culturalVenues =
    (indicators.artVenues ?? 0) +
    (indicators.museumsHistorical ?? 0) +
    (indicators.culturalCenters ?? 0);

  // Heritage density: heritage sites + Foursquare landmarks
  const heritageDensity =
    (indicators.heritageSites ?? 0) +
    (indicators.landmarksOutdoorFsq ?? 0);

  // Entertainment density: entertainment venues + events + arts FSQ
  const entertainmentDensity =
    (indicators.entertainmentVenues ?? 0) +
    (indicators.artsEntertainmentFsq ?? 0) +
    (indicators.eventsFsq ?? 0);

  // Knowledge infrastructure: universities + colleges
  const knowledgeInfra =
    (indicators.universityCount ?? 0) +
    (indicators.collegeCount ?? 0);

  // Cultural diversity: entropy of venue types
  const typeCounts = [
    indicators.artVenues ?? 0,
    indicators.culturalCenters ?? 0,
    indicators.entertainmentVenues ?? 0,
    indicators.heritageSites ?? 0,
    indicators.museumsHistorical ?? 0,
    indicators.artsEntertainmentFsq ?? 0,
    indicators.eventsFsq ?? 0,
    indicators.universityCount ?? 0,
  ].filter(v => v > 0);
  const totalCultural = typeCounts.reduce((a, b) => a + b, 0);
  const culturalDiversity = typeCounts.length > 1
    ? shannonEntropy(typeCounts.map(v => v / Math.max(totalCultural, 1)))
    : 0;

  const components: Record<string, number> = {
    culturalVenueDensity: norm('culturalVenueDensity', culturalVenues),
    heritageDensity: norm('heritageDensity', heritageDensity),
    entertainmentDensity: norm('entertainmentDensity', entertainmentDensity),
    heritageProtection: norm('heritageProtection', indicators.heritageProtectionLevel),
    knowledgeInfra: norm('knowledgeInfra', knowledgeInfra),
    culturalDiversity: norm('culturalDiversity', culturalDiversity),
  };

  // Confidence: culture data is spotty in many regions
  let confidence = 1.0;
  const allCulturalPois =
    culturalVenues + heritageDensity + entertainmentDensity + knowledgeInfra;

  if (allCulturalPois === 0) {
    confidence = 0.15; // No cultural data at all
    for (const key of Object.keys(components)) {
      components[key] = 20; // Assume some baseline culture exists
    }
  } else if (allCulturalPois < 3) {
    confidence = 0.4; // Very sparse
  } else if (allCulturalPois < 10) {
    confidence = 0.7; // Moderate
  }

  // Foursquare data supplements OSM for cultural venues
  if ((indicators.artsEntertainmentFsq ?? 0) > 0) {
    confidence = Math.min(confidence + 0.1, 1.0);
  }

  const score = weightedAverage(components, WEIGHTS);

  return {
    chapter: 'culture',
    score,
    grade: computeGrade(score),
    components,
    confidence,
    summary: summarizeCulture(score, indicators),
  };
}

/** Shannon entropy, normalized to 0–1 */
function shannonEntropy(proportions: number[]): number {
  const total = proportions.reduce((a, b) => a + b, 0);
  if (total === 0 || proportions.length <= 1) return 0;

  let entropy = 0;
  for (const p of proportions) {
    const normalized = p / total;
    if (normalized > 0) {
      entropy -= normalized * Math.log(normalized);
    }
  }

  const maxEntropy = Math.log(proportions.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

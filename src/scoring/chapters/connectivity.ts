/**
 * Chapter 4: Network (Connectivity)
 *
 * Question: "Is the grid walkable and efficient?"
 * Audience value:
 *   - Researchers: Graph theory metrics (alpha, beta, gamma indices)
 *   - City council: "Where should we add pedestrian crossings?"
 *   - Real estate: "Connectivity premium" — grid streets outperform cul-de-sacs
 *   - Site selection: "Can employees walk from transit to the office?"
 *
 * References:
 *   Marshall (2004) — Streets and Patterns: network connectivity
 *   Boeing (2019) — Urban Spatial Order: street orientation
 *   Ewing & Cervero (2010) — Intersection density and walkability
 *   Gehl (2010) — Cities for People: active transport
 *   Hillier & Hanson (1984) — Space syntax foundations
 */

import type { ConnectivityIndicators, ChapterScore, ChapterWeight } from '../types';
import { normalize } from '../normalize';
import { CONNECTIVITY_NORMS } from '../normalize';
import { computeGrade, weightedAverage, summarizeConnectivity } from '../utils';

const WEIGHTS: ChapterWeight[] = [
  { indicatorKey: 'intersectionDensity', weight: 0.30, rationale: 'Strongest correlate of walkability in meta-analyses' },
  { indicatorKey: 'deadEndRatio', weight: 0.25, rationale: 'Dead ends force long detours — direct sprawl measure' },
  { indicatorKey: 'activeTransportShare', weight: 0.20, rationale: 'Infrastructure investment in non-car modes' },
  { indicatorKey: 'orientationEntropy', weight: 0.10, rationale: 'Grid legibility aids wayfinding' },
  { indicatorKey: 'alphaScore', weight: 0.15, rationale: 'Network efficiency: how much area walking actually covers' },
];

export function scoreConnectivity(indicators: ConnectivityIndicators): ChapterScore {
  const norm = (key: string, value: number | null): number => {
    const spec = CONNECTIVITY_NORMS.find(n => n.key === key);
    return spec ? normalize(value, spec.curve) : 0;
  };

  const components: Record<string, number> = {
    intersectionDensity: norm('intersectionDensity', indicators.intersectionDensity),
    deadEndRatio: norm('deadEndRatio', indicators.deadEndRatio),
    activeTransportShare: norm('activeTransportShare', indicators.activeTransportShare),
    orientationEntropy: norm('orientationEntropy', indicators.orientationEntropy),
    alphaScore: norm('alphaScore', indicators.alphaScore),
  };

  // Confidence: network data is generally reliable in Overture
  let confidence = 1.0;
  if (indicators.totalRoadLength < 1.0) {
    confidence *= 0.5; // Very little road data — probably unmapped area
  }
  if (indicators.intersectionCount < 5) {
    confidence *= 0.6; // Too few intersections for meaningful density
  }

  const score = weightedAverage(components, WEIGHTS);

  return {
    chapter: 'connectivity',
    score,
    grade: computeGrade(score),
    components,
    confidence,
    summary: summarizeConnectivity(score, indicators),
  };
}

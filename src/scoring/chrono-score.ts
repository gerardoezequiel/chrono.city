/**
 * Chrono Score — Composite Urban Quality Index
 *
 * Combines 4 chapter scores into a single 0–100 number with
 * a letter grade (A–F).
 *
 * Weight rationale:
 *   Vitality    30% — "Can I live here?" is the user's #1 question
 *   Fabric      25% — Physical form determines long-term potential
 *   Connectivity 25% — Network quality enables everything else
 *   Resilience   20% — Climate/green is critical but slower-impact
 *
 * The weights are designed so that a balanced neighborhood
 * (moderate in all four) scores higher than one that's extreme
 * in one dimension but weak in others. This reflects the
 * academic consensus that urban quality is multidimensional.
 */

import type {
  ChronoScore,
  ChapterScore,
  ChapterName,
  RawIndicators,
  ScoringContext,
} from './types';
import { computeGrade } from './utils';
import { scoreFabric } from './chapters/fabric';
import { scoreResilience } from './chapters/resilience';
import { scoreVitality } from './chapters/vitality';
import { scoreConnectivity } from './chapters/connectivity';

export const FRAMEWORK_VERSION = '0.1.0';

const CHAPTER_WEIGHTS: Record<ChapterName, number> = {
  vitality: 0.30,
  fabric: 0.25,
  connectivity: 0.25,
  resilience: 0.20,
};

/**
 * Compute the full Chrono Score from raw indicators.
 * This is the single entry point for all scoring operations.
 */
export function computeChronoScore(
  indicators: RawIndicators,
  context: ScoringContext,
): ChronoScore {
  // Score each chapter
  const chapters: Record<ChapterName, ChapterScore> = {
    fabric: scoreFabric(indicators.fabric),
    resilience: scoreResilience(indicators.resilience),
    vitality: scoreVitality(indicators.vitality),
    connectivity: scoreConnectivity(indicators.connectivity),
  };

  // Weighted composite with confidence adjustment
  let weightedSum = 0;
  let totalWeight = 0;
  let confidenceProduct = 1;

  for (const [chapter, weight] of Object.entries(CHAPTER_WEIGHTS)) {
    const chapterScore = chapters[chapter as ChapterName];
    weightedSum += chapterScore.score * weight;
    totalWeight += weight;
    confidenceProduct *= chapterScore.confidence;
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Apply harmony bonus: reward balanced scores across all chapters
  // A neighborhood scoring 60/60/60/60 should beat one scoring 90/90/30/30
  const chapterScores = Object.values(chapters).map(c => c.score);
  const harmonyBonus = computeHarmonyBonus(chapterScores);
  const finalScore = Math.round(Math.min(100, rawScore + harmonyBonus) * 10) / 10;

  return {
    score: finalScore,
    grade: computeGrade(finalScore),
    chapters,
    context,
    confidence: Math.round(confidenceProduct * 100) / 100,
    computedAt: new Date().toISOString(),
    version: FRAMEWORK_VERSION,
  };
}

/**
 * Harmony bonus: rewards balanced chapter scores.
 *
 * Uses the coefficient of variation (CV) of chapter scores.
 * Low CV (balanced) → up to +5 points bonus.
 * High CV (imbalanced) → 0 bonus.
 *
 * This is the "harmonic" in the framework name — it nudges
 * the composite score toward neighborhoods that work well
 * across all dimensions, not just one.
 */
function computeHarmonyBonus(scores: number[]): number {
  if (scores.length < 2) return 0;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (mean === 0) return 0;

  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const cv = Math.sqrt(variance) / mean; // Coefficient of variation

  // CV = 0 (perfectly balanced) → bonus = 5
  // CV > 0.4 (very imbalanced) → bonus = 0
  const maxBonus = 5;
  return Math.max(0, maxBonus * (1 - cv / 0.4));
}

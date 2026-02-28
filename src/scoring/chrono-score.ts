/**
 * Chrono Score — Composite Urban Quality Index
 *
 * Combines 7 chapter scores into a single 0–100 number with
 * a letter grade (A–F).
 *
 * Weight rationale (7 chapters):
 *   Vitality      22% — "Can I live here?" is the user's #1 question
 *   Fabric        18% — Physical form determines long-term potential
 *   Connectivity  18% — Network quality enables everything else
 *   Resilience    15% — Climate/green is critical but slower-impact
 *   Prosperity    12% — Economic vibrancy drives investment decisions
 *   Environment   10% — Forward-looking climate risk
 *   Culture        5% — Cultural capital enriches but isn't essential
 *
 * The weights are designed so that a balanced neighborhood
 * (moderate in all seven) scores higher than one that's extreme
 * in one dimension but weak in others.
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
import { scoreProsperity } from './chapters/prosperity';
import { scoreEnvironment } from './chapters/environment';
import { scoreCulture } from './chapters/culture';

export const FRAMEWORK_VERSION = '0.2.0';

const CHAPTER_WEIGHTS: Record<ChapterName, number> = {
  vitality: 0.22,
  fabric: 0.18,
  connectivity: 0.18,
  resilience: 0.15,
  prosperity: 0.12,
  environment: 0.10,
  culture: 0.05,
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
    prosperity: scoreProsperity(indicators.prosperity),
    environment: scoreEnvironment(indicators.environment),
    culture: scoreCulture(indicators.culture),
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
 */
function computeHarmonyBonus(scores: number[]): number {
  if (scores.length < 2) return 0;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (mean === 0) return 0;

  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const cv = Math.sqrt(variance) / mean;

  // CV = 0 (perfectly balanced) → bonus = 5
  // CV > 0.4 (very imbalanced) → bonus = 0
  const maxBonus = 5;
  return Math.max(0, maxBonus * (1 - cv / 0.4));
}

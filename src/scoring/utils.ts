/**
 * Scoring Utilities
 *
 * Grade computation, weighted averaging, and plain-language
 * summary generation for different audiences.
 */

import type {
  Grade,
  ChapterWeight,
  FabricIndicators,
  ResilienceIndicators,
  VitalityIndicators,
  ConnectivityIndicators,
} from './types';

// ─── Grade Computation ───────────────────────────────────────

export function computeGrade(score: number): Grade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function gradeLabel(grade: Grade): string {
  switch (grade) {
    case 'A': return 'Excellent';
    case 'B': return 'Good';
    case 'C': return 'Moderate';
    case 'D': return 'Below Average';
    case 'F': return 'Car-Dependent';
  }
}

// ─── Weighted Average ────────────────────────────────────────

export function weightedAverage(
  components: Record<string, number>,
  weights: ChapterWeight[],
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const w of weights) {
    const value = components[w.indicatorKey];
    if (value != null && isFinite(value)) {
      weightedSum += value * w.weight;
      totalWeight += w.weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

// ─── Plain-Language Summaries ────────────────────────────────
// These generate council-friendly descriptions of what the score means.
// The tone is factual and actionable, not promotional.

export function summarizeFabric(score: number, ind: FabricIndicators): string {
  const parts: string[] = [];

  if (ind.gsi > 0.4) {
    parts.push('Dense building coverage');
  } else if (ind.gsi < 0.15) {
    parts.push('Low-density, sprawling layout');
  } else {
    parts.push('Moderate building coverage');
  }

  if (ind.urbanGrain < 200) {
    parts.push('fine-grained urban fabric');
  } else if (ind.urbanGrain > 1000) {
    parts.push('large-scale blocks');
  } else {
    parts.push('medium-grained blocks');
  }

  if (ind.avgHeight != null) {
    if (ind.avgHeight > 20) {
      parts.push(`tall buildings (avg ${ind.avgHeight.toFixed(0)}m)`);
    } else if (ind.avgHeight < 8) {
      parts.push(`low-rise (avg ${ind.avgHeight.toFixed(0)}m)`);
    }
  }

  return `${parts.join(', ')}. ${scoreContext('Urban Fabric', score)}`;
}

export function summarizeResilience(score: number, ind: ResilienceIndicators): string {
  const parts: string[] = [];

  if (ind.canopyCover >= 0.3) {
    parts.push('Meets 30% canopy target');
  } else if (ind.canopyCover >= 0.15) {
    parts.push(`${(ind.canopyCover * 100).toFixed(0)}% green cover — below 30% target`);
  } else {
    parts.push('Very low green cover');
  }

  if (ind.landUseMix > 0.7) {
    parts.push('well-mixed land use');
  } else if (ind.landUseMix < 0.3) {
    parts.push('single-use zoning');
  }

  if (ind.imperviousness > 0.7) {
    parts.push('high flood risk from sealed surfaces');
  }

  return `${parts.join(', ')}. ${scoreContext('Resilience', score)}`;
}

export function summarizeVitality(score: number, ind: VitalityIndicators): string {
  const parts: string[] = [];

  parts.push(`${ind.fifteenMinCompleteness}/6 essential service categories`);

  if (ind.socialDensity > 5) {
    parts.push('rich social infrastructure');
  } else if (ind.socialDensity < 1) {
    parts.push('few social gathering places');
  }

  if (ind.freshFoodAccess > 500) {
    parts.push(`nearest grocery ${ind.freshFoodAccess.toFixed(0)}m away (food access risk)`);
  }

  return `${parts.join(', ')}. ${scoreContext('Vitality', score)}`;
}

export function summarizeConnectivity(score: number, ind: ConnectivityIndicators): string {
  const parts: string[] = [];

  if (ind.intersectionDensity > 100) {
    parts.push('Highly connected grid');
  } else if (ind.intersectionDensity < 40) {
    parts.push('Low connectivity — limited route choices');
  } else {
    parts.push('Moderate intersection density');
  }

  if (ind.deadEndRatio > 0.3) {
    parts.push('many dead ends (cul-de-sac pattern)');
  }

  if (ind.activeTransportShare > 0.2) {
    parts.push('strong pedestrian/cycle infrastructure');
  } else if (ind.activeTransportShare < 0.05) {
    parts.push('minimal walking/cycling infrastructure');
  }

  return `${parts.join(', ')}. ${scoreContext('Connectivity', score)}`;
}

function scoreContext(chapter: string, score: number): string {
  if (score >= 85) return `${chapter} quality is excellent.`;
  if (score >= 70) return `${chapter} quality is good with room for improvement.`;
  if (score >= 55) return `${chapter} quality is moderate — targeted interventions recommended.`;
  if (score >= 40) return `${chapter} quality is below average — structural improvements needed.`;
  return `${chapter} quality is poor — significant urban design challenges.`;
}

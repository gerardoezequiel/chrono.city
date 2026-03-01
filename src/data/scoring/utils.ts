/**
 * Scoring Utilities
 *
 * Grade computation, weighted averaging, and plain-language
 * summary generation for all 7 chapters.
 */

import type {
  Grade,
  ChapterWeight,
  FabricIndicators,
  ResilienceIndicators,
  VitalityIndicators,
  ConnectivityIndicators,
  ProsperityIndicators,
  EnvironmentIndicators,
  CultureIndicators,
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

  if (ind.earliestConstructionYear != null && ind.earliestConstructionYear < 1900) {
    parts.push('historic building stock');
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

  if (ind.ndvi != null && ind.ndvi > 0.5) {
    parts.push('healthy vegetation');
  }

  if (ind.canopyHeight != null && ind.canopyHeight > 15) {
    parts.push('mature tree canopy');
  }

  return `${parts.join(', ')}. ${scoreContext('Resilience', score)}`;
}

export function summarizeVitality(score: number, ind: VitalityIndicators): string {
  const parts: string[] = [];

  parts.push(`${ind.fifteenMinCompleteness}/8 essential service categories`);

  if (ind.socialDensity > 5) {
    parts.push('rich social infrastructure');
  } else if (ind.socialDensity < 1) {
    parts.push('few social gathering places');
  }

  if (ind.freshFoodAccess > 500) {
    parts.push(`nearest grocery ${ind.freshFoodAccess.toFixed(0)}m away (food access risk)`);
  }

  if (ind.hospitalCount != null && ind.hospitalCount > 0) {
    parts.push('healthcare accessible');
  }

  if ((ind.sportsRecreationPoi ?? 0) + (ind.artsEntertainmentPoi ?? 0) > 5) {
    parts.push('diverse leisure options');
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

export function summarizeProsperity(score: number, ind: ProsperityIndicators): string {
  const parts: string[] = [];

  if (ind.gdpPopulation != null && ind.gdpPopulation > 1000000) {
    parts.push('Strong local spending power');
  } else if (ind.gdpPopulation != null && ind.gdpPopulation < 100000) {
    parts.push('Low economic output');
  }

  if (ind.nightLightsEconomic != null && ind.nightLightsEconomic > 30) {
    parts.push('high economic activity (bright night lights)');
  }

  if ((ind.hotelCount ?? 0) > 3) {
    parts.push('active visitor economy');
  }

  const financialCount = (ind.atmCount ?? 0) + (ind.bankCount ?? 0);
  if (financialCount > 5) {
    parts.push('well-served by financial infrastructure');
  } else if (financialCount === 0 && ind.gdpPopulation != null) {
    parts.push('no financial services nearby');
  }

  if ((ind.businessServicesPoi ?? 0) > 10) {
    parts.push('employment center');
  }

  if (parts.length === 0) {
    parts.push('Limited economic data available');
  }

  return `${parts.join(', ')}. ${scoreContext('Prosperity', score)}`;
}

export function summarizeEnvironment(score: number, ind: EnvironmentIndicators): string {
  const parts: string[] = [];

  if (ind.informRiskIndex != null) {
    if (ind.informRiskIndex > 6) {
      parts.push(`High humanitarian risk (INFORM ${ind.informRiskIndex.toFixed(1)}/10)`);
    } else if (ind.informRiskIndex < 3) {
      parts.push(`Low humanitarian risk (INFORM ${ind.informRiskIndex.toFixed(1)}/10)`);
    } else {
      parts.push(`Moderate risk (INFORM ${ind.informRiskIndex.toFixed(1)}/10)`);
    }
  }

  if (ind.hotDaysPlus2C != null && ind.hotDaysPlus2C > 60) {
    parts.push(`${ind.hotDaysPlus2C.toFixed(0)} extreme heat days projected at +2°C`);
  }

  if (ind.wetBulbDaysPlus2C != null && ind.wetBulbDaysPlus2C > 5) {
    parts.push(`${ind.wetBulbDaysPlus2C.toFixed(0)} lethal wet-bulb days projected`);
  }

  if (ind.waterScarcity != null && ind.waterScarcity > 5) {
    parts.push('significant water scarcity risk');
  }

  const disasterDays =
    (ind.floodDaysCount ?? 0) + (ind.cycloneDaysCount ?? 0) +
    (ind.droughtDaysCount ?? 0) + (ind.wildfireDaysCount ?? 0);
  if (disasterDays > 30) {
    parts.push(`${disasterDays} hazardous days/year`);
  }

  if (ind.solarSuitability != null && ind.solarSuitability > 0.7) {
    parts.push('excellent solar energy potential');
  }

  if (parts.length === 0) {
    parts.push('Limited environmental risk data available');
  }

  return `${parts.join(', ')}. ${scoreContext('Environment', score)}`;
}

export function summarizeCulture(score: number, ind: CultureIndicators): string {
  const parts: string[] = [];

  const totalVenues =
    (ind.artVenues ?? 0) + (ind.museumsHistorical ?? 0) + (ind.culturalCenters ?? 0);

  if (totalVenues > 5) {
    parts.push('Rich cultural infrastructure');
  } else if (totalVenues > 0) {
    parts.push(`${totalVenues} cultural venue(s)`);
  } else {
    parts.push('No mapped cultural venues');
  }

  if ((ind.heritageSites ?? 0) > 0) {
    parts.push(`${ind.heritageSites} heritage site(s)`);
  }

  if (ind.heritageProtectionLevel != null && ind.heritageProtectionLevel >= 3) {
    parts.push('nationally recognized heritage area');
  }

  const entertainment =
    (ind.entertainmentVenues ?? 0) + (ind.artsEntertainmentFsq ?? 0);
  if (entertainment > 5) {
    parts.push('active entertainment scene');
  }

  const knowledge = (ind.universityCount ?? 0) + (ind.collegeCount ?? 0);
  if (knowledge > 0) {
    parts.push('knowledge/academic presence');
  }

  return `${parts.join(', ')}. ${scoreContext('Culture', score)}`;
}

function scoreContext(chapter: string, score: number): string {
  if (score >= 85) return `${chapter} quality is excellent.`;
  if (score >= 70) return `${chapter} quality is good with room for improvement.`;
  if (score >= 55) return `${chapter} quality is moderate — targeted interventions recommended.`;
  if (score >= 40) return `${chapter} quality is below average — structural improvements needed.`;
  return `${chapter} quality is poor — significant urban design challenges.`;
}

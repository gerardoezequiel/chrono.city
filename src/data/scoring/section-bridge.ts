/**
 * Section → Scoring Bridge
 *
 * Converts section-level metrics (from DuckDB bbox queries)
 * into the VitalityIndicators / ConnectivityIndicators interfaces
 * expected by the scoring chapters.
 *
 * This enables scoring from section data without needing the
 * full Kontur H3 pipeline or isochrone computation.
 */

import type { AmenityMetrics, WalkabilityMetrics } from '@/shared/types/metrics';
import type { VitalityIndicators, ConnectivityIndicators } from './types';

/**
 * Convert AmenityMetrics (from queryPlaces) → VitalityIndicators (for scoreVitality).
 *
 * Some indicators require data not available from a simple bbox query
 * (e.g., freshFoodAccess needs distance computation). These are set to
 * reasonable defaults or null, with confidence adjusted accordingly.
 */
export function amenityMetricsToVitality(metrics: AmenityMetrics): VitalityIndicators {
  const { categoryDistribution } = metrics;

  // Count social places (cafes, bars, libraries, parks) for social density
  // Approximate area-based density: not possible without bbox area,
  // so we use raw count as a proxy (scoring normalizes it)
  const socialCategories = ['cafe', 'bar', 'library', 'park', 'community_center', 'restaurant'];
  let socialCount = 0;
  for (const cat of socialCategories) {
    socialCount += categoryDistribution[cat] ?? 0;
  }

  // Healthcare proxy: count hospitals/clinics/doctors
  const healthcareCategories = ['hospital', 'doctor', 'dentist', 'pharmacy', 'clinic'];
  let hospitalCount = 0;
  for (const cat of healthcareCategories) {
    hospitalCount += categoryDistribution[cat] ?? 0;
  }

  // Leisure: sports + arts
  const sportsRec = (categoryDistribution['sports_and_recreation_venue'] ?? 0) +
    (categoryDistribution['sports_and_fitness_instruction'] ?? 0);
  const artsEntertainment = (categoryDistribution['museum'] ?? 0) +
    (categoryDistribution['cinema'] ?? 0) +
    (categoryDistribution['performing_arts'] ?? 0) +
    (categoryDistribution['art_gallery'] ?? 0);

  // Daily needs index: weighted presence of key categories (0-100)
  const dailyNeeds = [
    { cats: ['food', 'supermarket'], weight: 30 },
    { cats: ['pharmacy'], weight: 20 },
    { cats: ['school', 'kindergarten'], weight: 20 },
    { cats: ['transportation', 'bus_station', 'subway_station'], weight: 15 },
    { cats: ['hospital', 'doctor', 'clinic'], weight: 15 },
  ];
  let dailyNeedsIndex = 0;
  for (const need of dailyNeeds) {
    const present = need.cats.some((c) => (categoryDistribution[c] ?? 0) > 0);
    if (present) dailyNeedsIndex += need.weight;
  }

  return {
    fifteenMinCompleteness: metrics.fifteenMinCompleteness,
    retailClustering: null, // requires spatial nearest-neighbor analysis
    socialDensity: socialCount,
    freshFoodAccess: (categoryDistribution['food'] ?? 0) + (categoryDistribution['supermarket'] ?? 0) > 0 ? 200 : 800,
    dailyNeedsIndex,
    poiCount: metrics.poiCount,
    poiDiversity: metrics.poiDiversity,
    foursquarePlaces: null,
    diningDrinking: (categoryDistribution['restaurant'] ?? 0) + (categoryDistribution['bar'] ?? 0) + (categoryDistribution['cafe'] ?? 0),
    eateryCount: categoryDistribution['restaurant'] ?? 0,
    retailCount: categoryDistribution['retail'] ?? 0,
    artsEntertainmentPoi: artsEntertainment,
    sportsRecreationPoi: sportsRec,
    coffeeShopPoi: categoryDistribution['cafe'] ?? 0,
    landmarksOutdoorPoi: (categoryDistribution['park'] ?? 0) + (categoryDistribution['museum'] ?? 0),
    travelTransportPoi: categoryDistribution['transportation'] ?? 0,
    hospitalCount,
    wasteContainerCoverage: null,
  };
}

/**
 * Convert WalkabilityMetrics (from queryWalkability) → ConnectivityIndicators (for scoreConnectivity).
 */
export function walkabilityMetricsToConnectivity(metrics: WalkabilityMetrics): ConnectivityIndicators {
  return {
    intersectionDensity: metrics.intersectionDensity,
    alphaScore: 0.5, // requires isochrone polygon for pedshed ratio
    orientationEntropy: 0.5, // computed separately in network section via PMTiles
    deadEndRatio: metrics.deadEndRatio,
    activeTransportShare: metrics.activeTransportShare,
    totalRoadLength: metrics.totalLengthKm,
    intersectionCount: metrics.intersectionCount,
    communicationLinesLength: null,
  };
}

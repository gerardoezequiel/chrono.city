/**
 * DuckDB → Chrono Score Bridge
 *
 * Maps DuckDB section data (BuildingMetrics, NetworkMetrics, WalkabilityMetrics)
 * to the scoring framework's RawIndicators format.
 *
 * For chapters we can compute from Overture data (Fabric, Connectivity, Vitality),
 * this provides real computed values. For chapters that require external data
 * (Prosperity, Environment, Culture), we fall back to Kontur H3 indicators.
 */

import type { BuildingMetrics, NetworkMetrics, WalkabilityMetrics } from '@/shared/types/metrics';
import type {
  RawIndicators,
  FabricIndicators,
  ConnectivityIndicators,
  VitalityIndicators,
  ResilienceIndicators,
  ProsperityIndicators,
  EnvironmentIndicators,
  CultureIndicators,
} from './types';

interface DuckDBSectionData {
  buildings?: BuildingMetrics | null;
  network?: NetworkMetrics | null;
  walkability?: WalkabilityMetrics | null;
}

/**
 * Convert DuckDB section data to Fabric indicators.
 * Uses real computed GSI, FSI, OSR, compactness, and urban grain.
 */
function buildFabric(b: BuildingMetrics | null | undefined): FabricIndicators {
  if (!b) return emptyFabric();

  return {
    gsi: b.gsi ?? 0,
    fsi: b.fsi ?? 0,
    osr: b.osr ?? (b.fsi && b.fsi > 0 ? (1 - (b.gsi ?? 0)) / b.fsi : 5),
    compactness: b.compactness ?? 0.55,
    urbanGrain: b.medianFootprintM2 ?? b.avgFootprintAreaM2,
    fractalDimension: null,
    buildingCount: b.buildingCount,
    avgHeight: b.avgHeightM,
    heightCoverage: b.heightCoverage,
    earliestConstructionYear: null,
    latestConstructionYear: null,
    recentOsmBuildings: null,
  };
}

/**
 * Convert DuckDB network data to Connectivity indicators.
 * Uses real intersection density, dead-end ratio, and active transport share.
 */
function buildConnectivity(n: NetworkMetrics | null | undefined): ConnectivityIndicators {
  if (!n) return emptyConnectivity();

  return {
    intersectionDensity: n.intersectionDensity ?? 0,
    alphaScore: 0.5, // Needs isochrone area comparison — use moderate default
    orientationEntropy: n.orientationEntropy ?? 0.5,
    deadEndRatio: n.deadEndRatio ?? 0.3,
    activeTransportShare: n.activeTransportShare ?? 0.05,
    totalRoadLength: n.totalLengthKm,
    intersectionCount: n.intersectionCount ?? 0,
    communicationLinesLength: null,
  };
}

/**
 * Convert DuckDB walkability data to Vitality indicators.
 * Uses real 15-min completeness and social density.
 */
function buildVitality(w: WalkabilityMetrics | null | undefined): VitalityIndicators {
  if (!w) return emptyVitality();

  return {
    fifteenMinCompleteness: w.fifteenMinCompleteness,
    retailClustering: null,
    socialDensity: w.socialDensity,
    freshFoodAccess: w.serviceCoverage['Food & Grocery'] ? 200 : 700,
    dailyNeedsIndex: Math.min(w.fifteenMinCompleteness * 15 + 10, 100),
    poiCount: w.totalPoi,
    poiDiversity: 0.5, // Would need category entropy from raw data
    foursquarePlaces: null,
    diningDrinking: null,
    eateryCount: null,
    retailCount: null,
    artsEntertainmentPoi: null,
    sportsRecreationPoi: null,
    coffeeShopPoi: null,
    landmarksOutdoorPoi: null,
    travelTransportPoi: null,
    hospitalCount: null,
    wasteContainerCoverage: null,
  };
}

/**
 * Merge DuckDB-computed indicators with Kontur H3 fallback indicators.
 * DuckDB provides Fabric, Connectivity, Vitality.
 * Kontur provides Resilience, Prosperity, Environment, Culture.
 */
export function sectionDataToIndicators(
  sectionData: DuckDBSectionData,
  konturFallback?: RawIndicators | null,
): RawIndicators {
  return {
    fabric: sectionData.buildings ? buildFabric(sectionData.buildings) : (konturFallback?.fabric ?? emptyFabric()),
    connectivity: sectionData.network ? buildConnectivity(sectionData.network) : (konturFallback?.connectivity ?? emptyConnectivity()),
    vitality: sectionData.walkability ? buildVitality(sectionData.walkability) : (konturFallback?.vitality ?? emptyVitality()),
    // These chapters always fall back to Kontur (no Overture source)
    resilience: konturFallback?.resilience ?? emptyResilience(),
    prosperity: konturFallback?.prosperity ?? emptyProsperity(),
    environment: konturFallback?.environment ?? emptyEnvironment(),
    culture: konturFallback?.culture ?? emptyCulture(),
  };
}

// ─── Empty defaults ─────────────────────────────────────────

function emptyFabric(): FabricIndicators {
  return { gsi: 0, fsi: 0, osr: 5, compactness: 0, urbanGrain: 500, fractalDimension: null, buildingCount: 0, avgHeight: null, heightCoverage: 0, earliestConstructionYear: null, latestConstructionYear: null, recentOsmBuildings: null };
}

function emptyConnectivity(): ConnectivityIndicators {
  return { intersectionDensity: 0, alphaScore: 0, orientationEntropy: 0.5, deadEndRatio: 0.5, activeTransportShare: 0, totalRoadLength: 0, intersectionCount: 0, communicationLinesLength: null };
}

function emptyVitality(): VitalityIndicators {
  return { fifteenMinCompleteness: 0, retailClustering: null, socialDensity: 0, freshFoodAccess: 800, dailyNeedsIndex: 0, poiCount: 0, poiDiversity: 0, foursquarePlaces: null, diningDrinking: null, eateryCount: null, retailCount: null, artsEntertainmentPoi: null, sportsRecreationPoi: null, coffeeShopPoi: null, landmarksOutdoorPoi: null, travelTransportPoi: null, hospitalCount: null, wasteContainerCoverage: null };
}

function emptyResilience(): ResilienceIndicators {
  return { landUseMix: 0, canopyCover: 0, parkProximity: 800, imperviousness: 0, activeFrontage: null, nightLights: null, avgMaxTemp: null, hotNightsPerYear: null, ndvi: null, canopyHeight: null, wetlandFraction: null, bareVegetation: null };
}

function emptyProsperity(): ProsperityIndicators {
  return { gdpPopulation: null, nightLightsEconomic: null, hotelCount: null, hotelAvgLevel: null, hotelMaxLevel: null, atmCount: null, bankCount: null, businessServicesPoi: null, industrialArea: null, retailPoiEconomic: null, eventsPoi: null };
}

function emptyEnvironment(): EnvironmentIndicators {
  return { hotDaysPlus1C: null, hotDaysPlus2C: null, hotNightsPlus1C: null, hotNightsPlus2C: null, wetBulbDaysPlus2C: null, solarIrradiance: null, relativeHumidity: null, maxWindSpeed: null, avgTemperature: null, informRiskIndex: null, hazardExposure: null, vulnerability: null, lackOfCoping: null, waterScarcity: null, floodDaysCount: null, cycloneDaysCount: null, droughtDaysCount: null, wildfireDaysCount: null, volcanoDaysCount: null, hazardousDaysCount: null, solarSuitability: null };
}

function emptyCulture(): CultureIndicators {
  return { artVenues: null, culturalCenters: null, entertainmentVenues: null, heritageSites: null, museumsHistorical: null, heritageProtectionLevel: null, artsEntertainmentFsq: null, landmarksOutdoorFsq: null, eventsFsq: null, collegeCount: null, universityCount: null };
}

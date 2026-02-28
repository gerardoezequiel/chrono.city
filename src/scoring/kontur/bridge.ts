/**
 * Kontur H3 → Chrono Indicators Bridge
 *
 * Maps Kontur's pre-aggregated H3 cell properties (222 datasets)
 * to the chrono.city 7-chapter indicator framework.
 *
 * Data source: Kontur bivariate MVT tiles
 *   Endpoint: /tiles/bivariate/v1/{z}/{x}/{y}.mvt?indicatorsClass=general
 *   Layer: "stats"
 *   Resolution: H3 r0–r8 (dynamic by zoom)
 *
 * The bridge computes derived indicators from Kontur's raw
 * counts and fractions, filling the same RawIndicators shape
 * that the DuckDB-WASM queries produce for pedshed analysis.
 */

import type {
  KonturH3Properties,
  RawIndicators,
  FabricIndicators,
  ResilienceIndicators,
  VitalityIndicators,
  ConnectivityIndicators,
  ProsperityIndicators,
  EnvironmentIndicators,
  CultureIndicators,
} from '../types';

/** Default H3 res 8 cell area in km² */
const DEFAULT_CELL_AREA_KM2 = 0.737327;

/**
 * Convert Kontur H3 properties to chrono.city raw indicators.
 *
 * Some indicators cannot be computed from Kontur data alone
 * (e.g., intersection density requires network graph analysis).
 * These are estimated using empirical proxy relationships.
 */
export function konturToIndicators(props: KonturH3Properties): RawIndicators {
  const area = props.area_km2 ?? DEFAULT_CELL_AREA_KM2;
  const areaHa = area * 100;

  return {
    fabric: deriveFabric(props, area, areaHa),
    resilience: deriveResilience(props, area),
    vitality: deriveVitality(props, area, areaHa),
    connectivity: deriveConnectivity(props, area),
    prosperity: deriveProsperity(props, area, areaHa),
    environment: deriveEnvironment(props),
    culture: deriveCulture(props, area, areaHa),
  };
}

// ─── Chapter 1: Fabric ──────────────────────────────────────

function deriveFabric(
  p: KonturH3Properties,
  areaKm2: number,
  _areaHa: number,
): FabricIndicators {
  const buildingCount = p.building_count ?? p.total_building_count ?? 0;
  const builtup = p.builtup ?? 0;

  // GSI: builtup fraction is the best available proxy
  const gsi = Math.min(builtup, 1.0);

  // FSI: estimate from height * GSI (floor area ≈ GSI * floors)
  const avgHeight = p.ghs_avg_building_height ?? null;
  const estimatedFloors = avgHeight != null ? Math.max(1, avgHeight / 3.5) : 1;
  const fsi = gsi * estimatedFloors;

  // OSR: open space ratio
  const osr = fsi > 0 ? (1 - gsi) / fsi : 5;

  // Urban grain: estimate median footprint from count + total area
  const builtupM2 = builtup * areaKm2 * 1_000_000;
  const avgFootprint = buildingCount > 0 ? builtupM2 / buildingCount : 500;
  const urbanGrain = avgFootprint * 0.7;

  // Compactness: not available from Kontur, use moderate default
  const compactness = 0.55;

  return {
    gsi,
    fsi,
    osr,
    compactness,
    urbanGrain,
    fractalDimension: null,
    buildingCount,
    avgHeight,
    heightCoverage: avgHeight != null ? 0.8 : 0,
    earliestConstructionYear: p.osm_building_earliest_year ?? null,
    latestConstructionYear: p.osm_building_latest_year ?? null,
    recentOsmBuildings: p.osm_recent_buildings_count ?? null,
  };
}

// ─── Chapter 2: Resilience ──────────────────────────────────

function deriveResilience(
  p: KonturH3Properties,
  areaKm2: number,
): ResilienceIndicators {
  // Green cover: sum all vegetation fractions
  const greenFractions = [
    p.forest ?? 0,
    p.evergreen_needle_leaved_forest ?? 0,
    p.unknown_forest ?? 0,
    p.herbage ?? 0,
    p.shrubs ?? 0,
    p.cropland ?? 0,
  ];
  const canopyCover = Math.min(greenFractions.reduce((a, b) => a + b, 0), 1.0);

  // Imperviousness: builtup + estimated road surface
  const builtup = p.builtup ?? 0;
  const roadLengthKm = p.total_road_length ?? 0;
  const roadFraction = (roadLengthKm * 0.008) / areaKm2;
  const imperviousness = Math.min(builtup + roadFraction, 1.0);

  // Land use mix: compute from categorical proportions
  const landUseCategories = [
    p.residential ?? 0,
    p.industrial_area ?? 0,
    p.builtup ?? 0,
    canopyCover,
    p.cropland ?? 0,
    p.permanent_water ?? 0,
  ].filter(v => v > 0.01);
  const landUseMix = shannonEntropy(landUseCategories);

  // Park proximity: estimate from green cover
  const parkProximity = canopyCover > 0.2 ? 150 : canopyCover > 0.1 ? 300 : canopyCover > 0.02 ? 500 : 800;

  return {
    landUseMix,
    canopyCover,
    parkProximity,
    imperviousness,
    activeFrontage: null,
    nightLights: p.night_lights_intensity ?? null,
    avgMaxTemp: p.max_temperature ?? null,
    hotNightsPerYear: p.hot_nights_25c_plus1c ?? null,
    ndvi: p.ndvi ?? null,
    canopyHeight: p.canopy_height ?? null,
    wetlandFraction: p.wetland ?? null,
    bareVegetation: p.bare_vegetation ?? null,
  };
}

// ─── Chapter 3: Vitality ────────────────────────────────────

function deriveVitality(
  p: KonturH3Properties,
  _areaKm2: number,
  areaHa: number,
): VitalityIndicators {
  // POI count: combine all sources
  const foursquare = p.foursquare_os_places_count ?? 0;
  const institutional =
    (p.osm_schools_count ?? 0) +
    (p.osm_universities_count ?? 0) +
    (p.osm_colleges_count ?? 0) +
    (p.osm_kindergartens_count ?? 0);
  const hospitals = p.osm_hospitals_count ?? 0;
  const cultural =
    (p.osm_art_venues_count ?? 0) +
    (p.osm_cultural_centers_count ?? 0) +
    (p.osm_entertainment_venues_count ?? 0) +
    (p.osm_heritage_sites_count ?? 0) +
    (p.osm_museums_historical_count ?? 0);
  const poiCount = foursquare + institutional + hospitals + cultural;

  // 15-min completeness: check 8 category groups
  let completeness = 0;
  const hasFood = (p.eatery_count ?? 0) > 0 || (p.dining_and_drinking_fsq_count ?? 0) > 0;
  const hasHealth = hospitals > 0 || (p.healthcare_access != null && p.healthcare_access < 3);
  const hasEducation = (p.osm_schools_count ?? 0) > 0 || (p.osm_kindergartens_count ?? 0) > 0;
  const hasShopping = (p.retail_fsq_count ?? 0) > 0;
  const hasLeisure = (p.sports_recreation_fsq_count ?? 0) > 0 || (p.osm_entertainment_venues_count ?? 0) > 0;
  const hasCivic = (p.osm_universities_count ?? 0) > 0 || (p.osm_colleges_count ?? 0) > 0 || (p.osm_cultural_centers_count ?? 0) > 0;
  const hasCulture = (p.arts_entertainment_fsq_count ?? 0) > 0 || (p.osm_art_venues_count ?? 0) > 0;
  const hasTransport = (p.travel_transport_fsq_count ?? 0) > 0;

  if (hasFood) completeness++;
  if (hasHealth) completeness++;
  if (hasEducation) completeness++;
  if (hasShopping) completeness++;
  if (hasLeisure) completeness++;
  if (hasCivic) completeness++;
  if (hasCulture) completeness++;
  if (hasTransport) completeness++;

  // Social density: dining + drinking + coffee as third places
  const socialPlaces =
    (p.dining_and_drinking_fsq_count ?? 0) +
    (p.eatery_count ?? 0) +
    (p.coffee_shops_fsq_count ?? 0);
  const socialDensity = areaHa > 0 ? socialPlaces / areaHa : 0;

  // Fresh food access
  const hasFreshFood = (p.retail_fsq_count ?? 0) > 0 || (p.eatery_count ?? 0) > 2;
  const freshFoodAccess = hasFreshFood ? 200 : 700;

  // POI diversity: entropy of all category counts
  const categoryCounts = [
    p.eatery_count ?? 0,
    p.dining_and_drinking_fsq_count ?? 0,
    p.retail_fsq_count ?? 0,
    p.osm_schools_count ?? 0,
    p.osm_kindergartens_count ?? 0,
    p.osm_universities_count ?? 0,
    p.osm_colleges_count ?? 0,
    p.arts_entertainment_fsq_count ?? 0,
    p.sports_recreation_fsq_count ?? 0,
    p.landmarks_outdoor_fsq_count ?? 0,
    p.travel_transport_fsq_count ?? 0,
    p.business_services_fsq_count ?? 0,
    p.events_fsq_count ?? 0,
    p.osm_hospitals_count ?? 0,
    p.osm_art_venues_count ?? 0,
    p.osm_entertainment_venues_count ?? 0,
    p.osm_heritage_sites_count ?? 0,
  ].filter(v => v > 0);
  const poiDiversity = categoryCounts.length > 1
    ? shannonEntropy(categoryCounts.map(v => v / Math.max(poiCount, 1)))
    : 0;

  // Daily needs index
  let dailyNeeds = 0;
  if (hasFood) dailyNeeds += 20;
  if (hasHealth) dailyNeeds += 15;
  if (hasEducation) dailyNeeds += 15;
  if (hasShopping) dailyNeeds += 15;
  if (hasTransport) dailyNeeds += 15;
  if ((p.population ?? 0) > 100) dailyNeeds += 10;
  if ((p.osm_bank_count ?? 0) > 0 || (p.osm_atm_count ?? 0) > 0) dailyNeeds += 10;

  return {
    fifteenMinCompleteness: completeness,
    retailClustering: null,
    socialDensity,
    freshFoodAccess,
    dailyNeedsIndex: Math.min(dailyNeeds, 100),
    poiCount,
    poiDiversity,
    foursquarePlaces: p.foursquare_os_places_count ?? null,
    diningDrinking: p.dining_and_drinking_fsq_count ?? null,
    eateryCount: p.eatery_count ?? null,
    retailCount: p.retail_fsq_count ?? null,
    artsEntertainmentPoi: p.arts_entertainment_fsq_count ?? null,
    sportsRecreationPoi: p.sports_recreation_fsq_count ?? null,
    coffeeShopPoi: p.coffee_shops_fsq_count ?? null,
    landmarksOutdoorPoi: p.landmarks_outdoor_fsq_count ?? null,
    travelTransportPoi: p.travel_transport_fsq_count ?? null,
    hospitalCount: p.osm_hospitals_count ?? null,
    wasteContainerCoverage: p.waste_container_coverage ?? null,
  };
}

// ─── Chapter 4: Connectivity ────────────────────────────────

function deriveConnectivity(
  p: KonturH3Properties,
  areaKm2: number,
): ConnectivityIndicators {
  const roadLengthKm = p.total_road_length ?? 0;
  const builtup = p.builtup ?? 0;

  // Intersection density: estimate from road density
  const urbanFactor = builtup > 0.3 ? 35 : builtup > 0.1 ? 25 : 15;
  const estimatedIntersections = roadLengthKm * urbanFactor;
  const intersectionDensity = areaKm2 > 0 ? estimatedIntersections / areaKm2 : 0;

  // Dead end ratio: inversely correlated with urban density
  const deadEndRatio = builtup > 0.3 ? 0.08 : builtup > 0.15 ? 0.18 : builtup > 0.05 ? 0.30 : 0.45;

  // Active transport share: population density proxy
  const popDensity = areaKm2 > 0 ? (p.population ?? 0) / areaKm2 : 0;
  const activeTransportShare = popDensity > 10000 ? 0.25 : popDensity > 3000 ? 0.15 : popDensity > 500 ? 0.08 : 0.03;

  // Orientation entropy: not available, use moderate default
  const orientationEntropy = 0.5;

  // Alpha score: from road density
  const roadDensityKmPerKm2 = areaKm2 > 0 ? roadLengthKm / areaKm2 : 0;
  const alphaScore = Math.min(roadDensityKmPerKm2 / 30, 0.8);

  return {
    intersectionDensity,
    alphaScore,
    orientationEntropy,
    deadEndRatio,
    activeTransportShare,
    totalRoadLength: roadLengthKm,
    intersectionCount: Math.round(estimatedIntersections),
    communicationLinesLength: p.communication_lines_length ?? null,
  };
}

// ─── Chapter 5: Prosperity ──────────────────────────────────

function deriveProsperity(
  p: KonturH3Properties,
  _areaKm2: number,
  _areaHa: number,
): ProsperityIndicators {
  return {
    gdpPopulation: p.gdp_population ?? null,
    nightLightsEconomic: p.night_lights_intensity ?? null,
    hotelCount: p.osm_hotel_count ?? null,
    hotelAvgLevel: p.osm_hotel_avg_level ?? null,
    hotelMaxLevel: p.osm_hotel_max_level ?? null,
    atmCount: p.osm_atm_count ?? null,
    bankCount: p.osm_bank_count ?? null,
    businessServicesPoi: p.business_services_fsq_count ?? null,
    industrialArea: p.industrial_area ?? null,
    retailPoiEconomic: p.retail_fsq_count ?? null,
    eventsPoi: p.events_fsq_count ?? null,
  };
}

// ─── Chapter 6: Environment ─────────────────────────────────

function deriveEnvironment(
  p: KonturH3Properties,
): EnvironmentIndicators {
  return {
    hotDaysPlus1C: p.hot_days_32c_plus1c ?? null,
    hotDaysPlus2C: p.hot_days_32c_plus2c ?? null,
    hotNightsPlus1C: p.hot_nights_25c_plus1c ?? null,
    hotNightsPlus2C: p.hot_nights_25c_plus2c ?? null,
    wetBulbDaysPlus2C: p.wet_bulb_32c_plus2c ?? null,
    solarIrradiance: p.solar_irradiance ?? null,
    relativeHumidity: p.relative_humidity ?? null,
    maxWindSpeed: p.max_wind_speed ?? null,
    avgTemperature: p.avg_temperature ?? null,
    informRiskIndex: p.inform_risk_index ?? null,
    hazardExposure: p.hazard_exposure ?? null,
    vulnerability: p.vulnerability ?? null,
    lackOfCoping: p.lack_of_coping ?? null,
    waterScarcity: p.water_scarcity ?? null,
    floodDaysCount: p.flood_days_count ?? null,
    cycloneDaysCount: p.cyclone_days_count ?? null,
    droughtDaysCount: p.drought_days_count ?? null,
    wildfireDaysCount: p.wildfire_days_count ?? null,
    volcanoDaysCount: p.volcano_days_count ?? null,
    hazardousDaysCount: p.hazardous_days_count ?? null,
    solarSuitability: p.solar_suitability ?? null,
  };
}

// ─── Chapter 7: Culture ─────────────────────────────────────

function deriveCulture(
  p: KonturH3Properties,
  _areaKm2: number,
  _areaHa: number,
): CultureIndicators {
  return {
    artVenues: p.osm_art_venues_count ?? null,
    culturalCenters: p.osm_cultural_centers_count ?? null,
    entertainmentVenues: p.osm_entertainment_venues_count ?? null,
    heritageSites: p.osm_heritage_sites_count ?? null,
    museumsHistorical: p.osm_museums_historical_count ?? null,
    heritageProtectionLevel: p.heritage_protection_level ?? null,
    artsEntertainmentFsq: p.arts_entertainment_fsq_count ?? null,
    landmarksOutdoorFsq: p.landmarks_outdoor_fsq_count ?? null,
    eventsFsq: p.events_fsq_count ?? null,
    collegeCount: p.osm_colleges_count ?? null,
    universityCount: p.osm_universities_count ?? null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────

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

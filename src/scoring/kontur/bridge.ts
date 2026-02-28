/**
 * Kontur H3 → Chrono Indicators Bridge
 *
 * Maps Kontur's pre-aggregated H3 cell properties to the
 * chrono.city indicator framework. This enables scoring any
 * H3 cell on Earth without querying Overture directly.
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
  };
}

// ─── Fabric ──────────────────────────────────────────────────

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
  // Average footprint ≈ (builtup area) / building count
  const builtupM2 = builtup * areaKm2 * 1_000_000;
  const avgFootprint = buildingCount > 0 ? builtupM2 / buildingCount : 500;
  // Median is typically ~70% of mean for building size distributions
  const urbanGrain = avgFootprint * 0.7;

  // Compactness: not available from Kontur, use moderate default
  const compactness = 0.55;

  return {
    gsi,
    fsi,
    osr,
    compactness,
    urbanGrain,
    fractalDimension: null, // Requires geometry, not available in H3
    buildingCount,
    avgHeight,
    heightCoverage: avgHeight != null ? 0.8 : 0, // GHS has good global coverage
  };
}

// ─── Resilience ──────────────────────────────────────────────

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
  // Assume average road width of 8m → road area fraction
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

  // Park proximity: not directly available, estimate from green cover
  // Higher green cover → likely closer to a park
  const parkProximity = canopyCover > 0.2 ? 150 : canopyCover > 0.1 ? 300 : canopyCover > 0.02 ? 500 : 800;

  return {
    landUseMix,
    canopyCover,
    parkProximity,
    imperviousness,
    activeFrontage: null, // Requires street-level analysis
    nightLights: p.night_lights_intensity ?? null,
    avgMaxTemp: null, // Not in the standard general class
    hotNightsPerYear: null, // Available in extended indicators
  };
}

// ─── Vitality ────────────────────────────────────────────────

function deriveVitality(
  p: KonturH3Properties,
  _areaKm2: number,
  areaHa: number,
): VitalityIndicators {
  // POI count: combine Foursquare + OSM institutional
  const foursquare = p.foursquare_os_places_count ?? 0;
  const institutional =
    (p.osm_schools_count ?? 0) +
    (p.osm_universities_count ?? 0) +
    (p.osm_colleges_count ?? 0) +
    (p.osm_kindergartens_count ?? 0);
  const poiCount = foursquare + institutional;

  // 15-min completeness: check category presence
  let completeness = 0;
  const hasFood = (p.eatery_count ?? 0) > 0 || (p.dining_and_drinking_fsq_count ?? 0) > 0;
  const hasHealth = false; // Not available from Kontur indicators
  const hasEducation = (p.osm_schools_count ?? 0) > 0 || (p.osm_kindergartens_count ?? 0) > 0;
  const hasShopping = (p.retail_fsq_count ?? 0) > 0;
  const hasLeisure = false; // Need park data — approximate from green cover
  const hasCivic = (p.osm_universities_count ?? 0) > 0 || (p.osm_colleges_count ?? 0) > 0;

  if (hasFood) completeness++;
  if (hasHealth) completeness++;
  if (hasEducation) completeness++;
  if (hasShopping) completeness++;
  if (hasLeisure) completeness++;
  if (hasCivic) completeness++;

  // Social density: dining + drinking as proxy for third places
  const socialPlaces = (p.dining_and_drinking_fsq_count ?? 0) + (p.eatery_count ?? 0);
  const socialDensity = areaHa > 0 ? socialPlaces / areaHa : 0;

  // Fresh food access: estimate from eatery/retail presence
  const hasFreshFood = (p.retail_fsq_count ?? 0) > 0 || (p.eatery_count ?? 0) > 2;
  const freshFoodAccess = hasFreshFood ? 200 : 700;

  // POI diversity: estimate from category variety
  const categoryPresence = [
    p.eatery_count ?? 0,
    p.dining_and_drinking_fsq_count ?? 0,
    p.retail_fsq_count ?? 0,
    p.osm_schools_count ?? 0,
    p.osm_kindergartens_count ?? 0,
    p.osm_universities_count ?? 0,
    p.osm_colleges_count ?? 0,
  ].filter(v => v > 0);
  const poiDiversity = categoryPresence.length > 1
    ? shannonEntropy(categoryPresence.map(v => v / Math.max(poiCount, 1)))
    : 0;

  // Daily needs index: weighted check
  let dailyNeeds = 0;
  if (hasFood) dailyNeeds += 30;
  if (hasEducation) dailyNeeds += 25;
  if (hasShopping) dailyNeeds += 25;
  if ((p.population ?? 0) > 100) dailyNeeds += 20; // Proxy: populated area likely has transit

  return {
    fifteenMinCompleteness: completeness,
    retailClustering: null, // Requires point distances
    socialDensity,
    freshFoodAccess,
    dailyNeedsIndex: Math.min(dailyNeeds, 100),
    poiCount,
    poiDiversity,
    foursquarePlaces: p.foursquare_os_places_count ?? null,
    diningDrinking: p.dining_and_drinking_fsq_count ?? null,
    eateryCount: p.eatery_count ?? null,
    retailCount: p.retail_fsq_count ?? null,
  };
}

// ─── Connectivity ────────────────────────────────────────────

function deriveConnectivity(
  p: KonturH3Properties,
  areaKm2: number,
): ConnectivityIndicators {
  const roadLengthKm = p.total_road_length ?? 0;

  // Intersection density: estimate from road density
  // Empirical relationship: ~30 intersections per km of road in urban grids
  // Adjusted by builtup fraction (suburban has fewer per km)
  const builtup = p.builtup ?? 0;
  const urbanFactor = builtup > 0.3 ? 35 : builtup > 0.1 ? 25 : 15;
  const estimatedIntersections = roadLengthKm * urbanFactor;
  const intersectionDensity = areaKm2 > 0 ? estimatedIntersections / areaKm2 : 0;

  // Dead end ratio: inversely correlated with urban density
  // Dense grid cities ~5%, suburbs ~30%, rural ~50%
  const deadEndRatio = builtup > 0.3 ? 0.08 : builtup > 0.15 ? 0.18 : builtup > 0.05 ? 0.30 : 0.45;

  // Active transport share: estimate — not available from Kontur
  // Use population density as proxy (dense = more pedestrian infra)
  const popDensity = areaKm2 > 0 ? (p.population ?? 0) / areaKm2 : 0;
  const activeTransportShare = popDensity > 10000 ? 0.25 : popDensity > 3000 ? 0.15 : popDensity > 500 ? 0.08 : 0.03;

  // Orientation entropy: not available, use moderate default
  const orientationEntropy = 0.5;

  // Alpha score: estimate from road density
  const roadDensityKmPerKm2 = areaKm2 > 0 ? roadLengthKm / areaKm2 : 0;
  const alphaScore = Math.min(roadDensityKmPerKm2 / 30, 0.8); // 30 km/km² ≈ very dense grid

  return {
    intersectionDensity,
    alphaScore,
    orientationEntropy,
    deadEndRatio,
    activeTransportShare,
    totalRoadLength: roadLengthKm,
    intersectionCount: Math.round(estimatedIntersections),
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

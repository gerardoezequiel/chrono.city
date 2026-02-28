/**
 * Scoring Pipeline Orchestrator
 *
 * Three modes of operation:
 *
 * 1. scoreH3Cell(konturProps) — Score a single H3 cell from Kontur data
 *    Used by: MapLibre feature click, batch processing, API
 *
 * 2. scorePedshed(overtureIndicators, context) — Score a pedshed from DuckDB
 *    Used by: Browser walkability analysis after isochrone computation
 *
 * 3. scoreBbox(indicators, bbox, area) — Score a bounding box from any source
 *
 * All modes produce the same ChronoScore output, making the
 * framework input-agnostic. Same scoring engine, different data sources.
 */

import type {
  ChronoScore,
  ScoredH3Cell,
  KonturH3Properties,
  RawIndicators,
  ScoringContext,
} from './types';
import { computeChronoScore } from './chrono-score';
import { konturToIndicators } from './kontur/bridge';

// ─── Mode 1: Score from Kontur H3 Cell ───────────────────────

/**
 * Score a single H3 cell using Kontur's pre-aggregated indicators.
 * This is the fast path — no network requests, pure computation.
 */
export function scoreH3Cell(
  props: KonturH3Properties,
  h3Index: string,
  resolution: number = 8,
): ChronoScore {
  const indicators = konturToIndicators(props);
  const context: ScoringContext = {
    mode: 'h3',
    h3Index,
    resolution,
    areaKm2: props.area_km2 ?? 0.737,
  };
  return computeChronoScore(indicators, context);
}

/**
 * Batch score multiple H3 cells.
 * Returns flat rows suitable for CSV/Parquet export or API response.
 */
export function scoreH3Cells(
  cells: Array<{ h3Index: string; props: KonturH3Properties; resolution?: number }>,
): ScoredH3Cell[] {
  return cells.map(({ h3Index, props, resolution }) => {
    const result = scoreH3Cell(props, h3Index, resolution);
    return chronoScoreToFlatRow(result, props);
  });
}

// ─── Mode 2: Score from Overture Pedshed ─────────────────────

/**
 * Score a pedshed using indicators computed by DuckDB-WASM.
 * This is the deep analysis path — richer data, slower execution.
 */
export function scorePedshed(
  indicators: RawIndicators,
  origin: { lng: number; lat: number },
  minutes: number,
  areaKm2: number,
): ChronoScore {
  const context: ScoringContext = {
    mode: 'pedshed',
    origin,
    minutes,
    areaKm2,
  };
  return computeChronoScore(indicators, context);
}

// ─── Mode 3: Score from bbox ─────────────────────────────────

/**
 * Score a bounding box using indicators from any source.
 */
export function scoreBbox(
  indicators: RawIndicators,
  bbox: { west: number; south: number; east: number; north: number },
  areaKm2: number,
): ChronoScore {
  const context: ScoringContext = {
    mode: 'bbox',
    ...bbox,
    areaKm2,
  };
  return computeChronoScore(indicators, context);
}

// ─── Output Formatting ───────────────────────────────────────

/** Flatten ChronoScore to a single row for export/API */
function chronoScoreToFlatRow(
  score: ChronoScore,
  props: KonturH3Properties,
): ScoredH3Cell {
  const ctx = score.context;

  // Cultural POI aggregate
  const culturalPois =
    (props.osm_art_venues_count ?? 0) +
    (props.osm_cultural_centers_count ?? 0) +
    (props.osm_entertainment_venues_count ?? 0) +
    (props.osm_heritage_sites_count ?? 0) +
    (props.osm_museums_historical_count ?? 0) +
    (props.arts_entertainment_fsq_count ?? 0);

  return {
    h3_index: ctx.mode === 'h3' ? ctx.h3Index : '',
    resolution: ctx.mode === 'h3' ? ctx.resolution : 0,
    area_km2: ctx.areaKm2,
    chrono_score: score.score,
    chrono_grade: score.grade,
    // All 7 chapters
    fabric_score: score.chapters.fabric.score,
    resilience_score: score.chapters.resilience.score,
    vitality_score: score.chapters.vitality.score,
    connectivity_score: score.chapters.connectivity.score,
    prosperity_score: score.chapters.prosperity.score,
    environment_score: score.chapters.environment.score,
    culture_score: score.chapters.culture.score,
    // Key indicators
    population: props.population ?? 0,
    building_density: props.builtup ?? 0,
    green_cover: (props.forest ?? 0) + (props.herbage ?? 0) + (props.shrubs ?? 0),
    poi_density: (props.foursquare_os_places_count ?? 0) / Math.max(ctx.areaKm2, 0.01),
    intersection_density: score.chapters.connectivity.components['intersectionDensity'] ?? 0,
    gdp_proxy: props.gdp_population ?? 0,
    inform_risk: props.inform_risk_index ?? 0,
    cultural_pois: culturalPois,
    data_confidence: score.confidence,
  };
}

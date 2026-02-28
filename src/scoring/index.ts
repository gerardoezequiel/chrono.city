/**
 * Chrono Urban Scoring Framework — 7-Chapter Edition
 *
 * Public API:
 *   scoreH3Cell(props, h3Index)    → ChronoScore from Kontur H3 data
 *   scoreH3Cells(cells)            → ScoredH3Cell[] for batch export
 *   scorePedshed(indicators, ...)  → ChronoScore from DuckDB analysis
 *   scoreBbox(indicators, ...)     → ChronoScore from any bounding box
 *   computeChronoScore(raw, ctx)   → Low-level: raw indicators → score
 *
 * 7 Chapters:
 *   1. Fabric       — Urban morphology (GSI, FSI, grain, age)
 *   2. Resilience    — Green, mixed, permeable (NDVI, canopy height)
 *   3. Vitality      — 15-min city (8 categories, healthcare, leisure)
 *   4. Connectivity  — Network walkability (intersections, dead ends)
 *   5. Prosperity    — Economic vibrancy (GDP, night lights, hotels)
 *   6. Environment   — Climate & disaster risk (INFORM, heat, wet-bulb)
 *   7. Culture       — Cultural capital (heritage, arts, knowledge)
 */

// Pipeline (main entry points)
export { scoreH3Cell, scoreH3Cells, scorePedshed, scoreBbox } from './pipeline';

// Composite scorer
export { computeChronoScore, FRAMEWORK_VERSION } from './chrono-score';

// Chapter scorers (for testing / individual chapter display)
export { scoreFabric } from './chapters/fabric';
export { scoreResilience } from './chapters/resilience';
export { scoreVitality } from './chapters/vitality';
export { scoreConnectivity } from './chapters/connectivity';
export { scoreProsperity } from './chapters/prosperity';
export { scoreEnvironment } from './chapters/environment';
export { scoreCulture } from './chapters/culture';

// Normalization engine
export { normalize, ALL_NORMS } from './normalize';

// Kontur bridge
export { konturToIndicators, konturSourceConfig, KONTUR_TILE_URL, KONTUR_LAYER_NAME } from './kontur';

// Utilities
export { computeGrade, gradeLabel } from './utils';

// Types
export type {
  ChronoScore,
  ChapterScore,
  ChapterName,
  Grade,
  RawIndicators,
  FabricIndicators,
  ResilienceIndicators,
  VitalityIndicators,
  ConnectivityIndicators,
  ProsperityIndicators,
  EnvironmentIndicators,
  CultureIndicators,
  KonturH3Properties,
  ScoredH3Cell,
  ScoringContext,
  NormalizationCurve,
  NormalizationSpec,
} from './types';

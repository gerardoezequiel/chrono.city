/**
 * Chrono Urban Scoring Framework
 *
 * Public API:
 *   scoreH3Cell(props, h3Index)    → ChronoScore from Kontur H3 data
 *   scoreH3Cells(cells)            → ScoredH3Cell[] for batch export
 *   scorePedshed(indicators, ...)  → ChronoScore from DuckDB analysis
 *   scoreBbox(indicators, ...)     → ChronoScore from any bounding box
 *   computeChronoScore(raw, ctx)   → Low-level: raw indicators → score
 *
 * The framework is input-agnostic: Kontur tiles and Overture queries
 * both feed the same scoring engine. Same methodology, same output.
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
  KonturH3Properties,
  ScoredH3Cell,
  ScoringContext,
  NormalizationCurve,
  NormalizationSpec,
} from './types';

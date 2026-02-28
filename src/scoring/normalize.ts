/**
 * Normalization Engine
 *
 * Transforms raw indicator values into 0–100 scores using
 * academically-grounded curves and ranges.
 *
 * Each normalization spec includes the reference paper that
 * justifies the chosen range — this is what makes the framework
 * defensible to researchers and credible to city councils.
 */

import type { NormalizationCurve, NormalizationSpec } from './types';

/** Clamp a value to [0, 100] */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Apply a normalization curve to produce a 0–100 score */
export function normalize(value: number | null, curve: NormalizationCurve): number {
  if (value == null || !isFinite(value)) return 0;

  switch (curve.type) {
    case 'linear': {
      const range = curve.max - curve.min;
      if (range === 0) return 50;
      const raw = ((value - curve.min) / range) * 100;
      return clamp(curve.invert ? 100 - raw : raw);
    }

    case 'triangular': {
      // Peak score at the optimal value, drops off both sides
      if (value <= curve.min || value >= curve.max) return 0;
      if (value <= curve.peak) {
        return clamp(((value - curve.min) / (curve.peak - curve.min)) * 100);
      }
      return clamp(((curve.max - value) / (curve.max - curve.peak)) * 100);
    }

    case 'logarithmic': {
      const logMin = Math.log1p(curve.min);
      const logMax = Math.log1p(curve.max);
      const logVal = Math.log1p(Math.max(0, value));
      const range = logMax - logMin;
      if (range === 0) return 50;
      const raw = ((logVal - logMin) / range) * 100;
      return clamp(curve.invert ? 100 - raw : raw);
    }

    case 'threshold': {
      // Step function: find which bracket the value falls into
      for (let i = curve.thresholds.length - 1; i >= 0; i--) {
        const threshold = curve.thresholds[i];
        if (threshold != null && value >= threshold) return curve.scores[i] ?? 0;
      }
      return curve.scores[0] ?? 0;
    }

    case 'sigmoid': {
      // S-curve centered at midpoint
      const x = -curve.steepness * (value - curve.midpoint);
      const raw = 100 / (1 + Math.exp(x));
      return clamp(curve.invert ? 100 - raw : raw);
    }
  }
}

// ─── Fabric Normalization Specs ──────────────────────────────

export const FABRIC_NORMS: NormalizationSpec[] = [
  {
    key: 'gsi',
    label: 'Ground Coverage',
    curve: { type: 'triangular', peak: 0.35, min: 0.05, max: 0.75 },
    reference: 'Berghauser Pont & Haupt (2010) — Spacematrix optimal GSI 0.25–0.45',
    interpretation: 'Balanced density: not too sparse, not too dense',
  },
  {
    key: 'fsi',
    label: 'Floor Intensity',
    curve: { type: 'triangular', peak: 2.5, min: 0.2, max: 8.0 },
    reference: 'Berghauser Pont & Haupt (2010) — FSI sweet spot for mixed-use neighborhoods',
    interpretation: 'Moderate intensity supports diverse building types',
  },
  {
    key: 'compactness',
    label: 'Building Compactness',
    curve: { type: 'linear', min: 0.3, max: 0.8 },
    reference: 'Fleischmann et al. (2021) — Energy-efficient morphology',
    interpretation: 'Compact forms retain heat and minimize surface-to-volume ratio',
  },
  {
    key: 'urbanGrain',
    label: 'Urban Grain',
    curve: {
      type: 'threshold',
      thresholds: [0, 50, 150, 500, 1000, 3000],
      scores: [30, 100, 80, 60, 30, 10],
    },
    reference: 'Alexander (1977) — A Pattern Language: fine-grain 50–200m² is human-scale',
    interpretation: 'Fine grain (small plots) supports variety, walkability, and mixed use',
  },
  {
    key: 'fractalDimension',
    label: 'Complexity',
    curve: { type: 'linear', min: 1.1, max: 1.8 },
    reference: 'Batty & Longley (1994) — Fractal Cities: mature cities 1.4–1.7',
    interpretation: 'Higher complexity indicates organic, evolved urban form',
  },
];

// ─── Resilience Normalization Specs ──────────────────────────

export const RESILIENCE_NORMS: NormalizationSpec[] = [
  {
    key: 'landUseMix',
    label: 'Land Use Mix',
    curve: { type: 'linear', min: 0.2, max: 0.85 },
    reference: 'Song et al. (2013) — Entropy above 0.7 reduces car dependency',
    interpretation: 'Mixed-use neighborhoods reduce travel demand',
  },
  {
    key: 'canopyCover',
    label: 'Green Cover',
    curve: { type: 'linear', min: 0.02, max: 0.35 },
    reference: 'Konijnendijk (2023) — 3-30-300 Rule: 30% canopy for microclimate cooling',
    interpretation: 'Tree canopy provides shade, air quality, and mental health benefits',
  },
  {
    key: 'parkProximity',
    label: 'Park Access',
    curve: { type: 'linear', min: 0, max: 600, invert: true },
    reference: 'WHO (2016) — Every home within 300m of park ≥0.5ha',
    interpretation: 'Nearby green space supports physical activity and well-being',
  },
  {
    key: 'imperviousness',
    label: 'Permeability',
    curve: { type: 'linear', min: 0.3, max: 0.85, invert: true },
    reference: 'White et al. (2020) — Sealed surfaces increase flood risk and heat',
    interpretation: 'More permeable surfaces reduce stormwater runoff',
  },
  {
    key: 'hotNightsPerYear',
    label: 'Climate Comfort',
    curve: { type: 'sigmoid', midpoint: 60, steepness: 0.05, invert: true },
    reference: 'Kontur Nighttime Heatwave Risk — tropical nights threshold 25°C',
    interpretation: 'Fewer hot nights means better sleep quality and health outcomes',
  },
];

// ─── Vitality Normalization Specs ────────────────────────────

export const VITALITY_NORMS: NormalizationSpec[] = [
  {
    key: 'fifteenMinCompleteness',
    label: '15-Min Completeness',
    curve: {
      type: 'threshold',
      thresholds: [0, 1, 2, 3, 4, 5, 6],
      scores: [0, 17, 33, 50, 67, 83, 100],
    },
    reference: 'Moreno et al. (2021) — 6 essential categories for 15-minute city',
    interpretation: 'All daily needs accessible on foot within 15 minutes',
  },
  {
    key: 'socialDensity',
    label: 'Social Places',
    curve: { type: 'logarithmic', min: 0.5, max: 15 },
    reference: 'Oldenburg (1989) — Third places build social capital',
    interpretation: 'Cafés, pubs, libraries, and parks enable social interaction',
  },
  {
    key: 'freshFoodAccess',
    label: 'Food Access',
    curve: { type: 'linear', min: 0, max: 800, invert: true },
    reference: 'USDA food desert definition: >500m to grocery in urban areas',
    interpretation: 'Nearby fresh food prevents food insecurity',
  },
  {
    key: 'poiDiversity',
    label: 'POI Diversity',
    curve: { type: 'linear', min: 0.3, max: 0.9 },
    reference: 'Shannon entropy — high diversity indicates functional mix',
    interpretation: 'Diverse amenities serve more needs locally',
  },
  {
    key: 'dailyNeedsIndex',
    label: 'Daily Convenience',
    curve: { type: 'linear', min: 10, max: 90 },
    reference: 'Ewing & Cervero (2010) — D-variables for walkable neighborhoods',
    interpretation: 'Pharmacy, grocery, school, transit all within walking distance',
  },
];

// ─── Connectivity Normalization Specs ────────────────────────

export const CONNECTIVITY_NORMS: NormalizationSpec[] = [
  {
    key: 'intersectionDensity',
    label: 'Intersection Density',
    curve: { type: 'linear', min: 30, max: 150 },
    reference: 'Ewing & Cervero (2010) — >100/km² is walkable; <40 is car-dependent',
    interpretation: 'More intersections = more route choices = better walkability',
  },
  {
    key: 'deadEndRatio',
    label: 'Dead-End Penalty',
    curve: { type: 'linear', min: 0.02, max: 0.4, invert: true },
    reference: 'Marshall (2004) — Cul-de-sacs force long detours',
    interpretation: 'Fewer dead ends means a more connected, permeable network',
  },
  {
    key: 'activeTransportShare',
    label: 'Active Transport',
    curve: { type: 'linear', min: 0.02, max: 0.35 },
    reference: 'Gehl (2010) — Cities for People: active infrastructure priority',
    interpretation: 'High share of footways + cycleways = investment in people',
  },
  {
    key: 'orientationEntropy',
    label: 'Grid Legibility',
    curve: { type: 'linear', min: 0.3, max: 0.85, invert: true },
    reference: 'Boeing (2019) — Low entropy = regular grid = navigable',
    interpretation: 'Ordered street grid is easier to navigate on foot',
  },
  {
    key: 'alphaScore',
    label: 'Network Efficiency',
    curve: { type: 'linear', min: 0.15, max: 0.75 },
    reference: 'Porta & Renne (2005) — Pedshed ratio as permeability measure',
    interpretation: 'Higher ratio means walking covers more area efficiently',
  },
];

// ─── Aggregate Export ────────────────────────────────────────

export const ALL_NORMS = {
  fabric: FABRIC_NORMS,
  resilience: RESILIENCE_NORMS,
  vitality: VITALITY_NORMS,
  connectivity: CONNECTIVITY_NORMS,
} as const;

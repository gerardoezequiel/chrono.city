export interface OrientationResult {
  bins: number[];          // 36 bins (5° each, 0-180°), length-weighted
  entropy: number;         // Normalized 0-1 (0=perfect grid, 1=random)
  gridOrder: number;       // Top-4 bin concentration 0-1 (1=perfect grid)
  dominantBearing: number; // Most common direction 0-180°
  segmentCount: number;
}

const NUM_BINS = 36;
const BIN_WIDTH = 180 / NUM_BINS; // 5°
const MAX_ENTROPY = Math.log2(NUM_BINS);
const DEG_TO_RAD = Math.PI / 180;

/** Compute bearing between two [lng, lat] points, normalized to [0, 180) */
function bearing(a: [number, number], b: [number, number]): number {
  const dLng = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * DEG_TO_RAD);
  const dLat = b[1] - a[1];
  let deg = Math.atan2(dLng, dLat) * (180 / Math.PI);
  deg = ((deg % 180) + 180) % 180; // Normalize to [0, 180)
  return deg;
}

/** Approximate distance in meters between two [lng, lat] points */
function distanceM(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * 111_139;
  const dLng = (b[0] - a[0]) * 111_139 * Math.cos(((a[1] + b[1]) / 2) * DEG_TO_RAD);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Compute street orientation from GeoJSON LineString features */
export function computeOrientation(features: GeoJSON.Feature[]): OrientationResult {
  const bins = new Array<number>(NUM_BINS).fill(0);
  let segmentCount = 0;

  for (const f of features) {
    if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') continue;

    const lines = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates
      : [f.geometry.coordinates];

    for (const coords of lines) {
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i] as [number, number];
        const b = coords[i + 1] as [number, number];
        const len = distanceM(a, b);
        if (len < 1) continue; // Skip degenerate segments

        const deg = bearing(a, b);
        const bin = Math.floor(deg / BIN_WIDTH) % NUM_BINS;
        bins[bin] = (bins[bin] ?? 0) + len; // Weight by length
        segmentCount++;
      }
    }
  }

  // Normalize bins
  const total = bins.reduce((s, v) => s + v, 0);
  if (total === 0) {
    return { bins, entropy: 0, gridOrder: 0, dominantBearing: 0, segmentCount: 0 };
  }

  const normalized = bins.map((b) => b / total);

  // Shannon entropy, normalized to [0, 1]
  let entropyRaw = 0;
  for (const p of normalized) {
    if (p > 0) entropyRaw -= p * Math.log2(p);
  }
  const entropy = entropyRaw / MAX_ENTROPY;

  // Grid order: sum of top 4 bins
  const gridOrder = [...normalized].sort((a, b) => b - a).slice(0, 4).reduce((s, v) => s + v, 0);

  // Dominant bearing: center of the heaviest bin
  const maxBin = bins.indexOf(Math.max(...bins));
  const dominantBearing = maxBin * BIN_WIDTH + BIN_WIDTH / 2;

  return { bins, entropy, gridOrder, dominantBearing, segmentCount };
}

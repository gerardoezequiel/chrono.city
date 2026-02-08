export const OVERTURE_RELEASE = '2026-01-21.0';

export const S3_BASE = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme`;

export const S3_PATHS = {
  segments: `${S3_BASE}=transportation/type=segment/*`,
  connectors: `${S3_BASE}=transportation/type=connector/*`,
  buildings: `${S3_BASE}=buildings/type=building/*`,
  places: `${S3_BASE}=places/type=place/*`,
} as const;

/** PMTiles are on the S3 beta bucket, release drops the .0 suffix */
export const PMTILES_BASE = 'https://overturemaps-tiles-us-west-2-beta.s3.amazonaws.com/2026-01-21';

export const PMTILES_URLS = {
  buildings: `${PMTILES_BASE}/buildings.pmtiles`,
  transportation: `${PMTILES_BASE}/transportation.pmtiles`,
  places: `${PMTILES_BASE}/places.pmtiles`,
  base: `${PMTILES_BASE}/base.pmtiles`,
} as const;

/** Walking speeds by road class in m/s */
export const WALK_SPEEDS: Record<string, number> = {
  footway: 1.39,
  pedestrian: 1.39,
  path: 1.39,
  steps: 1.0,
  cycleway: 1.39,
  residential: 1.25,
  living_street: 1.25,
  tertiary: 1.11,
  tertiary_link: 1.11,
  unclassified: 1.11,
  secondary: 0.97,
  secondary_link: 0.97,
  primary: 0.83,
  primary_link: 0.83,
  trunk: 0,
  trunk_link: 0,
  motorway: 0,
  motorway_link: 0,
};

/** Default speed for unknown road classes */
export const DEFAULT_WALK_SPEED = 1.11; // m/s (~4 km/h)

/** Isochrone time presets in minutes */
export const ISOCHRONE_PRESETS = [5, 10, 15] as const;

/** Radius in degrees to fetch network graph around origin (~2km) */
export const GRAPH_FETCH_RADIUS_DEG = 0.02;

/** Map defaults */
export const MAP_DEFAULTS = {
  center: [-73.985, 40.748] as [number, number], // NYC
  zoom: 13,
  minZoom: 2,
  maxZoom: 20,
} as const;

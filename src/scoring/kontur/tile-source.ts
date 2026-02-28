/**
 * Kontur Bivariate Tile Source Configuration
 *
 * Defines the MapLibre source and layer configuration for
 * consuming Kontur's H3 indicator tiles. The tiles provide
 * pre-aggregated data at H3 resolution 0–8 (zoom-dependent).
 *
 * Usage in MapLibre:
 *   1. Add the vector source
 *   2. Add fill/line layers for hexagon visualization
 *   3. On feature click → scoreH3Cell(feature.properties)
 */

/** Kontur bivariate tile endpoint */
export const KONTUR_TILE_URL =
  'https://disaster.ninja/active/api/tiles/bivariate/v1/{z}/{x}/{y}.mvt?indicatorsClass=general';

/** The single layer name in Kontur MVT tiles */
export const KONTUR_LAYER_NAME = 'stats';

/** Maximum native zoom (data resolution caps at H3 r8) */
export const KONTUR_MAX_ZOOM = 8;

/** Tile extent (Kontur uses 8192, not the default 4096) */
export const KONTUR_TILE_EXTENT = 8192;

/** Zoom → H3 resolution mapping (Kontur's formula) */
export const ZOOM_TO_H3_RES: Record<number, number> = {
  0: 0, 1: 0, 2: 0,
  3: 1,
  4: 2,
  5: 3, 6: 3,
  7: 4,
  8: 5, 9: 5,
  10: 6,
  11: 7,
  12: 8, 13: 8,
};

/**
 * MapLibre source configuration for Kontur indicator tiles.
 *
 * Add to map:
 * ```typescript
 * map.addSource('kontur-indicators', konturSourceConfig);
 * ```
 */
export const konturSourceConfig = {
  type: 'vector' as const,
  tiles: [KONTUR_TILE_URL],
  tileSize: 512,
  maxzoom: KONTUR_MAX_ZOOM,
  attribution: '© <a href="https://www.kontur.io">Kontur</a>',
};

/**
 * Properties available in each Kontur tile feature.
 * Used for MapLibre expressions and feature-state queries.
 */
export const KONTUR_PROPERTY_KEYS = [
  // Spatial
  'h3', 'area_km2',
  // Demographics
  'population',
  // Built environment
  'builtup', 'residential', 'industrial_area',
  'building_count', 'total_building_count',
  'ghs_avg_building_height', 'total_road_length',
  'night_lights_intensity',
  // Vegetation & land cover
  'forest', 'evergreen_needle_leaved_forest', 'unknown_forest',
  'cropland', 'herbage', 'shrubs', 'bare_vegetation',
  'moss_lichen', 'snow_ice',
  // Water
  'permanent_water', 'wetland',
  // Institutional
  'osm_schools_count', 'osm_universities_count',
  'osm_colleges_count', 'osm_kindergartens_count',
  // Commercial
  'foursquare_os_places_count', 'eatery_count',
  'dining_and_drinking_fsq_count', 'retail_fsq_count',
] as const;

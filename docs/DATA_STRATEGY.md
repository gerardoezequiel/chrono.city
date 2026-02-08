# Data Strategy

> How chrono.city accesses, queries, and caches geospatial data. This document is the reference for all data-related implementation decisions.

## Data source: Overture Maps

[Overture Maps Foundation](https://overturemaps.org/) is a collaborative project by Amazon, Meta, Microsoft, and others that produces open, interoperable map data with global coverage.

### Why Overture

- **Global coverage.** Buildings, roads, POIs for the entire planet.
- **Topological network.** Transportation segments reference connectors — a proper graph, not just linestrings.
- **Cloud-native formats.** GeoParquet on S3, PMTiles for vector tiles. No download-and-import pipeline.
- **Free access.** S3 bucket is on AWS Open Data Program — zero egress cost.
- **Monthly releases.** Data improves continuously. Cache invalidation is simple: version string in cache keys.
- **Open license.** ODbL for places, CDLA Permissive 2.0 for the rest. Compatible with open-source distribution.

### Overture themes used

| Theme | Type | What we use it for |
|-------|------|-------------------|
| `buildings` | `building` | Footprint area, density, morphology metrics |
| `places` | `place` | POI counts, category diversity, 15-minute city |
| `transportation` | `segment` | Road network metrics, isochrone graph edges |
| `transportation` | `connector` | Isochrone graph nodes |
| `base` | `land_use` | Land use mix, zoning analysis (future) |

### S3 bucket structure

```
s3://overturemaps-us-west-2/release/{version}/theme={theme}/type={type}/*.parquet

Example paths:
s3://overturemaps-us-west-2/release/2026-01-21.0/theme=buildings/type=building/*
s3://overturemaps-us-west-2/release/2026-01-21.0/theme=places/type=place/*
s3://overturemaps-us-west-2/release/2026-01-21.0/theme=transportation/type=segment/*
s3://overturemaps-us-west-2/release/2026-01-21.0/theme=transportation/type=connector/*
```

Files are hive-partitioned GeoParquet. Each file contains a `bbox` struct column with `xmin`, `xmax`, `ymin`, `ymax` that enables predicate pushdown.

### PMTiles source

Overture publishes PMTiles for vector tile rendering. These are used exclusively by MapLibre for visual rendering — never for analytics.

```
https://overturemaps.org/pmtiles/buildings.pmtiles
https://overturemaps.org/pmtiles/transportation.pmtiles
https://overturemaps.org/pmtiles/places.pmtiles
```

## Reference location: Piccadilly Circus, London

All notebooks and documentation examples default to **Piccadilly Circus** (51.5099, -0.1337) as the canonical test location. This gives us a single, well-known area to validate every query — buildings, places, transport, land use — against both S3 GeoParquet and PMTiles.

### Why Piccadilly

- **Dense mixed-use fabric.** West End covers Soho, Mayfair, Covent Garden, St James's — exercises building morphology metrics across varied typologies.
- **Rich POI density.** Hundreds of restaurants, shops, theatres, transit stations — maximises coverage for amenity/vitality metrics.
- **Strong transit connectivity.** Piccadilly Circus underground station + bus routes — exercises the street network and active transport metrics.
- **Complete Overture coverage.** All 5 themes have good data density in central London.

### Reference pedshed (1200 m radius)

The default study area is a **1200 m circular pedshed** (15-minute walk at 80 m/min) centered on Piccadilly Circus. This serves as a "mock isochrone" in the notebooks — in the live app, it will be replaced by a true Dijkstra isochrone from the walkable street network.

| Parameter | Value |
|-----------|-------|
| Center | 51.5099, -0.1337 |
| Radius | 1200 m |
| Study area | 452.4 ha (4.52 km²) |
| Bbox (with 1.5× buffer) | |
| south | 51.4937 |
| north | 51.5261 |
| west | -0.1597 |
| east | -0.1077 |

### Reference bbox predicate (copy-paste ready)

```sql
WHERE bbox.xmin <= -0.1077
  AND bbox.xmax >= -0.1597
  AND bbox.ymin <= 51.5261
  AND bbox.ymax >= 51.4937
```

### Reference circular filter (post-predicate-pushdown)

```sql
AND ST_DWithin(
    ST_GeomFromWKB(geometry),
    ST_Point(-0.1337, 51.5099),
    0.010781  -- ~1200 m in degrees
)
```

This area covers approximately:
- **~3,000-5,000 buildings** (Overture buildings theme)
- **~2,000-4,000 POIs** (Overture places theme)
- **~1,500-3,000 road segments** (Overture transportation/segment)
- **~1,000-2,500 connectors** (Overture transportation/connector)

## DuckDB-WASM: the query engine

DuckDB-WASM (~15MB) is the application's query engine. It runs entirely in the browser and queries Overture's S3 bucket directly via the `httpfs` extension.

### Why DuckDB-WASM and not alternatives

| Alternative | Why not |
|-------------|---------|
| `querySourceFeatures()` on PMTiles | Zoom-dependent, misses features at low zoom, viewport-limited |
| `parquet-wasm` (~2MB) | Cannot resolve glob patterns, no hive partitioning, no SQL, no spatial functions |
| Backend API (PostGIS) | Introduces server cost, maintenance, deployment complexity |
| Pre-computed static files | Loses flexibility — can't compute for arbitrary bbox or isochrone polygon |

DuckDB-WASM is justified because:
1. It resolves S3 glob patterns across hundreds of Parquet files
2. It prunes partitions using bbox column statistics (predicate pushdown)
3. It downloads only matching row groups via HTTP range requests
4. It provides spatial SQL functions (ST_Area, ST_Within, etc.)
5. It enables arbitrary aggregation queries without a backend

### Initialisation

```typescript
// data/duckdb/init.ts
import * as duckdb from '@duckdb/duckdb-wasm';

const OVERTURE_VERSION = '2026-01-21.0';
const OVERTURE_BASE = `s3://overturemaps-us-west-2/release/${OVERTURE_VERSION}/theme`;

export async function initDuckDB() {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const conn = await db.connect();
  await conn.query("INSTALL httpfs; LOAD httpfs;");
  await conn.query("INSTALL spatial; LOAD spatial;");
  await conn.query("SET s3_region='us-west-2';");

  return { db, conn };
}
```

### Query: Buildings

Returns aggregate metrics for building footprints within a bounding box.
Example uses the **Piccadilly reference bbox**.

```sql
SELECT
  COUNT(*) as building_count,
  SUM(ST_Area(ST_GeomFromWKB(geometry))) as total_footprint_area_m2,
  AVG(ST_Area(ST_GeomFromWKB(geometry))) as avg_footprint_area_m2,
  MIN(ST_Area(ST_GeomFromWKB(geometry))) as min_footprint_area_m2,
  MAX(ST_Area(ST_GeomFromWKB(geometry))) as max_footprint_area_m2,
  STDDEV(ST_Area(ST_GeomFromWKB(geometry))) as stddev_footprint_area_m2,
  COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
  AVG(height) as avg_height_m,
  COUNT(CASE WHEN num_floors IS NOT NULL THEN 1 END) as buildings_with_floors,
  AVG(num_floors) as avg_floors
FROM read_parquet(
  '${OVERTURE_BASE}=buildings/type=building/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= -0.1077    -- east (Piccadilly 1200m pedshed)
  AND bbox.xmax >= -0.1597    -- west
  AND bbox.ymin <= 51.5261    -- north
  AND bbox.ymax >= 51.4937    -- south
```

### Query: Places (POIs)

Returns POI counts and category breakdown.
Example uses the **Piccadilly reference bbox**.

```sql
SELECT
  COUNT(*) as poi_count,
  categories.primary as primary_category,
  COUNT(*) as category_count
FROM read_parquet(
  '${OVERTURE_BASE}=places/type=place/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= -0.1077
  AND bbox.xmax >= -0.1597
  AND bbox.ymin <= 51.5261
  AND bbox.ymax >= 51.4937
GROUP BY categories.primary
ORDER BY category_count DESC
```

### Query: Transportation (aggregate metrics)

Returns road network statistics by class.
Example uses the **Piccadilly reference bbox**.

```sql
SELECT
  class as road_class,
  COUNT(*) as segment_count,
  SUM(ST_Length(ST_GeomFromWKB(geometry))) as total_length_m,
  AVG(ST_Length(ST_GeomFromWKB(geometry))) as avg_segment_length_m
FROM read_parquet(
  '${OVERTURE_BASE}=transportation/type=segment/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= -0.1077
  AND bbox.xmax >= -0.1597
  AND bbox.ymin <= 51.5261
  AND bbox.ymax >= 51.4937
  AND subtype = 'road'
GROUP BY class
```

### Query: Network graph (for isochrone)

Returns the full topological graph — segments with geometry and connector references, plus connector positions. This is the most expensive query (~2-5MB).
Example uses the **Piccadilly reference bbox** (with wider buffer for isochrone).

```sql
-- Edges: road segments with connector references
SELECT
  id,
  class,
  subclass,
  connectors,
  ST_AsGeoJSON(ST_GeomFromWKB(geometry)) as geom_json,
  ST_Length(ST_GeomFromWKB(geometry)) as length_m
FROM read_parquet(
  '${OVERTURE_BASE}=transportation/type=segment/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= -0.1077
  AND bbox.xmax >= -0.1597
  AND bbox.ymin <= 51.5261
  AND bbox.ymax >= 51.4937
  AND subtype = 'road'

-- Nodes: connectors with positions
SELECT
  id,
  ST_X(ST_GeomFromWKB(geometry)) as lon,
  ST_Y(ST_GeomFromWKB(geometry)) as lat
FROM read_parquet(
  '${OVERTURE_BASE}=transportation/type=connector/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= -0.1077
  AND bbox.xmax >= -0.1597
  AND bbox.ymin <= 51.5261
  AND bbox.ymax >= 51.4937
```

**Important:** the network graph query uses a larger bbox than the viewport — typically 2km buffer around the isochrone origin. This ensures the isochrone doesn't get clipped at the query boundary.

## Performance characteristics

### How predicate pushdown works

Overture GeoParquet files contain a `bbox` struct column. Parquet row groups store min/max statistics for each column. DuckDB reads these statistics before downloading any data.

```
Query: WHERE bbox.xmin <= -0.1077 AND bbox.xmax >= -0.1597 ...
       (Piccadilly Circus, 1200m pedshed)

File: london_chunk_042.parquet
  Row group 0: bbox.xmin range [0.2, 0.5]   → SKIP (doesn't intersect)
  Row group 1: bbox.xmin range [-0.3, -0.1]  → DOWNLOAD (might intersect)
  Row group 2: bbox.xmin range [1.0, 1.5]    → SKIP

Result: only row group 1 is downloaded via HTTP range request
```

### Expected query performance

| Query | Data transfer | Latency (cold) | Latency (warm) |
|-------|--------------|-----------------|-----------------|
| Buildings (aggregates) | 100-500 KB | 200ms-1s | 50-200ms |
| Places (aggregates) | 50-200 KB | 150ms-800ms | 50-150ms |
| Transport (aggregates) | 100-300 KB | 200ms-1s | 50-200ms |
| Network graph (full geom) | 2-5 MB | 1-3s | 200-500ms |

"Cold" = first query in session (no Parquet metadata cached).
"Warm" = metadata cached from previous query to same or nearby area.

### Bandwidth budget

A typical exploration session (one city, several pans):

| Action | Data | Cumulative |
|--------|------|-----------|
| Initial DuckDB-WASM load | ~15 MB | 15 MB |
| PMTiles (vector tiles) | ~5-10 MB | 25 MB |
| First section (buildings) | ~300 KB | 25.3 MB |
| Second section (network) | ~300 KB | 25.6 MB |
| Third section (POIs) | ~200 KB | 25.8 MB |
| Isochrone network graph | ~3 MB | 28.8 MB |
| 5 map pans (prefetched) | ~2 MB | 30.8 MB |

Total: ~30MB for a full exploration session. Comparable to loading a medium webpage with images.

## 3×3 spatial prefetch

When the user interacts with the map (zoom to city, pan), the application prefetches data for a 3×3 grid of bboxes centered on the current viewport.

### Grid generation

```typescript
function generate3x3Grid(viewport: BBox): BBox[] {
  const width = viewport.east - viewport.west;
  const height = viewport.north - viewport.south;

  return [-1, 0, 1].flatMap(dx =>
    [-1, 0, 1].map(dy => ({
      west: viewport.west + dx * width,
      south: viewport.south + dy * height,
      east: viewport.east + dx * width,
      north: viewport.north + dy * height,
    }))
  );
}
```

### Prefetch priority

1. **Center tile** (current viewport): query immediately, await result
2. **Cardinal tiles** (N, S, E, W): queue with high priority
3. **Diagonal tiles** (NE, NW, SE, SW): queue with low priority

Only the active section is prefetched. Inactive sections load on scroll.

### Sliding window on pan

When the user pans, the grid shifts. Tiles entering the grid are prefetched. Tiles leaving the grid are dropped from in-memory cache (but persist in IndexedDB).

```
Pan east → drop 3 western tiles from memory → prefetch 3 new eastern tiles
Pan north → drop 3 southern tiles from memory → prefetch 3 new northern tiles
```

## Bbox quantization

To prevent cache thrashing on small pans, bboxes are snapped to a grid before being used as cache keys.

```typescript
function quantizeBbox(bbox: BBox, precision: number = 0.005): BBox {
  return {
    west: Math.floor(bbox.west / precision) * precision,
    south: Math.floor(bbox.south / precision) * precision,
    east: Math.ceil(bbox.east / precision) * precision,
    north: Math.ceil(bbox.north / precision) * precision,
  };
}
```

At precision `0.005` (~500m at mid-latitudes), this means:
- Small pans within the same grid cell → cache hit
- The query bbox is slightly larger than the viewport → more data, but fewer cache misses

## IndexedDB schema

```typescript
// Store: 'metrics'
interface CachedEntry {
  key: string;           // "2026-01-21.0:-0.160,51.490,-0.105,51.530:buildings" (Piccadilly)
  data: any;             // Query result (metrics object or network graph)
  sizeBytes: number;     // For LRU budget tracking
  accessedAt: number;    // Date.now(), updated on read
  createdAt: number;     // Date.now(), set once
  section: string;       // "buildings" | "network" | "amenities" | "networkGraph"
  version: string;       // Overture release version
}

// Store: 'meta'
interface CacheMeta {
  totalSize: number;
  entryCount: number;
  lastPruned: number;
}
```

### LRU eviction

```typescript
const MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_ENTRY_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

async function evictIfNeeded(db: IDBDatabase) {
  const meta = await getMeta(db);
  if (meta.totalSize < MAX_CACHE_SIZE) return;

  // Get all entries sorted by accessedAt ascending (oldest first)
  const entries = await getAllEntries(db);
  entries.sort((a, b) => a.accessedAt - b.accessedAt);

  let freed = 0;
  const target = MAX_CACHE_SIZE * 0.8; // Free down to 80%

  for (const entry of entries) {
    if (meta.totalSize - freed <= target) break;
    await deleteEntry(db, entry.key);
    freed += entry.sizeBytes;
  }
}
```

## Overture release management

Overture publishes data monthly. The release version is embedded in the S3 path and used as a cache prefix.

```typescript
// constants.ts
export const OVERTURE_VERSION = '2026-01-21.0';
export const OVERTURE_BASE = `s3://overturemaps-us-west-2/release/${OVERTURE_VERSION}/theme`;
```

When updating to a new release:
1. Change `OVERTURE_VERSION` constant
2. Deploy
3. All cache keys now have the new version prefix
4. Old cached data is never served (key mismatch)
5. On next startup, prune entries with old version prefix

This is a single-line update per month. No data migration, no re-processing.

## Future: pre-computed layers

For frequently accessed cities or computationally expensive metrics (fractal dimension, entropy), the architecture supports pre-computed data alongside live queries:

```typescript
async function getMetrics(bbox: BBox, section: string) {
  // 1. Check if pre-computed data exists for this area
  const precomputed = await fetchPrecomputed(bbox, section);
  if (precomputed) return precomputed;

  // 2. Fall back to live DuckDB query
  return await queryDuckDB(bbox, section);
}
```

Pre-computed data would be stored as static Parquet or JSON files on Cloudflare R2 (10GB free, zero egress). This is an optimization layer, not a requirement — the app works globally without it.

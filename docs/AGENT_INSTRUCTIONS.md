# Agent Instructions

> This document is for AI coding agents (Claude, Copilot, Cursor, etc.) working on chrono.city. Follow these instructions precisely.

## Project context

chrono.city is a zero-backend urban analytics platform. It runs entirely in the browser. There are no servers, no API keys, no environment variables. All data comes from Overture Maps' public S3 bucket (AWS Open Data Program, zero egress cost) via DuckDB-WASM.

## Critical rules

1. **Never add a backend or server-side code.** No Express, no API routes, no serverless functions, no database connections. Everything runs client-side.

2. **Never add API keys or environment variables.** The app must work immediately after `git clone && npm install && npm run dev`.

3. **PMTiles are for rendering only.** Never extract data from PMTiles for analytics. Never use `querySourceFeatures()` for metric computation. PMTiles → MapLibre → pixels. That's it.

4. **DuckDB-WASM is for analytics only.** Never use DuckDB results for map rendering. DuckDB → SQL → numbers in sidebar. That's it.

5. **Every DuckDB query result must be cacheable.** Key: `${OVERTURE_VERSION}:${quantized_bbox}:${section}`. Store in IndexedDB. Read from cache before querying S3.

6. **Sections are independent.** Each sidebar section (Urban Fabric, Street Network, Amenities, Walkability) loads its own data. Never create cross-section data dependencies.

7. **Don't load data the user hasn't scrolled to.** Only the active section queries S3. Inactive sections wait.

## Tech stack

- **Framework:** React 18+ with Vite
- **Map:** MapLibre GL JS (not Mapbox GL JS)
- **Tiles:** PMTiles (via pmtiles protocol)
- **Analytics:** DuckDB-WASM with httpfs + spatial extensions
- **Isochrone:** Custom Dijkstra in Web Worker + Turf.js concave hull
- **State:** Zustand (3 stores: map, section, cache)
- **Cache:** IndexedDB (persistent) + in-memory LRU (session)
- **Styling:** Tailwind CSS

## File structure

Follow this structure. Do not reorganise without discussion.

```
src/
├── components/
│   ├── Map/              # MapLibre instance, layers, controls
│   ├── Sidebar/          # Scroll container, sections, charts
│   └── Landing/          # Landing page
├── data/
│   ├── duckdb/           # DuckDB init, queries, worker
│   ├── isochrone/        # Dijkstra, graph, polygon
│   ├── cache/            # IndexedDB, memory LRU, bbox quantization
│   └── hooks/            # React hooks for data fetching
├── state/                # Zustand stores
├── utils/                # Pure functions, constants
└── App.tsx
```

## DuckDB query pattern

Every query follows this pattern. Do not deviate.

```typescript
const OVERTURE_VERSION = '2026-01-21.0';
const OVERTURE_BASE = `s3://overturemaps-us-west-2/release/${OVERTURE_VERSION}/theme`;

// All queries use bbox predicate pushdown on Overture's bbox column
const query = `
  SELECT [columns]
  FROM read_parquet(
    '${OVERTURE_BASE}=[theme]/type=[type]/*',
    hive_partitioning=1
  )
  WHERE bbox.xmin <= ${bbox.east}
    AND bbox.xmax >= ${bbox.west}
    AND bbox.ymin <= ${bbox.north}
    AND bbox.ymax >= ${bbox.south}
`;
```

The `bbox` column is a struct in Overture GeoParquet. The predicates enable row group pruning — DuckDB skips row groups whose bbox statistics don't intersect the query.

## Cache pattern

Every data fetch must check cache before querying S3.

```typescript
async function fetchSectionData(bbox: BBox, section: string) {
  const key = cacheKey(bbox, section);

  // 1. In-memory cache (fastest)
  const memCached = memoryCache.get(key);
  if (memCached) return memCached;

  // 2. IndexedDB cache (persistent)
  const idbCached = await indexedDBCache.get(key);
  if (idbCached) {
    memoryCache.set(key, idbCached);
    return idbCached;
  }

  // 3. S3 query (slowest, 1-3 seconds)
  const result = await duckdbQuery(bbox, section);
  memoryCache.set(key, result);
  await indexedDBCache.set(key, result);
  return result;
}
```

## Scroll-driven section activation

Use IntersectionObserver. When a section enters the viewport:

1. Update `section-store.activeSection`
2. Map layers: fade active section's layers to opacity 1.0, others to 0.15
3. Fire `useSectionQuery` for the section (checks cache first)
4. Render metrics and charts when data arrives

```typescript
// Threshold 0.3 means section is "active" when 30% visible
const observer = new IntersectionObserver(callback, { threshold: [0.3] });
```

## Isochrone implementation

The isochrone uses Overture's transportation topology:

```
1. Query segments (edges) + connectors (nodes) from S3 via DuckDB
2. Build adjacency list: connector_id → [{ target_connector_id, cost_seconds }]
3. Dijkstra from click point to all reachable nodes within time threshold
4. Collect reached node coordinates
5. Turf.js concave hull → polygon
6. Add polygon to map as GeoJSON source
7. Query buildings/POIs within polygon for metrics
```

The Dijkstra runs in a Web Worker. Do not run it on the main thread.

Walking speed: 5 km/h base, modified by road class:
- pedestrian/footway: 1.0×
- residential: 0.95×
- tertiary/secondary: 0.85×
- primary/trunk: 0.7×
- motorway: excluded

## Adding a new metric

1. Define it in `docs/METRICS.md` (name, formula, unit, data source, reference)
2. Add the DuckDB query or TypeScript formula in the appropriate section's query file
3. Add the metric to the section's sidebar component
4. Add a chart if applicable
5. Ensure the result is included in the cached data structure

## Adding a new section

1. Create section component in `src/components/Sidebar/sections/`
2. Create query file in `src/data/duckdb/queries/`
3. Add PMTiles layer in `src/components/Map/layers/`
4. Register section in the section store
5. Add IntersectionObserver target in sidebar container
6. Update cache schema if new data structure
7. Document in `docs/METRICS.md`

## Overture data gotchas

- **Geometry column** is WKB-encoded. Use `ST_GeomFromWKB(geometry)` in DuckDB.
- **bbox column** is a struct `{xmin, xmax, ymin, ymax}`. Use for predicate pushdown.
- **categories** in places theme is a struct with `primary` and `alternate` fields.
- **connectors** in transportation segments is an array of connector IDs referencing the connector type.
- **height** and **num_floors** in buildings are often NULL. Always handle missing data.
- **subtype** in transportation: filter on `subtype = 'road'` to exclude rail, water, etc.

## Performance requirements

- Landing page: <2s load
- First section data (cold): <3s
- Section data (cached): <50ms
- Map pan (prefetched area): <50ms
- Isochrone computation: <10ms (Dijkstra only)
- Total isochrone (cold): <4s
- Bundle size: monitor and minimise. DuckDB-WASM (~15MB) is the baseline.

## Do not

- Add a CSS framework other than Tailwind
- Add a routing library (react-router is fine, nothing heavier)
- Add a graph library for Dijkstra (it's 60 lines of TypeScript)
- Add Redux or MobX (Zustand only)
- Use `localStorage` for caching (use IndexedDB)
- Use `querySourceFeatures()` for analytics
- Create cross-section data dependencies
- Add server-side anything

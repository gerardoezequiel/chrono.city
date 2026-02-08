# Architecture

> This document is the source of truth for chrono.city's system design. It is intended for developers building features and AI agents generating code. Follow the patterns described here.

## Design philosophy

chrono.city is a **zero-backend urban analytics platform**. Every computation happens in the user's browser. There are no servers to maintain, no databases to provision, no API keys to manage. The "infrastructure" is:

- A static site host (Cloudflare Pages, free)
- Overture Maps' public S3 bucket (AWS Open Data, free)
- Overture Maps' PMTiles (hosted, free)

This is not a limitation — it is the core product decision. It means anyone can fork, deploy, and run chrono.city without cost or configuration.

## Two data pipelines

The application has two independent data pipelines that serve different purposes. They query the same geographic area but never depend on each other's output (except for the isochrone polygon, documented below).

### Pipeline 1: PMTiles → MapLibre → Pixels

**Purpose:** Render the map. Buildings, roads, POIs as visual layers.

```
Overture PMTiles (remote)
  → MapLibre GL JS (browser)
    → WebGL rendering
      → User sees buildings, roads, POIs on map
```

- Zoom-dependent: features simplify or disappear at low zoom
- Viewport-dependent: only loads tiles for visible area
- Handles styling, interaction (hover, click), layer visibility
- No analytics computed from this pipeline

### Pipeline 2: DuckDB-WASM → S3 GeoParquet → Metrics

**Purpose:** Compute analytics. Counts, areas, indices, scores.

```
Overture GeoParquet (S3 public bucket)
  → DuckDB-WASM httpfs (browser)
    → SQL with spatial predicates
      → Aggregated metrics in sidebar
```

- Zoom-independent: always queries the full dataset for the bbox
- Bbox-dependent: queries a geographic area, not a viewport
- Returns numbers, not geometries (except network graph for isochrones)
- Predicate pushdown: only downloads matching Parquet row groups

### Where they meet: the isochrone

The isochrone is the one feature where both pipelines interact:

```
DuckDB queries network graph (segments + connectors) from S3
  → Web Worker runs Dijkstra from user's click point
    → Produces isochrone polygon (GeoJSON)
      → MapLibre renders polygon on map (Pipeline 1)
      → DuckDB queries buildings/POIs within polygon (Pipeline 2)
        → Sidebar shows reachability metrics
```

The polygon is the bridge. It is computed once and consumed by both pipelines.

## Component architecture

```
src/
├── components/
│   ├── Map/
│   │   ├── MapContainer.tsx        # MapLibre instance, layer management
│   │   ├── layers/
│   │   │   ├── BuildingsLayer.tsx   # PMTiles buildings styling
│   │   │   ├── NetworkLayer.tsx     # PMTiles roads styling
│   │   │   ├── POILayer.tsx         # PMTiles POI styling
│   │   │   └── IsochroneLayer.tsx   # GeoJSON isochrone polygon
│   │   └── controls/
│   │       ├── NavigationControl.tsx
│   │       └── GeolocateControl.tsx
│   │
│   ├── Sidebar/
│   │   ├── SidebarContainer.tsx     # Scroll observer, section management
│   │   ├── sections/
│   │   │   ├── OverviewSection.tsx   # Project intro, no data loading
│   │   │   ├── BuildingsSection.tsx  # Urban fabric metrics + charts
│   │   │   ├── NetworkSection.tsx    # Street topology metrics + charts
│   │   │   ├── AmenitiesSection.tsx  # POI diversity, 15-min city
│   │   │   └── IsochroneSection.tsx  # Walkability, reachability
│   │   └── charts/
│   │       ├── DistributionChart.tsx
│   │       ├── CategoryBar.tsx
│   │       └── RadarChart.tsx
│   │
│   └── Landing/
│       └── LandingPage.tsx          # Initial view, project info, CTA
│
├── data/
│   ├── duckdb/
│   │   ├── init.ts                  # DuckDB-WASM initialisation
│   │   ├── worker.ts                # Web Worker for DuckDB queries
│   │   └── queries/
│   │       ├── buildings.sql.ts     # Building footprint queries
│   │       ├── transport.sql.ts     # Road network queries
│   │       ├── places.sql.ts        # POI queries
│   │       └── network-graph.sql.ts # Full graph for isochrone
│   │
│   ├── isochrone/
│   │   ├── dijkstra.worker.ts       # Dijkstra in Web Worker
│   │   ├── graph.ts                 # Graph construction from DuckDB results
│   │   └── polygon.ts              # Concave hull from reached nodes
│   │
│   ├── cache/
│   │   ├── indexeddb.ts             # Persistent cache layer
│   │   ├── memory.ts               # In-memory LRU cache
│   │   └── bbox-quantize.ts        # Bbox grid snapping for cache keys
│   │
│   └── hooks/
│       ├── useDuckDB.ts             # DuckDB instance management
│       ├── useSectionQuery.ts       # Scroll-triggered query hook
│       ├── useSpatialCache.ts       # Cache read/write hook
│       ├── usePrefetch.ts           # 3×3 grid prefetch logic
│       └── useIsochrone.ts          # Isochrone computation hook
│
├── state/
│   ├── map-store.ts                 # Zustand: viewport, bbox, active layers
│   ├── section-store.ts            # Zustand: active section, scroll position
│   └── cache-store.ts              # Zustand: cache status, stats
│
├── utils/
│   ├── bbox.ts                      # Bbox operations, grid generation
│   ├── metrics.ts                   # Metric computation from raw query results
│   └── constants.ts                 # S3 paths, Overture release version, thresholds
│
└── App.tsx                          # Root layout: Map + Sidebar
```

## Data flow: scroll-driven loading

When the user scrolls to a section, the following sequence executes:

```
1. IntersectionObserver fires for section entering viewport
2. section-store updates activeSection
3. Map reacts:
   a. Fade in relevant PMTiles layer
   b. Fade out other layers (to ~20% opacity, not hidden)
4. useSectionQuery hook fires:
   a. Check in-memory cache → hit? Return immediately
   b. Check IndexedDB cache → hit? Return, populate memory cache
   c. Cache miss → fire DuckDB query against S3
   d. Store result in memory cache + IndexedDB
5. Metrics compute from query results
6. Charts render in sidebar section
```

When the user scrolls back to a previous section, step 4a returns immediately. No network request.

## Data flow: map pan with prefetch

```
1. User pans map → 'moveend' event fires
2. New bbox computed from map.getBounds()
3. Bbox quantized to grid (prevents cache thrashing on small pans)
4. If quantized bbox === previous bbox → no action
5. If new bbox:
   a. Generate 3×3 grid of bboxes centered on current viewport
   b. For active section: query center tile immediately (await)
   c. For active section: queue surrounding 8 tiles (requestIdleCallback)
   d. For inactive sections: do nothing (will query when scrolled to)
6. When user pans to adjacent area:
   a. Drop tiles that left the 3×3 grid (memory only, IndexedDB persists)
   b. Prefetch new tiles entering the grid
```

## DuckDB-WASM configuration

```typescript
// init.ts
import * as duckdb from '@duckdb/duckdb-wasm';

const OVERTURE_BASE = 's3://overturemaps-us-west-2/release/2026-01-21.0/theme';

async function initDuckDB() {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const conn = await db.connect();

  // Load extensions
  await conn.query("INSTALL httpfs; LOAD httpfs;");
  await conn.query("INSTALL spatial; LOAD spatial;");
  await conn.query("SET s3_region='us-west-2';");

  return { db, conn };
}
```

## Query patterns

All DuckDB queries follow the same pattern: bbox filter with hive partitioning on Overture's S3 bucket.

```sql
-- Template: every query looks like this
SELECT [columns]
FROM read_parquet(
  's3://overturemaps-us-west-2/release/{version}/theme={theme}/type={type}/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= {east}
  AND bbox.xmax >= {west}
  AND bbox.ymin <= {north}
  AND bbox.ymax >= {south}
  -- Additional filters per query
```

The `bbox` column in Overture GeoParquet enables predicate pushdown — DuckDB reads Parquet row group statistics and skips groups that don't intersect the query bbox. Only matching row groups are downloaded via HTTP range requests.

## Isochrone computation

The isochrone uses Overture's transportation theme which provides a topological graph: segments (edges) reference connectors (nodes) by ID.

```
Step 1: DuckDB fetches segments + connectors for bbox (larger than viewport)
Step 2: Build adjacency list in TypeScript
Step 3: Dijkstra from origin point (walking speed ~5 km/h)
Step 4: Collect all reached connectors within time threshold
Step 5: Turf.js concave hull → isochrone polygon
Step 6: Add polygon to map + query metrics within polygon
```

Dijkstra runs in a Web Worker to avoid blocking the main thread. On ~2000 nodes (typical for a 1.5km radius), it completes in <10ms.

```typescript
// Simplified Dijkstra — ~60 lines, no library needed
interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  edges: { target: string; cost: number }[];
}

function dijkstra(
  graph: Map<string, GraphNode>,
  origin: string,
  maxCost: number // seconds
): Map<string, number> {
  const dist = new Map<string, number>();
  const pq: [number, string][] = [[0, origin]];
  dist.set(origin, 0);

  while (pq.length > 0) {
    pq.sort((a, b) => a[0] - b[0]);
    const [cost, node] = pq.shift()!;
    if (cost > maxCost) continue;
    if (cost > (dist.get(node) ?? Infinity)) continue;

    for (const edge of graph.get(node)?.edges ?? []) {
      const newCost = cost + edge.cost;
      if (newCost < (dist.get(edge.target) ?? Infinity)) {
        dist.set(edge.target, newCost);
        pq.push([newCost, edge.target]);
      }
    }
  }

  return dist; // node ID → travel time in seconds
}
```

## Cache architecture

### Three-layer cache

```
┌─────────────────────────────────────┐
│ Layer 1: In-memory LRU              │
│ ├── Fastest access (~0ms)           │
│ ├── Dies on tab close               │
│ ├── Max 50MB                        │
│ └── Key: version:bbox_hash:section  │
├─────────────────────────────────────┤
│ Layer 2: IndexedDB                  │
│ ├── Persistent across sessions      │
│ ├── Access ~5ms (async)             │
│ ├── Max 200MB (LRU eviction)        │
│ └── Same key structure              │
├─────────────────────────────────────┤
│ Layer 3: DuckDB internal            │
│ ├── Parquet metadata cache          │
│ ├── Row group statistics            │
│ ├── Managed by DuckDB-WASM          │
│ └── Makes repeat S3 queries faster  │
└─────────────────────────────────────┘
```

### Cache key design

```typescript
const OVERTURE_VERSION = '2026-01-21.0';

function cacheKey(bbox: BBox, section: string): string {
  const q = quantizeBbox(bbox, 0.005); // ~500m grid
  return `${OVERTURE_VERSION}:${q.west},${q.south},${q.east},${q.north}:${section}`;
}
```

Bbox quantization snaps to a ~500m grid so that small pans don't invalidate the cache. The Overture version prefix ensures stale data is never served after a monthly release.

### Cache invalidation

| Event | Action |
|-------|--------|
| Small pan (same grid cell) | Cache hit, no action |
| Large pan (new grid cell) | New query, old cells stay cached |
| Scroll to new section | Check cache for current bbox, query if miss |
| New Overture release | Old version keys never hit, pruned on startup |
| Storage over budget | LRU eviction of oldest-accessed entries |
| User clears cache | Delete all entries (settings UI) |

### What to cache vs. recompute

| Data | Cache? | Size | Reason |
|------|--------|------|--------|
| Building metrics | Yes | ~1 KB | Tiny, expensive to re-query |
| POI metrics | Yes | ~1 KB | Tiny, expensive to re-query |
| Network metrics | Yes | ~1 KB | Tiny, expensive to re-query |
| Network graph | Yes | ~2-5 MB | Largest payload, most expensive query |
| Isochrone polygon | No | — | Recompute: Dijkstra is <10ms, origin changes |
| Metrics within isochrone | No | — | Depends on dynamic polygon |

## State management

Zustand for global state. Three stores, minimal surface area.

```typescript
// map-store.ts
interface MapState {
  bbox: BBox | null;
  quantizedBbox: BBox | null;
  zoom: number;
  center: [number, number];
  activeLayers: Set<string>;
  setBbox: (bbox: BBox) => void;
  setActiveLayers: (layers: Set<string>) => void;
}

// section-store.ts
interface SectionState {
  activeSection: Section | null;
  scrollProgress: number; // 0-1 within current section
  setActiveSection: (section: Section) => void;
  setScrollProgress: (progress: number) => void;
}

// cache-store.ts
interface CacheState {
  memoryUsage: number;
  indexedDBUsage: number;
  cachedBboxes: Map<string, Set<string>>; // bbox → cached sections
  stats: { hits: number; misses: number; evictions: number };
}
```

## Performance targets

| Metric | Target | Mechanism |
|--------|--------|-----------|
| Landing page load | <2s | Static HTML, no data queries |
| First section metrics (cold) | 1-3s | DuckDB S3 query with predicate pushdown |
| First section metrics (cached) | <50ms | IndexedDB read |
| Section scroll transition | <100ms | In-memory cache hit |
| Map pan (within 3×3 grid) | <50ms | Prefetched data |
| Map pan (new area, cold) | 1-3s | New S3 query |
| Isochrone computation | <10ms | Dijkstra on ~2000 nodes |
| Isochrone total (cold) | 2-4s | Network graph fetch + Dijkstra + hull |
| Isochrone total (cached graph) | <100ms | Cached graph + Dijkstra + hull |

## Error handling

| Failure | Behaviour |
|---------|-----------|
| S3 unreachable | Show cached data if available, "offline" indicator |
| DuckDB query timeout | Retry once with smaller bbox, then show error |
| No data for area | Show "No Overture coverage" message (desert, ocean) |
| IndexedDB full | LRU evict, continue normally |
| Web Worker crash | Restart worker, retry computation |
| PMTiles unavailable | Map shows basemap only, analytics still work |

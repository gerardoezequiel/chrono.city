# Tech Decisions

> Why we chose what we chose. Every major technical decision with context, alternatives considered, and rationale. This document prevents re-litigating settled decisions and helps new contributors understand the reasoning.

## Decision: React + Vite (not Svelte, not Next.js)

**Chosen:** React 18+ with Vite

**Alternatives considered:**

| Option | Pros | Cons |
|--------|------|------|
| Svelte 5 + Vite | Better DX, smaller bundle, native reactivity | Smaller geospatial ecosystem, fewer contributors familiar with it |
| Next.js | SSR, API routes, huge ecosystem | SSR fights client-only architecture (DuckDB-WASM, MapLibre, Web Workers all need browser APIs) |
| Vue + Vite | Good middle ground | Geospatial ecosystem is React-heavy |
| Vanilla JS | Zero framework overhead | Unmaintainable at this complexity |

**Rationale:** The geospatial open-source ecosystem is React-dominant. deck.gl, Kepler.gl, react-map-gl, CARTO components, Vis.gl — all React. chrono.city is an open-source tool aimed at the spatial data science community. Contributors and users are more likely to know React. The geospatial libraries they might want to integrate are React-first.

Svelte would be a better developer experience for a solo developer, but chrono.city optimises for community adoption over personal preference.

Next.js was rejected because the entire application is client-side. SSR provides no value (no SEO for a map app, no server-side data fetching needed) and would actively conflict with DuckDB-WASM, MapLibre, and Web Workers — all of which require browser APIs.

**Status:** Settled. Revisit only if the project pivots to a server-rendered architecture.

---

## Decision: DuckDB-WASM (not parquet-wasm, not a backend)

**Chosen:** DuckDB-WASM (~15MB)

**Alternatives considered:**

| Option | Pros | Cons |
|--------|------|------|
| parquet-wasm (~2MB) | Smaller bundle | Cannot resolve S3 globs, no hive partitioning, no SQL, no spatial functions |
| PostGIS backend | Fast queries, scales with hardware | Server cost, deployment complexity, breaks zero-backend principle |
| querySourceFeatures() on PMTiles | No extra bundle | Zoom-dependent, viewport-limited, misses features at low zoom |
| Pre-computed static files | No query engine needed | Loses flexibility for arbitrary bbox/isochrone queries |

**Rationale:** chrono.city needs to query hive-partitioned GeoParquet across hundreds of files on S3 with bbox filtering and predicate pushdown. DuckDB-WASM is the only client-side tool that can do this. The 15MB bundle cost is justified because DuckDB-WASM replaces what would otherwise be an entire backend server.

parquet-wasm cannot resolve glob patterns or handle hive partitioning — it reads one file at a time. You'd need to know exact file paths, fetch each individually, and aggregate in JavaScript. That's rebuilding a query engine.

**Status:** Settled. The 15MB is the cost of zero-backend architecture.

---

## Decision: PMTiles for rendering, DuckDB for analytics

**Chosen:** Dual pipeline — PMTiles → MapLibre for visuals, DuckDB → S3 for metrics.

**Alternatives considered:**

| Option | Pros | Cons |
|--------|------|------|
| DuckDB for everything | Single data source | Cannot render vector tiles, would need to convert to GeoJSON for MapLibre |
| PMTiles for everything | Single data source | Zoom-dependent, viewport-limited, inaccurate for analytics |
| Backend API for analytics | Fast, scalable | Server cost, maintenance |

**Rationale:** PMTiles and DuckDB serve fundamentally different purposes:

- PMTiles: optimised for rendering — fast tile loading, zoom-dependent simplification, styled by MapLibre.
- DuckDB: optimised for analysis — full resolution data, spatial SQL, aggregation functions.

They query the same geographic area independently. The map shows what features look like. DuckDB counts what they are. This separation means the analytics are always accurate regardless of zoom level or viewport.

**Status:** Settled. This is a core architectural principle.

---

## Decision: Client-side Dijkstra (not Valhalla, not a routing service)

**Chosen:** Custom Dijkstra implementation (~60 lines TypeScript) in a Web Worker.

**Alternatives considered:**

| Option | Pros | Cons |
|--------|------|------|
| Valhalla WASM | Production routing engine | Only exposes route(), not isochrone(). Requires OSM tiles (~50-100MB). SharedArrayBuffer conflicts with CORS for PMTiles. ~8MB WASM. |
| Self-hosted Valhalla Docker | Full isochrone support | Introduces server dependency. Breaks zero-backend principle. |
| OSRM / GraphHopper API | Fast, accurate | External API dependency, rate limits, cost at scale |
| graphology / ngraph library | Mature graph algorithms | Designed for millions of nodes. Unnecessary bundle size for ~2000 node graphs. |
| Turf.js buffer (no routing) | Simple, fast | Not a real isochrone — circle doesn't reflect network accessibility |

**Rationale:** The isochrone computation is simpler than it appears. Overture's transportation data provides a topological graph (segments reference connectors by ID). Building an adjacency list and running Dijkstra on ~2000 nodes is trivial — it's ~60 lines of TypeScript and completes in <10ms.

No routing library is needed because we're not computing driving directions or turn-by-turn navigation. We're computing a travel time frontier — "which nodes are reachable within N minutes at walking speed." That's textbook Dijkstra.

Valhalla was specifically investigated and rejected because:
1. The WASM package only exposes `route()`, not `isochrone()`
2. It requires OSM tile data (not Overture), meaning a separate data pipeline
3. Its SharedArrayBuffer requirement conflicts with CORS headers needed for PMTiles
4. The bundle size (~8MB) plus tile data (~50-100MB) exceeds the entire rest of the application

**Status:** Settled. Revisit only if multi-modal routing (driving, transit) is added.

---

## Decision: IndexedDB for persistent cache (not localStorage, not Cache API)

**Chosen:** IndexedDB with LRU eviction.

**Alternatives considered:**

| Option | Pros | Cons |
|--------|------|------|
| localStorage | Simple API | 5-10MB limit, synchronous (blocks main thread), strings only |
| Cache API | Designed for HTTP caching | Awkward for structured data, harder to implement LRU |
| OPFS (Origin Private File System) | Large storage, fast | Newer API, limited browser support, file-based not query-based |
| No persistence | Simpler code | Every session starts cold, poor UX for returning users |

**Rationale:** IndexedDB supports structured data, has no practical size limit (browsers allow hundreds of MB), is asynchronous, and has universal browser support. It's the right tool for caching query results across sessions.

Network graph data (~2-5MB per city) is the primary storage driver. Metric aggregates are tiny (~1KB per section per bbox). A 200MB budget comfortably holds ~20 city-level network graphs plus thousands of metric tiles.

**Status:** Settled.

---

## Decision: Zustand for state management (not Redux, not React Context, not Jotai)

**Chosen:** Zustand (3 stores)

**Alternatives considered:**

| Option | Pros | Cons |
|--------|------|------|
| Redux Toolkit | Mature, DevTools | Boilerplate-heavy for 3 small stores |
| React Context + useReducer | No dependency | Re-renders on any state change, performance issues with map updates |
| Jotai | Atomic, minimal | Similar to Zustand but less familiar to geospatial community |
| MobX | Observable model | Heavier, proxy-based, less predictable |

**Rationale:** Three stores with minimal surface area. Zustand is ~1KB, has no boilerplate, works with React without providers, and supports subscriptions (important for MapLibre integration — the map needs to react to state changes without React re-renders).

**Status:** Settled.

---

## Decision: Scroll-driven progressive loading (not all-at-once)

**Chosen:** Each sidebar section loads its data layer independently on scroll.

**Alternative:** Load all data (buildings + transport + POIs + network) in parallel on first interaction.

**Rationale:** Progressive loading provides:
1. **Faster first paint.** One section loads in 1-2s instead of waiting for all four (4-8s).
2. **Storytelling.** Each section is a chapter that the user reads in sequence.
3. **Visual clarity.** One layer at a time on the map is easier to read than four overlapping layers.
4. **Bandwidth savings.** Users who only care about buildings don't download transport data.

The tradeoff is that scrolling to a new section has a 1-2s delay on first visit. This is mitigated by prefetching and IndexedDB caching.

**Status:** Settled. This is a core UX principle.

---

## Decision: 3×3 spatial prefetch (not viewport-only, not global preload)

**Chosen:** Prefetch data for a 3×3 grid of bboxes centered on the current viewport.

**Alternatives:**
- Viewport-only: simpler but every pan requires a new query (1-2s delay)
- Global preload: impossible with live S3 queries
- Radius-based: circular prefetch is harder to implement and cache

**Rationale:** The 3×3 grid means the user can pan one full viewport in any direction and hit cached data. This covers the vast majority of exploration patterns (small pans, neighborhood browsing). Only large jumps (fly to new city) require a cold query.

The grid approach also aligns naturally with bbox quantization — each grid cell is a quantized bbox, which maps directly to a cache key.

**Status:** Settled.

---

## Decision: Direct S3 queries (not pre-extracted city files)

**Chosen:** Query Overture's S3 bucket live at runtime.

**Alternative:** Pre-extract city-level GeoParquet files and host on Cloudflare R2.

**Rationale:** Live S3 queries maintain:
1. **Global coverage.** Any location on Earth, no pre-extraction needed.
2. **Zero maintenance.** No pipeline to run when Overture releases new data.
3. **Zero hosting cost.** No storage to pay for.
4. **Simplicity.** One data source, one query pattern.

The tradeoff is 1-3s latency on cold queries, which is acceptable for an analytics tool (not a routing app). The caching strategy (3×3 prefetch + IndexedDB) mitigates this for returning users and adjacent areas.

Pre-extraction remains a future optimization for high-traffic cities where faster cold load times justify the maintenance cost.

**Status:** Settled for v1. Revisit if latency becomes a user retention issue.

---

## Decision: Walking speed modifiers per road class (not uniform speed)

**Chosen:** Variable walking speed based on Overture road class.

**Rationale:** A pedestrian doesn't walk the same speed everywhere. Crossing a primary road involves waiting at traffic lights. Walking on a dedicated footway is unimpeded. Road class modifiers approximate these differences without needing actual traffic signal data.

The modifiers are:
- Pedestrian/footway: 1.0× (5 km/h)
- Residential: 0.95× (4.75 km/h)
- Tertiary/secondary: 0.85× (4.25 km/h)
- Primary/trunk: 0.7× (3.5 km/h)
- Motorway: excluded

These are estimates based on pedestrian studies. Users can adjust the base speed. Road class modifiers are fixed.

**Status:** Settled for v1. Future: add crossing time estimation from intersection geometry.

---

## Decision: Bbox quantization at ~500m grid (precision 0.005)

**Chosen:** Snap query bboxes to a 0.005-degree grid (~500m at mid-latitudes).

**Rationale:** Without quantization, every small pan generates a new cache key, causing constant cache misses. Quantizing to a ~500m grid means:
- Small pans (within 500m) → cache hit
- The query fetches slightly more data than the viewport (overscan) → acceptable bandwidth cost
- Cache keys are deterministic → same area always hits same cache

The 0.005 precision was chosen to balance cache hit rate against query overscan. Smaller precision = more misses. Larger precision = more unnecessary data per query.

**Status:** Settled. Tune the precision value based on real-world usage data.

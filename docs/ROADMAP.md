# Roadmap

> Phased development plan for chrono.city. Each phase is a deployable milestone that adds value independently.

## Philosophy

chrono.city is built nights and weekends. Every phase must:
1. Ship something usable — no phase is "infrastructure only"
2. Be achievable in 2-4 weeks of part-time work
3. Not depend on unfinished future phases
4. Be testable with a single city before scaling globally

## Phase 0: Foundation

**Goal:** Static landing page with basemap. Project scaffolding.

**Deliverables:**
- [ ] Vite + React project scaffolding
- [ ] MapLibre GL JS with dark basemap
- [ ] Landing page with project description, "Explore" CTA
- [ ] City search / geocoding (Nominatim, free)
- [ ] Fly-to animation when city selected
- [ ] URL routing (city name, lat/lon/zoom in URL)
- [ ] Basic responsive layout (map + sidebar shell)
- [ ] Deploy to Cloudflare Pages

**No data queries. No analytics. Just a beautiful basemap and a clear message about what the project will become.**

**Duration:** 1-2 weeks

---

## Phase 1: Urban Fabric

**Goal:** First scroll-driven section with real data.

**Deliverables:**
- [ ] DuckDB-WASM initialisation (httpfs + spatial extensions)
- [ ] Buildings query against S3 GeoParquet
- [ ] PMTiles buildings layer in MapLibre
- [ ] Sidebar: Urban Fabric section with building metrics
  - [ ] Building count
  - [ ] Total footprint area
  - [ ] Average footprint area
  - [ ] Building density
  - [ ] Footprint area distribution chart
- [ ] Scroll-driven section activation (IntersectionObserver)
- [ ] Layer fade on section change (buildings visible when section active)
- [ ] In-memory cache for query results
- [ ] Loading states (skeleton UI)

**This is the proof of concept. If this works well, everything else follows the same pattern.**

**Duration:** 2-3 weeks

---

## Phase 2: Caching & Prefetch

**Goal:** Make exploration feel instant.

**Deliverables:**
- [ ] Bbox quantization (500m grid)
- [ ] 3×3 spatial prefetch on map pan
- [ ] IndexedDB persistent cache
- [ ] LRU eviction (200MB budget)
- [ ] Cache hit/miss indicators (development mode)
- [ ] Overture version-based cache invalidation
- [ ] Sliding window on pan (drop old tiles, prefetch new)

**After this phase, scrolling and panning within a city should feel instant on second visit.**

**Duration:** 1-2 weeks

---

## Phase 3: Street Network

**Goal:** Second scroll-driven section with network topology metrics.

**Deliverables:**
- [ ] Transportation query against S3 GeoParquet
- [ ] PMTiles roads layer in MapLibre
- [ ] Sidebar: Street Network section
  - [ ] Segment count, total length
  - [ ] Road class distribution chart
  - [ ] Intersection density
  - [ ] Dead-end ratio
- [ ] Cross-fade between Urban Fabric and Street Network layers on scroll
- [ ] Cache integration for transport queries

**Duration:** 1-2 weeks

---

## Phase 4: Advanced Network Metrics

**Goal:** Deeper network analysis — connectivity indices, entropy.

**Deliverables:**
- [ ] Network graph construction from DuckDB results (adjacency list)
- [ ] Connectivity indices (alpha, beta, gamma)
- [ ] Street orientation entropy with rose diagram chart
- [ ] Block size estimation
- [ ] Graph analysis runs in TypeScript (not Web Worker yet — data is small)

**Duration:** 2-3 weeks

---

## Phase 5: Amenities

**Goal:** Third scroll-driven section with POI analytics.

**Deliverables:**
- [ ] Places query against S3 GeoParquet
- [ ] PMTiles POI layer in MapLibre
- [ ] Sidebar: Amenities section
  - [ ] POI count, density
  - [ ] Category distribution (treemap or bar chart)
  - [ ] Category diversity (Shannon entropy)
- [ ] Cross-fade between sections
- [ ] Cache integration

**Duration:** 1-2 weeks

---

## Phase 6: Isochrone

**Goal:** The flagship feature — client-side walkability analysis.

**Deliverables:**
- [ ] Network graph query (segments + connectors with geometry)
- [ ] Graph construction in TypeScript
- [ ] Dijkstra in Web Worker
- [ ] Concave hull polygon via Turf.js
- [ ] Isochrone rendered on map (5, 10, 15 minute bands)
- [ ] Click to set origin point
- [ ] Pedshed ratio computation
- [ ] Sidebar: Walkability section
  - [ ] Isochrone area
  - [ ] Pedshed ratio
  - [ ] Reachable buildings count
  - [ ] Reachable POIs (with category breakdown)
- [ ] Walking speed modifiers per road class
- [ ] Network graph cached in IndexedDB

**Duration:** 3-4 weeks

---

## Phase 7: 15-Minute City Score

**Goal:** Composite walkability metrics within isochrone.

**Deliverables:**
- [ ] Essential services category mapping (Overture categories → 15-min city categories)
- [ ] Service coverage checklist within isochrone
- [ ] 15-minute city score computation
- [ ] Composite walk score (weighted formula)
- [ ] Radar chart showing score components
- [ ] Score comparison across different origin points (history)

**Duration:** 1-2 weeks

---

## Phase 8: Polish & Performance

**Goal:** Production-ready UX.

**Deliverables:**
- [ ] Smooth animations (layer transitions, metric count-up, chart draw-in)
- [ ] Mobile responsive layout (bottom sheet sidebar)
- [ ] Keyboard navigation for accessibility
- [ ] Screen reader support
- [ ] Performance audit (bundle size, query latency, memory usage)
- [ ] Error handling (S3 unreachable, no data coverage, quota exceeded)
- [ ] "Cached cities" settings page with storage usage indicator
- [ ] Export metrics as CSV
- [ ] Share URL (current view state in URL)
- [ ] Open Graph meta tags for social sharing
- [ ] PWA manifest (installable on mobile)

**Duration:** 2-3 weeks

---

## Phase 9: Community & Content

**Goal:** Make the project visible and contributable.

**Deliverables:**
- [ ] Contributing guide
- [ ] Issue templates (bug report, feature request, new metric proposal)
- [ ] Architecture decision records (ADRs) for future decisions
- [ ] Blog post: "How chrono.city works" (architecture overview)
- [ ] Blog post: "Zero-backend urban analytics with DuckDB-WASM"
- [ ] Social media assets (screenshots, demo GIFs)
- [ ] Submit to: Overture Maps community, DuckDB community, MapLibre showcase
- [ ] Conference talk proposal (FOSS4G, State of the Map, Spatial Data Science Conference)

**Duration:** Ongoing

---

## Future phases (not scheduled)

### Land use analysis
- Overture `base/land_use` integration
- Land use mix index
- Building-land use cross analysis

### Fractal dimension
- Box-counting algorithm for street network
- Multi-scale complexity analysis
- Computationally expensive — consider pre-computation

### Comparative analysis
- Side-by-side comparison of two locations
- City-level benchmarking
- Global rankings

### Pre-computed data layer
- H3-indexed pre-computed metrics for high-traffic cities
- Wherobots batch processing pipeline
- Cloudflare R2 storage for pre-computed tiles
- Fallback to live S3 queries for uncovered areas

### Multi-modal isochrones
- Cycling isochrones (different speed, different road class weights)
- Public transit (requires GTFS data, not in Overture)
- Driving (lower priority — the project focuses on walkability)

### Data quality layer
- Coverage percentage per theme per area
- Confidence indicators on metrics
- Comparison with authoritative data sources where available

### Temporal analysis
- Compare Overture releases over time
- Urban change detection (new buildings, road changes)
- Requires storing snapshots of previous release data

# CLAUDE.md

> Project instructions for Claude Code. This file is auto-loaded at the start of every conversation.

## Project

**chrono.city** — zero-backend urban analytics platform powered by Overture Maps. Users explore buildings, streets, amenities, and walkability for any city on Earth, entirely in the browser. No servers, no API keys, no cost.

**Current status:** Phase 0 — Foundation. No `src/` code yet. Scaffolding not started.

## Critical Rules — NEVER Violate

1. **Zero backend.** No server-side code, no API routes, no serverless functions, no database connections.
2. **Zero API keys or env vars.** The app must work after `git clone && npm install && npm run dev`.
3. **PMTiles for rendering only.** Never use `querySourceFeatures()` for analytics. PMTiles → MapLibre → pixels.
4. **DuckDB-WASM for analytics only.** Never use DuckDB for map rendering. DuckDB → SQL → sidebar metrics.
5. **Cache everything.** Every DuckDB query result cached in IndexedDB. Key: `${OVERTURE_VERSION}:${quantized_bbox}:${section}`.
6. **Sections are independent.** Each sidebar section loads its own data. No cross-section dependencies.
7. **Progressive loading.** Only query data for the active (scrolled-to) section.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18+ with Vite |
| Map | MapLibre GL JS (NOT Mapbox) |
| Tiles | PMTiles via pmtiles protocol |
| Analytics | DuckDB-WASM with httpfs + spatial extensions |
| Isochrone | Custom Dijkstra (~60 lines) in Web Worker + Turf.js |
| State | Zustand (3 stores: map, section, cache) |
| Cache | IndexedDB (persistent) + in-memory LRU |
| Styling | Tailwind CSS |
| Hosting | Cloudflare Pages (static) |

## Project Structure

```
src/
├── app/                      # Application shell
│   ├── App.tsx               # Root: Map + Sidebar layout
│   ├── AppProviders.tsx      # Zustand + providers
│   └── routes.ts             # URL routing
├── features/                 # Feature modules (THE CORE)
│   ├── map/                  # MapLibre instance, layers, controls
│   ├── sections/             # Scroll-driven sidebar sections
│   ├── charts/               # Data visualisation components
│   ├── isochrone/            # Walkability analysis (Dijkstra worker)
│   ├── landing/              # Landing page
│   └── geocoder/             # City search
├── data/                     # Data layer
│   ├── duckdb/               # DuckDB-WASM init, SQL queries
│   ├── cache/                # IndexedDB, memory LRU, bbox quantize
│   └── hooks/                # useDuckDB, useSpatialCache, usePrefetch
├── state/                    # Zustand stores (map, section, cache)
├── shared/                   # Shared components, hooks, utils, types
│   ├── components/           # MetricCard, SkeletonMetric
│   ├── hooks/                # useDebounce, useThrottle
│   ├── utils/                # format, geometry, math
│   └── types/                # BBox, LngLat, metrics interfaces
├── config/                   # Constants, section/metric/chart registries
└── styles/                   # CSS reset, variables
```

See `docs/CODE_PATTERNS.md` for the full directory structure with every file.

## Key Patterns

**Feature modules:** Each feature in `features/` exports only through `index.ts`. Features CANNOT import from other features (except sections → charts). Communicate through `state/` stores.

**Three registries (single source of truth):**
- `config/sections.ts` — section definitions (layers, query function, which metrics/charts)
- `config/metrics.ts` — `MetricDescriptor[]` per section (key, label, unit, description). UI renders from descriptors — no per-metric JSX.
- `config/charts.ts` — `ChartBinding[]` per section (chart type, data key, options). Charts render from bindings — no per-chart wiring.

**Adding a metric = 2 steps:** Add property to metrics interface + add `MetricDescriptor` to array. No component changes.
**Adding a chart = 1 step:** Add `ChartBinding` to section's chart array. No component changes.

**Two-lane runtime:** Lane 1 (Interaction, 60fps) reads from Zustand + memory cache only. Lane 2 (Analytics, async) runs DuckDB queries and writes results to stores. No "estimated vs verified" — data is either cached (instant) or loading (skeleton).

**Scroll = throttle:** The scroll-driven narrative IS the loading strategy. User reads section text while DuckDB queries resolve in background. No spinners needed.

**Isochrone bridge:** The isochrone polygon is the ONE cross-section dependency. Walkability writes it to `map-store.isochronePolygon`. Amenities subscribes to it. No direct feature imports.

**Lazy metrics:** Expensive computations (fractal dimension, etc.) marked `lazy: true` in descriptor. Computed on user click, not on scroll.

**DuckDB query template:** All queries use bbox predicate pushdown on Overture's S3 bucket.
```sql
SELECT [columns]
FROM read_parquet('s3://overturemaps-us-west-2/release/{version}/theme={theme}/type={type}/*', hive_partitioning=1)
WHERE bbox.xmin <= {east} AND bbox.xmax >= {west} AND bbox.ymin <= {north} AND bbox.ymax >= {south}
```

**Cache key:** `${OVERTURE_VERSION}:${quantizedBbox}:${section}` — three-layer: memory LRU → IndexedDB → S3 query.

**Bbox quantization:** Snap to 0.005° grid (~500m). Small pans = cache hit.

**3×3 prefetch:** On map pan, generate 3×3 grid of bboxes. Center tile awaited, cardinal/diagonal tiles in `requestIdleCallback`.

**File size limits:** Components ≤150 lines, hooks ≤100, utils ≤80, SQL ≤60. Split if exceeded.

## Overture Data Gotchas

- Geometry column is WKB-encoded → use `ST_GeomFromWKB(geometry)`
- `bbox` column is a struct `{xmin, xmax, ymin, ymax}` → use for predicate pushdown
- `categories` in places is a struct with `primary` and `alternate` fields
- `connectors` in transport segments is an array of connector IDs
- `height` and `num_floors` are often NULL → always handle missing data
- Filter `subtype = 'road'` to exclude rail, water, etc.

## Do Not

- Add a CSS framework other than Tailwind
- Add Redux, MobX, or Jotai (Zustand only)
- Add a graph library for Dijkstra (it's 60 lines of TypeScript)
- Use `localStorage` for caching (use IndexedDB)
- Create cross-section data dependencies
- Add server-side anything
- Import one feature from another feature (except sections → charts)
- Put feature logic in `shared/` (shared = generic utilities only)
- Use `querySourceFeatures()` for analytics (zoom-dependent, inaccurate)
- Hardcode layer visibility outside the section registry
- Write per-metric JSX in sections (render from `MetricDescriptor` registry)
- Use magic strings for chart references (use `ChartBinding` objects)
- Import isochrone polygon directly across features (subscribe via `map-store`)
- Use `any` types (use `unknown` + narrowing)
- Build cache keys without the Overture version prefix

## Dependency Rules

```
app/ → features/* → shared/, data/, config/, state/
features/ CANNOT → other features/ (except sections → charts)
shared/ CANNOT → features/ or app/
data/ CANNOT → features/ or app/
Cross-feature communication → through state/ stores only
```

## Domain Contracts (key types)

```typescript
type DataState = 'idle' | 'loading' | 'loaded' | 'error';
interface BBox { west: number; south: number; east: number; north: number; }
interface MetricDescriptor { key: string; label: string; unit: MetricUnit; description: string; lazy?: boolean; }
interface ChartBinding { type: ChartType; dataKey: string; title: string; options?: ChartOptions; }
type SectionId = 'overview' | 'buildings' | 'network' | 'amenities' | 'walkability';
// Full type definitions: shared/types/metrics.ts, shared/types/geo.ts
// Full registries: config/metrics.ts, config/charts.ts, config/sections.ts
// See docs/CODE_PATTERNS.md §5 for registries, §9 for all metric interfaces
```

## Code Conventions

- TypeScript strict mode, no `any` types
- Named exports only (no default exports)
- Explicit return types on hooks and exported functions
- Components: `PascalCase.tsx`, Hooks: `useCamelCase.ts`, Utils: `camelCase.ts`
- SQL templates: `kebab-case.sql.ts`
- Conventional Commits: `feat:`, `fix:`, `docs:`, `perf:`, `refactor:`
- Tailwind for styling, CSS modules only when Tailwind can't express it
- No inline styles
- Dark theme by default
- Import order: React → external libs → shared/ → data/ → state/ → same feature → styles

## Performance Targets

| Metric | Target |
|--------|--------|
| Landing page load | <2s |
| First section data (cold) | <3s |
| Section data (cached) | <50ms |
| Map pan (prefetched) | <50ms |
| Isochrone computation | <10ms |
| Total isochrone (cold) | <4s |

## Detailed Documentation

Read these for full context before implementing features:

- `docs/CODE_PATTERNS.md` — **Start here.** Directory structure, dependency rules, section registry, domain contracts, file size limits, agent ownership boundaries, anti-patterns, quick reference for adding sections/metrics/charts
- `docs/ARCHITECTURE.md` — System design, dual pipeline, component tree, data flows, cache architecture
- `docs/DATA_STRATEGY.md` — Overture Maps integration, all SQL queries, prefetch, IndexedDB schema
- `docs/OVERTURE_DATA_REFERENCE.md` — **Complete Overture reference.** All themes, types, schemas, enum values, PMTiles URLs, S3 paths, DuckDB query templates, 15-minute city categories
- `docs/UX_DESIGN.md` — Scroll-driven UI, progressive loading, section cross-fade, responsive design
- `docs/METRICS_FRAMEWORK.md` — **21 core indicators, 4 chapter scores, master Chrono Score.** Formulas, normalization ranges, academic references. The definitive indicator catalog.
- `docs/METRICS.md` — Extended urban analytics definitions, formulas, data sources, academic references
- `docs/TECH_DECISIONS.md` — Why React, why DuckDB-WASM, why not X — with rationale
- `docs/ROADMAP.md` — 10-phase development plan
- `docs/CONTRIBUTING.md` — Code conventions, PR process, development tips
- `docs/archive/URBAN_EXPLORER_REFERENCE.md` — Historical reference from predecessor project

---

## Agent Orchestration

chrono.city is designed for efficient AI-assisted development using Claude Code's subagent capabilities. Tasks should be decomposed and delegated to parallel agents whenever possible.

### Orchestration Principles

1. **Decompose by domain.** The project has clear boundaries: Map, Sidebar, Data/DuckDB, Cache, State, Isochrone. Most work in one domain doesn't block another.
2. **Parallelize independent work.** If two tasks don't share files or state, run them as concurrent subagents.
3. **Research before implementing.** Use Explore agents to understand existing patterns before writing code. Use Plan agents for multi-file features.
4. **Keep subagents focused.** Each subagent should have a single, well-defined objective with clear acceptance criteria.

### Agent Team Structure

For a typical feature (e.g., "add the Street Network section"), decompose into:

```
Orchestrator (main Claude Code session)
├── Agent 1: Research — Explore existing section patterns (BuildingsSection, queries, hooks)
├── Agent 2: Research — Read Overture transport schema from docs/OVERTURE_DATA_REFERENCE.md + docs/METRICS.md
│
│   (after research completes)
│
├── Agent 3: Implement — DuckDB query (src/data/duckdb/queries/transport.sql.ts)
├── Agent 4: Implement — PMTiles layer (src/features/map/components/layers/NetworkLayer.tsx)
├── Agent 5: Implement — Sidebar section (src/features/sections/components/sections/NetworkSection.tsx)
│
│   (after implementation completes)
│
├── Agent 6: Integration — Register in config/sections.ts, wire into SidebarContainer
└── Agent 7: Validation — Run build, check types, verify no cross-feature imports
```

### When to Use Subagents

| Scenario | Agent Type | Why |
|----------|-----------|-----|
| Understand existing code patterns | `Explore` | Fast codebase search without polluting main context |
| Plan a multi-file feature | `Plan` | Identifies files, dependencies, and execution order |
| Implement isolated file | `Bash` or `general-purpose` | Parallel file creation without blocking other work |
| Run build/lint/typecheck | `Bash` | Validation in background while continuing other work |
| Research Overture data schema | `Explore` | Read docs and example queries without context bloat |

### When NOT to Use Subagents

- Single-file edits (just do it directly)
- Quick fixes or typos
- Tasks that require reading the result of a previous task (run sequentially)
- Anything requiring user input or confirmation

### Parallel Execution Patterns

**Pattern: Scaffold a new section (3 parallel agents)**
```
Agent A: Create query file     → src/data/duckdb/queries/{section}.sql.ts
Agent B: Create map layer      → src/features/map/components/layers/{Section}Layer.tsx
Agent C: Create sidebar section → src/features/sections/components/sections/{Section}Section.tsx
```
These three files are independent — they import from shared types but don't import each other. Run in parallel.

**Pattern: Add a new metric (2 sequential, then 2 parallel)**
```
Step 1: Research — Read docs/METRICS.md + docs/OVERTURE_DATA_REFERENCE.md
Step 2: Research — Explore existing metric implementation pattern
Step 3 (parallel):
  Agent A: Add DuckDB SQL to the section's query file
  Agent B: Add metric display to the section's sidebar component
```

**Pattern: Performance investigation (3 parallel agents)**
```
Agent A: Profile DuckDB query latency for buildings
Agent B: Profile DuckDB query latency for transport
Agent C: Analyze cache hit/miss rates in IndexedDB
```

### Subagent Communication Rules

1. **Shared context via files.** Subagents communicate through the codebase, not through messages. If Agent A creates a type, Agent B reads the file.
2. **No circular dependencies.** If Agent A's output is needed by Agent B, run them sequentially.
3. **Orchestrator owns integration.** Subagents create individual pieces. The main session wires them together (imports, store registration, observer hookup).
4. **Orchestrator validates.** After parallel agents complete, the main session runs build + typecheck to catch integration issues.

### Background Agents

Use `run_in_background: true` for:
- Long-running builds or type checks
- DuckDB query testing against S3 (can take 3-10s)
- Linting across the whole project

Check results with `Read` on the output file or `TaskOutput` when ready.

### Phase-Specific Agent Strategies

**Phase 0 (Foundation):** Mostly sequential — scaffolding must happen in order (Vite init → add MapLibre → add landing page → add routing). Limited parallelism.

**Phases 1-5 (Sections):** High parallelism — each section follows the same 3-file pattern (query + layer + sidebar). After the first section is built, subsequent sections can be scaffolded by parallel agents following the established pattern.

**Phase 6 (Isochrone):** Mixed — the Dijkstra worker, graph construction, and polygon generation are independent files that can be built in parallel. Integration with the map and sidebar is sequential.

**Phase 8 (Polish):** High parallelism — animations, responsive layout, accessibility, and error handling are all independent concerns.

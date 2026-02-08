# AGENTS.md

This file provides guidance to Warp AI agents working on chrono.city.

## Project Overview

**chrono.city** is a zero-backend urban analytics platform powered by Overture Maps. Users explore urban fabric, street networks, amenities, and walkability for any city on Earth — entirely in the browser, with no API keys, no servers, no cost.

## Critical Rules — NEVER Violate

1. **Zero backend.** No server-side code, no API routes, no serverless functions, no database connections. Everything runs client-side.
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
| Isochrone | Custom Dijkstra in Web Worker + Turf.js |
| State | Zustand (3 stores: map, section, cache) |
| Cache | IndexedDB (persistent) + in-memory LRU |
| Styling | Tailwind CSS |
| Hosting | Cloudflare Pages (static) |

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server at localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run typecheck # Run TypeScript type checking
```

## Project Structure

```
src/
├── components/
│   ├── Map/              # MapLibre instance, layers, controls
│   ├── Sidebar/          # Scroll-driven sections, charts
│   └── Landing/          # Landing page
├── data/
│   ├── duckdb/           # DuckDB init, worker, SQL queries
│   ├── isochrone/        # Dijkstra worker, graph, polygon
│   ├── cache/            # IndexedDB, memory LRU, bbox quantize
│   └── hooks/            # useDuckDB, useSectionQuery, usePrefetch
├── state/                # Zustand stores (map, section, cache)
├── utils/                # bbox ops, metrics, constants
└── App.tsx
```

## Key Patterns

### DuckDB Query Pattern
```sql
SELECT [columns]
FROM read_parquet(
  's3://overturemaps-us-west-2/release/{version}/theme={theme}/type={type}/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= {east}
  AND bbox.xmax >= {west}
  AND bbox.ymin <= {north}
  AND bbox.ymax >= {south}
```

### Cache Key Pattern
```typescript
const key = `${OVERTURE_VERSION}:${quantizedBbox}:${section}`;
```

### Bbox Quantization
```typescript
function quantizeBbox(bbox: BBox, precision = 0.005): BBox {
  return {
    west: Math.floor(bbox.west / precision) * precision,
    south: Math.floor(bbox.south / precision) * precision,
    east: Math.ceil(bbox.east / precision) * precision,
    north: Math.ceil(bbox.north / precision) * precision,
  };
}
```

## Data Sources

- **S3 GeoParquet:** `s3://overturemaps-us-west-2/release/2026-01-21.0/theme={theme}/type={type}/*`
- **PMTiles:** `https://overturemaps.org/pmtiles/{layer}.pmtiles`

## Documentation Reference

Read these files for detailed context:
- `ARCHITECTURE.md` — System design, data flow, component structure
- `DATA_STRATEGY.md` — Overture Maps integration, DuckDB queries, caching
- `UX_DESIGN.md` — Scroll-driven UI, progressive loading, interactions
- `METRICS.md` — Urban analytics definitions, formulas, data sources
- `TECH_DECISIONS.md` — Why React, why DuckDB, rationale for each choice
- `ROADMAP.md` — Phased development plan
- `CONTRIBUTING.md` — Code conventions, PR process
- `AGENT_INSTRUCTIONS.md` — Full AI agent instructions

## Current Status

**Phase 0: Foundation** — Project scaffolding not yet started.

Next steps:
1. Scaffold Vite + React + TypeScript
2. Add MapLibre GL JS with dark basemap
3. Create landing page with "Explore" CTA
4. Add city search (Nominatim geocoding)
5. Implement URL routing
6. Deploy to Cloudflare Pages

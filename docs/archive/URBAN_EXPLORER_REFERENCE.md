# Urban Explorer — Reference Archive

> This document preserves the key architecture decisions from the Urban Explorer project (predecessor to chrono.city). Kept for historical reference and context on what patterns were inherited vs. changed.

---

## What Urban Explorer Was

A multi-source urban analytics tool with marker-drag interaction:
- **Three data sources:** Analytics API (PostGIS), DuckDB WASM (S3), PMTiles (vector tiles)
- **Three-lane runtime:** Interaction lane (60fps), Estimated lane (fast local), Verified lane (API)
- **Radius-based queries** with `ST_DWithin`
- **Confidence model:** `estimated → verifying → verified → constrained → error`

## What Changed in chrono.city

| Urban Explorer | chrono.city | Why |
|---------------|-------------|-----|
| 3 data sources | 2 (PMTiles + DuckDB) | Zero backend eliminates API |
| PostGIS backend | None | No server cost, no maintenance |
| Marker drag interaction | Scroll-driven narrative | UX masks loading naturally |
| Radius queries | Bbox queries | Better cache alignment, predicate pushdown |
| React Query | Zustand + custom hooks | Simpler without server state |
| 3-lane runtime | 2-lane runtime | No verified lane needed |
| Confidence states | DataState (idle/loading/loaded/error) | Single authoritative source |
| `querySourceFeatures()` for fast metrics | Never used | Zoom-dependent = inaccurate |
| Coordinate-based cache keys | Bbox-quantized cache keys | Better spatial alignment |
| R-tree building cache | In-memory LRU + IndexedDB | Simpler, persistent |

## Key Docs From Urban Explorer

### API Contract (`/v1/analytics`)
- `GET /v1/analytics?lng={lng}&lat={lat}&radius_m={radius}&release={release}`
- Response: JSON with 17 metrics or Arrow IPC
- PostGIS backend with `ST_DWithin` + bbox prefilter

### Metrics Computed
- `buildingCount`, `footprintAreaSqM`, `avgHeightM`
- `poiCount`, `poiDiversityIndex`
- `streetSegmentCount`, `networkLengthM`, `landUseMixIndex`
- `intersectionCount`, `deadEndCount`, `intersectionDensity`
- `linkNodeRatio`, `connectedNodeRatio`
- `streetOrientationEntropy`, `streetOrientationOrder`

### Architecture Principles (inherited)
- Feature-based modules with `index.ts` public API
- Dependency rules (features can't import other features)
- Container/presenter component pattern
- File size limits (150 lines components, 100 lines hooks)
- Agent ownership boundaries per feature
- Section/chapter policy registry (single source of truth)
- Performance budgets as CI gates

### Architecture Principles (dropped)
- Analytics API backend
- Arrow IPC response format
- Three-lane confidence model
- `querySourceFeatures()` for fast metrics
- Server-side cache prewarming
- PostGIS bootstrap scripts

---

*Archived 2026-02-07. See docs/CODE_PATTERNS.md for the patterns that were carried forward.*

# chrono.city

**Open-source urban analytics platform powered by Overture Maps.**

chrono.city lets anyone explore the urban fabric of any city on Earth — buildings, streets, amenities, walkability — entirely in the browser, with zero backend infrastructure.

## What it does

Point at any place on the planet. chrono.city computes urban morphology metrics from raw building footprints, street network topology, and points of interest — all queried live from Overture Maps' public S3 bucket using DuckDB-WASM. No servers. No API keys. No cost.

The interface is a scroll-driven narrative. Each section — Urban Fabric, Street Network, Amenities, Walkability — loads its own data layer and analytics on demand. Pan the map, and a spatial prefetch cache keeps everything instant.

## Why it exists

Urban analytics has historically required GIS expertise, expensive software, and curated datasets. Overture Maps changed the data side — global coverage, open license, cloud-native formats. chrono.city closes the gap on the tooling side by making that data explorable by anyone with a browser.

## Architecture in one diagram

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ MapLibre  │  │ DuckDB    │  │ Web Worker   │ │
│  │ GL JS     │  │ WASM      │  │ (Dijkstra)   │ │
│  │           │  │           │  │              │ │
│  │ Renders   │  │ Queries   │  │ Computes     │ │
│  │ PMTiles   │  │ S3        │  │ isochrones   │ │
│  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘ │
│        │              │               │          │
│        ▼              ▼               ▼          │
│  ┌──────────────────────────────────────────┐   │
│  │         IndexedDB (persistent cache)      │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   Overture PMTiles     Overture GeoParquet
   (vector tiles)       (S3 public bucket)
```

## Core principles

1. **Zero backend.** The entire application is a static site. Cloudflare Pages, GitHub Pages, Netlify — deploy anywhere for free.
2. **Zero cost.** Overture's S3 data is on AWS Open Data Program. No egress fees. No API keys. No usage limits.
3. **Progressive disclosure.** Scroll-driven sections load data incrementally. The user never waits for everything at once.
4. **Spatial prefetch.** A 3×3 viewport grid loads data ahead of the user. Pan in any direction — the data is already there.
5. **Persistent intelligence.** IndexedDB caches results across sessions. The more you explore, the faster it gets.

## Tech stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React + Vite | UI, state management, build |
| Map | MapLibre GL JS | Vector tile rendering |
| Tiles | PMTiles | Serverless vector tiles (buildings, roads, POIs) |
| Analytics | DuckDB-WASM | SQL queries on S3 GeoParquet |
| Isochrones | Custom Dijkstra (Web Worker) | Client-side network analysis |
| Charts | TBD (Recharts / Observable Plot) | Metric visualisation |
| Caching | IndexedDB + in-memory LRU | Persistent + session cache |
| Hosting | Cloudflare Pages | Static site, free tier |

## Documentation

| Document | Audience | Description |
|----------|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Developers, AI agents | System design, data flow, component structure |
| [Data Strategy](docs/DATA_STRATEGY.md) | Developers, AI agents | Overture Maps integration, DuckDB queries, caching |
| [UX Design](docs/UX_DESIGN.md) | Developers, designers | Scroll-driven UI, progressive loading, interactions |
| [Metrics](docs/METRICS.md) | Researchers, developers | Urban analytics definitions, formulas, data sources |
| [Tech Decisions](docs/TECH_DECISIONS.md) | Developers, AI agents | Why React, why DuckDB, why not X — with rationale |
| [Roadmap](docs/ROADMAP.md) | Contributors, community | Phased development plan |
| [Contributing](docs/CONTRIBUTING.md) | Contributors | How to get involved |

## Quick start

```bash
git clone https://github.com/[org]/chrono.city
cd chrono.city
npm install
npm run dev
```

Opens at `http://localhost:5173`. No environment variables. No API keys. No database. It just works.

## License

MIT

## Credits

Built on [Overture Maps](https://overturemaps.org/) data, released under ODbL/CDLA Permissive 2.0. Powered by [DuckDB](https://duckdb.org/), [MapLibre](https://maplibre.org/), and [PMTiles](https://protomaps.com/docs/pmtiles).

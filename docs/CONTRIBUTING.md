# Contributing to chrono.city

Thanks for your interest in contributing to chrono.city. This guide will help you get started.

## Quick start

```bash
git clone https://github.com/[org]/chrono.city
cd chrono.city
npm install
npm run dev
```

The app opens at `http://localhost:5173`. No environment variables, API keys, or database setup required. If it doesn't work out of the box, that's a bug — please open an issue.

## How the project works

Before contributing, read these documents:

1. **[Architecture](ARCHITECTURE.md)** — system design, data flow, component structure
2. **[Data Strategy](DATA_STRATEGY.md)** — how we query Overture Maps from the browser
3. **[Tech Decisions](TECH_DECISIONS.md)** — why we chose what we chose (read this before proposing alternatives)
4. **[Metrics](METRICS.md)** — urban analytics definitions and formulas

## Ways to contribute

### Add a new metric

This is the most impactful contribution. Each metric needs:

1. **Definition** — What it measures, what it means, academic reference if applicable
2. **Data source** — Which Overture theme and type
3. **Query or formula** — DuckDB SQL and/or TypeScript computation
4. **Visualisation** — How it appears in the sidebar (number, chart, or both)

Start by opening an issue with your metric proposal. Include the definition and formula. We'll discuss where it fits in the section structure before you write code.

### Improve a visualisation

Charts and map styling can always be better. If you have design skills:

- Propose chart improvements with mockups
- Suggest better colour palettes or map styles
- Improve responsive layouts for different screen sizes
- Add animations or transitions

### Fix a bug

Check the issue tracker for bugs labelled `bug`. If you find a new bug:

1. Open an issue with steps to reproduce
2. Include the browser, OS, and city/location where the bug occurs
3. If it's a DuckDB query issue, include the bbox coordinates

### Improve documentation

Docs are first-class contributions. If something is unclear, fix it. If a metric definition is incomplete, improve it. If you used chrono.city in research, share your workflow.

### Optimise performance

Performance is critical for a client-side app. If you can:

- Reduce query latency
- Improve cache hit rates
- Reduce bundle size
- Speed up Dijkstra or graph construction
- Improve MapLibre rendering performance

...we want to hear about it. Open an issue describing the improvement and expected impact before submitting a PR.

## Code conventions

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` and narrow)
- Prefer `interface` over `type` for object shapes
- Use named exports, not default exports

### File naming

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- SQL query templates: `kebab-case.sql.ts`

### State management

- Zustand for global state (3 stores: map, section, cache)
- React Query for async data fetching
- Local state for component-specific UI state
- No prop drilling beyond 2 levels — use a store or context

### CSS

- Tailwind CSS for utility classes
- CSS modules for component-specific styles that can't be expressed in Tailwind
- No inline styles
- Dark theme by default

### Commits

- Conventional Commits format: `feat:`, `fix:`, `docs:`, `perf:`, `refactor:`
- Keep commits atomic — one logical change per commit
- Reference issue numbers: `feat: add intersection density metric (#42)`

## Pull request process

1. Fork the repo and create a feature branch from `main`
2. Write your code following the conventions above
3. Test with at least 3 different cities (different regions, different densities)
4. Update documentation if you changed behaviour or added features
5. Open a PR with a clear description of what and why

## Architecture principles (do not violate)

These are non-negotiable. If your contribution conflicts with any of these, it will not be merged.

1. **Zero backend.** No server-side code, no API endpoints, no database connections.
2. **Zero cost to operate.** No paid services required to run the app.
3. **PMTiles for rendering, DuckDB for analytics.** Don't mix the pipelines.
4. **Scroll-driven sections.** Each section loads independently. Don't create cross-section dependencies.
5. **Cache everything.** Every DuckDB query result must be cacheable in IndexedDB.
6. **Progressive disclosure.** Don't load data the user hasn't scrolled to yet.

## Development tips

### Testing DuckDB queries

You can test queries against Overture's S3 bucket using DuckDB CLI (desktop):

```bash
duckdb
> INSTALL httpfs; LOAD httpfs;
> INSTALL spatial; LOAD spatial;
> SET s3_region='us-west-2';
> SELECT COUNT(*) FROM read_parquet('s3://overturemaps-us-west-2/release/2026-01-21.0/theme=buildings/type=building/*', hive_partitioning=1) WHERE bbox.xmin <= -0.1 AND bbox.xmax >= -0.15 AND bbox.ymin <= 51.5 AND bbox.ymax >= 51.53;
```

This is faster than iterating in the browser and lets you validate queries before integrating them.

### Inspecting cached data

Open browser DevTools → Application → IndexedDB → chrono.city to see cached entries, their sizes, and access timestamps.

### Debugging query performance

DuckDB-WASM supports `EXPLAIN ANALYZE`:

```sql
EXPLAIN ANALYZE SELECT ... FROM read_parquet(...) WHERE ...
```

This shows which row groups were scanned vs. skipped, helping you optimise predicates.

## Community

- Issues: for bugs, feature requests, and metric proposals
- Discussions: for questions, ideas, and general conversation
- Pull Requests: for code contributions

We're building this in public. Every decision is documented. Every contribution is welcome.

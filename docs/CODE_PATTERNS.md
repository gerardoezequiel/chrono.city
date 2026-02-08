# Code Patterns

> Architecture patterns, coding conventions, and agent collaboration rules for chrono.city. Inherited from Urban Explorer, adapted for zero-backend architecture.

---

## 1. Core Principles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRINCIPLES                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Feature-based modules     — Each section is self-contained           │
│ 2. Single responsibility     — One file = one concern                   │
│ 3. Explicit dependencies     — No magic imports, clear contracts        │
│ 4. Composition over config   — Small pieces that compose                │
│ 5. Agent-safe boundaries     — Clear ownership, minimal overlap         │
│ 6. Scroll-driven loading     — UX pace controls data loading pace       │
│ 7. Two data lanes only       — PMTiles for pixels, DuckDB for numbers   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
src/
├── app/                              # Application shell
│   ├── App.tsx                       # Root: Map + Sidebar layout
│   ├── AppProviders.tsx              # Zustand + any context providers
│   └── routes.ts                     # URL routing (city, section, coords)
│
├── features/                         # Feature modules (THE CORE)
│   ├── map/                          # Map feature
│   │   ├── components/
│   │   │   ├── MapContainer.tsx      # MapLibre instance
│   │   │   ├── MapControls.tsx       # Navigation, geolocate
│   │   │   └── layers/
│   │   │       ├── BuildingsLayer.tsx
│   │   │       ├── NetworkLayer.tsx
│   │   │       ├── POILayer.tsx
│   │   │       └── IsochroneLayer.tsx
│   │   ├── hooks/
│   │   │   ├── useMapState.ts        # Viewport, bbox, zoom
│   │   │   └── useLayerTransitions.ts # Cross-fade on section scroll
│   │   ├── utils/
│   │   │   └── mapStyle.ts           # Dark basemap style
│   │   ├── types.ts
│   │   └── index.ts                  # Public API
│   │
│   ├── sections/                     # Scroll-driven sections
│   │   ├── components/
│   │   │   ├── SidebarContainer.tsx   # Scroll observer, section management
│   │   │   ├── SectionShell.tsx       # Shared section layout (title, skeleton, metrics)
│   │   │   └── sections/
│   │   │       ├── OverviewSection.tsx
│   │   │       ├── BuildingsSection.tsx
│   │   │       ├── NetworkSection.tsx
│   │   │       ├── AmenitiesSection.tsx
│   │   │       └── WalkabilitySection.tsx
│   │   ├── hooks/
│   │   │   ├── useActiveSection.ts    # IntersectionObserver
│   │   │   └── useSectionQuery.ts     # Scroll-triggered data fetch
│   │   ├── registry.ts               # Section policy registry (single source of truth)
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── charts/                       # Data visualisation feature
│   │   ├── components/
│   │   │   ├── DistributionChart.tsx
│   │   │   ├── CategoryBar.tsx
│   │   │   ├── RadarChart.tsx
│   │   │   └── OrientationRose.tsx
│   │   ├── hooks/
│   │   │   └── useChartData.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── isochrone/                    # Walkability analysis feature
│   │   ├── components/
│   │   │   └── IsochroneControls.tsx  # Click-to-set origin, time selector
│   │   ├── hooks/
│   │   │   └── useIsochrone.ts        # Orchestrates graph + dijkstra + hull
│   │   ├── workers/
│   │   │   └── dijkstra.worker.ts     # Web Worker for graph traversal
│   │   ├── utils/
│   │   │   ├── graph.ts              # Build adjacency list from DuckDB results
│   │   │   └── polygon.ts           # Turf.js concave hull
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── landing/                      # Landing page feature
│   │   ├── components/
│   │   │   └── LandingPage.tsx
│   │   └── index.ts
│   │
│   └── geocoder/                     # City search feature
│       ├── components/
│       │   └── GeocoderInput.tsx
│       ├── hooks/
│       │   └── useGeocoder.ts         # Nominatim free geocoding
│       └── index.ts
│
├── data/                             # Data layer (DuckDB, caching)
│   ├── duckdb/
│   │   ├── init.ts                   # DuckDB-WASM setup (httpfs + spatial)
│   │   ├── worker.ts                 # Optional: DuckDB in Web Worker
│   │   └── queries/
│   │       ├── buildings.sql.ts
│   │       ├── transport.sql.ts
│   │       ├── places.sql.ts
│   │       ├── land-use.sql.ts
│   │       └── network-graph.sql.ts
│   ├── cache/
│   │   ├── indexeddb.ts              # Persistent cache (IndexedDB)
│   │   ├── memory.ts                 # In-memory LRU cache
│   │   └── bbox-quantize.ts          # 500m grid snap for cache keys
│   ├── hooks/
│   │   ├── useDuckDB.ts              # DuckDB instance management
│   │   ├── useSpatialCache.ts        # Cache read/write
│   │   └── usePrefetch.ts            # 3×3 grid prefetch
│   └── index.ts
│
├── state/                            # Zustand stores
│   ├── map-store.ts                  # Viewport, bbox, active layers
│   ├── section-store.ts              # Active section, scroll progress
│   └── cache-store.ts                # Cache stats, memory usage
│
├── shared/                           # Shared utilities (no business logic)
│   ├── components/
│   │   ├── MetricCard.tsx            # Reusable metric display
│   │   ├── SkeletonMetric.tsx        # Loading placeholder
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   ├── useThrottle.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── format.ts                 # Number formatting
│   │   ├── geometry.ts               # Bbox operations
│   │   ├── math.ts                   # Shannon entropy, etc.
│   │   └── index.ts
│   └── types/
│       ├── geo.ts                    # BBox, LngLat, Polygon
│       ├── metrics.ts                # MetricValue, SectionMetrics
│       └── index.ts
│
├── config/
│   ├── constants.ts                  # Overture release, S3 paths, PMTiles URLs
│   ├── sections.ts                   # Section registry (single source of truth)
│   ├── metrics.ts                    # Metric descriptor registry
│   ├── charts.ts                     # Chart config registry
│   └── index.ts
│
└── styles/
    ├── reset.css
    ├── variables.css                 # CSS custom properties
    └── index.css
```

---

## 3. Feature Module Contract

Every feature exports through `index.ts` only:

```typescript
// features/sections/index.ts
export { SidebarContainer } from './components/SidebarContainer';
export { SectionShell } from './components/SectionShell';
export { SectionRenderer } from './components/SectionRenderer';
export { MetricsGrid } from './components/MetricsGrid';
export { useActiveSection } from './hooks/useActiveSection';
export { useSectionQuery } from './hooks/useSectionQuery';
export type { SectionId } from './types';

// features/charts/index.ts
export { ChartRenderer } from './components/ChartRenderer';
export { DistributionChart } from './components/DistributionChart';
export { CategoryBar } from './components/CategoryBar';
export { RadarChart } from './components/RadarChart';
export { OrientationRose } from './components/OrientationRose';
export type { ChartProps } from './types';

// DO NOT export internal utilities, helpers, or implementation details
```

---

## 4. Dependency Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY RULES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   app/  ──────►  features/*  ──────►  shared/                   │
│                       │                   │                      │
│                       │                   ▼                      │
│                       └──────────►    data/                     │
│                                          │                      │
│                                          ▼                      │
│                                      config/                    │
│                                                                  │
│   RULES:                                                        │
│   • features/ can import from shared/, data/, config/, state/   │
│   • features/ CANNOT import from other features/                │
│   • shared/ CANNOT import from features/ or app/                │
│   • data/ CANNOT import from features/ or app/                  │
│   • If two features need to communicate → use state/ stores     │
│                                                                  │
│   EXCEPTION:                                                    │
│   • features/sections/ can import section components             │
│     from features/charts/ (charts render inside sections)       │
│     This is the ONLY cross-feature import allowed.              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Three Registries (Single Source of Truth)

All section, metric, and chart behaviour is defined declaratively in `config/`. No hardcoded display logic in components.

### 5a. Section Registry

```typescript
// config/sections.ts
interface SectionConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  layers: {
    show: string[];        // PMTiles layer IDs to activate
    activeOpacity: number; // 1.0
    inactiveOpacity: number; // 0.15
  };
  query: (bbox: BBox) => Promise<T>;
  metrics: MetricDescriptor[];  // which metrics to display (from metric registry)
  charts: ChartBinding[];       // which charts to render (from chart registry)
}

export const SECTION_REGISTRY: SectionConfig[] = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'City context and location',
    layers: { show: [], activeOpacity: 1, inactiveOpacity: 1 },
    query: async () => ({}),
    metrics: [],
    charts: [],
  },
  {
    id: 'buildings',
    name: 'Urban Fabric',
    description: 'Building footprints, density, morphology',
    layers: { show: ['buildings-fill', 'buildings-line'], activeOpacity: 1, inactiveOpacity: 0.15 },
    query: queryBuildings,
    metrics: BUILDING_METRICS,    // from config/metrics.ts
    charts: BUILDING_CHARTS,      // from config/charts.ts
  },
  // ... network, amenities, walkability
];
```

### 5b. Metric Descriptor Registry

Every metric has a descriptor. The UI renders metrics from descriptors — no per-metric JSX.

```typescript
// config/metrics.ts
interface MetricDescriptor {
  key: string;                    // must match a property in the section's metrics interface
  label: string;                  // display name: "Building Count"
  unit: MetricUnit;               // determines formatting
  description: string;            // tooltip / explanation
  precision?: number;             // decimal places (default: 0 for integer, 1 for ratio)
  lazy?: boolean;                 // expensive metric — compute on user click, not on scroll
  requiresIsochrone?: boolean;    // only computable when isochrone polygon exists
}

type MetricUnit =
  | 'integer'     // 1,234
  | 'decimal'     // 1,234.5
  | 'ratio'       // 0.73 (displayed as-is or as percentage)
  | 'percentage'  // 73%
  | 'm2'          // 1,234 m²
  | 'ha'          // 12.3 ha
  | 'km'          // 1.2 km
  | 'per_km2'     // 145 / km²
  | 'bits'        // 3.2 bits
  | 'score'       // 0-100

// Group by section for clean imports:
export const BUILDING_METRICS: MetricDescriptor[] = [
  { key: 'buildingCount',         label: 'Buildings',           unit: 'integer',    description: 'Total building footprints in area' },
  { key: 'totalFootprintAreaM2',  label: 'Total Footprint',     unit: 'ha',         description: 'Sum of all building ground-floor areas' },
  { key: 'buildingDensity',       label: 'Ground Coverage',     unit: 'percentage', description: 'Ratio of footprint area to boundary area (GSI)' },
  { key: 'avgHeightM',            label: 'Avg Height',          unit: 'decimal',    description: 'Mean building height (where available)', precision: 1 },
  { key: 'heightCoverage',        label: 'Height Data',         unit: 'percentage', description: 'Proportion of buildings with height data' },
];

export const NETWORK_METRICS: MetricDescriptor[] = [
  { key: 'segmentCount',              label: 'Road Segments',       unit: 'integer',    description: 'Total road segments in area' },
  { key: 'totalLengthM',              label: 'Network Length',      unit: 'km',         description: 'Total road network length' },
  { key: 'intersectionDensity',       label: 'Intersection Density',unit: 'per_km2',    description: 'Intersections per km² (3+ way)' },
  { key: 'connectedNodeRatio',        label: 'Connectivity',        unit: 'ratio',      description: 'Proportion of non-dead-end nodes', precision: 2 },
  { key: 'streetOrientationOrder',    label: 'Grid Order',          unit: 'ratio',      description: '1 = perfect grid, 0 = random orientation', precision: 2 },
];

export const AMENITY_METRICS: MetricDescriptor[] = [
  { key: 'poiCount',              label: 'Places',              unit: 'integer',    description: 'Total points of interest' },
  { key: 'poiDensity',            label: 'POI Density',         unit: 'per_km2',    description: 'Places per km²' },
  { key: 'categoryDiversity',     label: 'Diversity',           unit: 'ratio',      description: 'Shannon entropy of categories (0-1)', precision: 2 },
  { key: 'fifteenMinScore',       label: '15-min Score',        unit: 'percentage', description: 'Essential services within 15-min walk', requiresIsochrone: true },
];

export const WALKABILITY_METRICS: MetricDescriptor[] = [
  { key: 'compositeWalkScore',    label: 'Walk Score',          unit: 'score',      description: 'Composite walkability (0-100)' },
  { key: 'reachableBuildings',    label: 'Reachable Buildings', unit: 'integer',    description: 'Buildings within isochrone' },
  { key: 'reachablePOIs',         label: 'Reachable Places',    unit: 'integer',    description: 'POIs within isochrone' },
];
```

**How it's consumed in the UI:**

```typescript
// SectionShell renders metrics declaratively from descriptors:
function MetricsGrid({ descriptors, data }: { descriptors: MetricDescriptor[]; data: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {descriptors
        .filter(d => !d.requiresIsochrone || isochroneExists)
        .filter(d => !d.lazy || userRequestedLazy)
        .map(d => (
          <MetricCard
            key={d.key}
            label={d.label}
            value={data[d.key] as number}
            unit={d.unit}
            description={d.description}
            precision={d.precision}
          />
        ))}
    </div>
  );
}
```

Adding a metric = add one line to the descriptor array + add the property to the TypeScript interface. No JSX changes needed.

### 5c. Chart Binding Registry

Charts are bound to data fields declaratively. No per-section chart prop wiring.

```typescript
// config/charts.ts
interface ChartBinding {
  type: ChartType;             // which chart component to render
  dataKey: string;             // which field in the metrics object feeds this chart
  title: string;               // chart heading
  options?: ChartOptions;      // chart-specific configuration
}

type ChartType = 'distribution' | 'bar' | 'radar' | 'rose' | 'treemap' | 'checklist';

interface ChartOptions {
  bins?: number;               // for distribution charts
  logScale?: boolean;          // for power-law distributions
  maxCategories?: number;      // for bar/treemap — show top N
  unit?: MetricUnit;           // axis label formatting
  colorScheme?: string;        // named palette
}

// Group by section:
export const BUILDING_CHARTS: ChartBinding[] = [
  {
    type: 'distribution',
    dataKey: 'footprintAreaDistribution',
    title: 'Footprint Size Distribution',
    options: { logScale: true, unit: 'm2', bins: 20 },
  },
  {
    type: 'distribution',
    dataKey: 'heightDistribution',
    title: 'Height Distribution',
    options: { unit: 'decimal', bins: 15 },
  },
];

export const NETWORK_CHARTS: ChartBinding[] = [
  {
    type: 'bar',
    dataKey: 'roadClassDistribution',
    title: 'Road Classes',
    options: { maxCategories: 10 },
  },
  {
    type: 'rose',
    dataKey: 'streetOrientationBins',
    title: 'Street Orientations',
  },
];

export const AMENITY_CHARTS: ChartBinding[] = [
  {
    type: 'treemap',
    dataKey: 'categoryDistribution',
    title: 'Place Categories',
    options: { maxCategories: 15 },
  },
  {
    type: 'checklist',
    dataKey: 'essentialServices',
    title: '15-Minute City Services',
  },
];
```

**How charts render from bindings:**

```typescript
// features/charts/components/ChartRenderer.tsx
function ChartRenderer({ binding, data }: { binding: ChartBinding; data: Record<string, unknown> }) {
  const chartData = data[binding.dataKey];
  if (!chartData) return null;

  const Component = CHART_COMPONENTS[binding.type]; // maps type → React component
  return (
    <div>
      <h3>{binding.title}</h3>
      <Component data={chartData} options={binding.options} />
    </div>
  );
}

const CHART_COMPONENTS: Record<ChartType, React.ComponentType<ChartProps>> = {
  distribution: DistributionChart,
  bar: CategoryBar,
  radar: RadarChart,
  rose: OrientationRose,
  treemap: CategoryTreemap,
  checklist: ServiceChecklist,
};
```

Adding a chart = add one `ChartBinding` object to the section's chart array. No wiring in section components.

This registry system controls: map layer toggling, sidebar rendering, metric display, chart rendering, data fetching scope, and cache keys.

---

## 6. Two-Lane Runtime Architecture

chrono.city eliminates Urban Explorer's three-lane complexity. Two lanes only:

```
┌─────────────────────────────────────────────────────────────────┐
│              LANE 1: INTERACTION (frame-critical, 60fps)        │
├─────────────────────────────────────────────────────────────────┤
│ • Map pan/zoom                                                   │
│ • Layer cross-fade on scroll                                     │
│ • Skeleton UI display                                            │
│ • Metric count-up animation                                      │
│ • NO data fetching, NO computation                               │
│ • Reads from: Zustand stores, in-memory cache only               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              LANE 2: ANALYTICS (authoritative, async)           │
├─────────────────────────────────────────────────────────────────┤
│ • DuckDB-WASM queries against S3                                 │
│ • Triggered by: section scroll, map pan (debounced)              │
│ • Three-layer cache: memory → IndexedDB → S3 query              │
│ • Results written to: Zustand store → triggers UI update         │
│ • Dijkstra in Web Worker (isochrone only)                        │
│ • 3×3 prefetch in requestIdleCallback                            │
└─────────────────────────────────────────────────────────────────┘
```

**No "estimated" vs "verified" confidence states.** DuckDB is the single authoritative source. Data is either cached (instant) or loading (skeleton UI).

### Loading State Model

```typescript
type DataState = 'idle' | 'loading' | 'loaded' | 'error';

// NOT this (Urban Explorer pattern — too complex):
// type Confidence = 'estimated' | 'verifying' | 'verified' | 'constrained' | 'error';
```

---

## 7. How UX Masks Loading

The scroll-driven narrative is the loading strategy. No artificial delays, no spinners:

```
┌──────────────────────────────────────────────────────────────┐
│                  THE SCROLL = THE THROTTLE                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User scrolls to section                                   │
│     → Skeleton UI shows instantly (0ms)                       │
│     → DuckDB query fires in background (1-2s)                 │
│     → User is READING section title + description             │
│     → Data arrives → metrics count-up animate in              │
│                                                               │
│  2. While user reads metrics and charts                       │
│     → 3×3 prefetch loads adjacent map tiles (background)      │
│     → Next section's data may already be prefetching          │
│                                                               │
│  3. User pans map                                             │
│     → If within 3×3 grid: instant from memory cache (0ms)    │
│     → If outside grid: new query (1-2s) + new prefetch        │
│                                                               │
│  4. User scrolls back to previous section                     │
│     → In-memory cache hit: instant (0ms)                      │
│     → No skeleton, no loading, no delay                       │
│                                                               │
│  5. User returns tomorrow                                     │
│     → IndexedDB cache: everything loads in <50ms              │
│     → Feels like a native app                                 │
│                                                               │
│  RESULT: The user never "waits". Reading IS waiting.          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Caching Architecture

### Three-Layer Cache

```
┌─────────────────────────────────────┐
│ Layer 1: In-memory LRU              │
│ ├── Access: ~0ms (synchronous)      │
│ ├── Lifetime: tab session           │
│ ├── Budget: 50MB                    │
│ ├── Eviction: LRU by access time    │
│ └── Key: version:bbox_hash:section  │
├─────────────────────────────────────┤
│ Layer 2: IndexedDB                  │
│ ├── Access: ~5ms (async)            │
│ ├── Lifetime: persistent            │
│ ├── Budget: 200MB (LRU eviction)    │
│ ├── Eviction: oldest-accessed first │
│ └── Same key structure              │
├─────────────────────────────────────┤
│ Layer 3: DuckDB internal            │
│ ├── Parquet metadata cache          │
│ ├── Row group statistics            │
│ ├── Managed by DuckDB-WASM         │
│ └── Makes repeat S3 queries faster  │
└─────────────────────────────────────┘
```

### Cache Key Design

```typescript
const OVERTURE_RELEASE = '2026-01-21.0';

function cacheKey(bbox: BBox, section: string): string {
  const q = quantizeBbox(bbox, 0.005); // ~500m grid
  return `${OVERTURE_RELEASE}:${q.west},${q.south},${q.east},${q.north}:${section}`;
}
```

### 3×3 Spatial Prefetch

```typescript
function generate3x3Grid(viewport: BBox): BBox[] {
  const w = viewport.east - viewport.west;
  const h = viewport.north - viewport.south;
  return [-1, 0, 1].flatMap(dx =>
    [-1, 0, 1].map(dy => ({
      west: viewport.west + dx * w,
      south: viewport.south + dy * h,
      east: viewport.east + dx * w,
      north: viewport.north + dy * h,
    }))
  );
}

// Priority: center (await) → cardinal (high) → diagonal (low)
// Only active section prefetched. Others load on scroll.
// Use requestIdleCallback for non-center tiles.
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
// Small pans within same grid cell → cache hit
// Prevents cache thrashing on micro-movements
```

### What to Cache vs Recompute

| Data | Cache? | Size | Reason |
|------|--------|------|--------|
| Building metrics | Yes | ~1 KB | Tiny, expensive to re-query |
| POI metrics | Yes | ~1 KB | Tiny, expensive to re-query |
| Network metrics | Yes | ~1 KB | Tiny, expensive to re-query |
| Network graph | Yes | ~2-5 MB | Largest payload, most expensive query |
| Isochrone polygon | No | — | Recompute: Dijkstra is <10ms, origin changes |
| Metrics within isochrone | No | — | Depends on dynamic polygon |

---

## 9. Canonical Domain Contracts

All data flows through these types. No ad-hoc shapes:

```typescript
// shared/types/geo.ts
interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface LngLat {
  lng: number;
  lat: number;
}

// shared/types/metrics.ts
type DataState = 'idle' | 'loading' | 'loaded' | 'error';

interface SectionData<T> {
  state: DataState;
  data: T | null;
  error: string | null;
  cachedAt: number | null;  // null = not cached
  queryMs: number | null;   // query duration for perf monitoring
}

interface BuildingMetrics {
  // Scalar metrics (displayed as MetricCards)
  buildingCount: number;
  totalFootprintAreaM2: number;
  avgFootprintAreaM2: number;
  stddevFootprintAreaM2: number;
  buildingDensity: number;
  buildingsWithHeight: number;
  avgHeightM: number | null;
  avgFloors: number | null;
  heightCoverage: number;  // 0-1
  // Distribution data (fed to charts via ChartBinding.dataKey)
  footprintAreaDistribution: number[];  // raw values for histogram
  heightDistribution: number[];         // raw values for histogram
}

interface NetworkMetrics {
  // Scalar metrics
  segmentCount: number;
  totalLengthM: number;
  intersectionCount: number;
  deadEndCount: number;
  intersectionDensity: number;    // per km²
  linkNodeRatio: number;
  connectedNodeRatio: number;
  alphaIndex: number;
  betaIndex: number;
  gammaIndex: number;
  streetOrientationEntropy: number;
  streetOrientationOrder: number; // 1 - (entropy / max_entropy)
  // Distribution data (fed to charts)
  roadClassDistribution: Record<string, number>;
  streetOrientationBins: number[];  // 36 bins, 0-180° symmetric
}

interface AmenityMetrics {
  // Scalar metrics
  poiCount: number;
  poiDensity: number;           // per km²
  categoryDiversity: number;    // Shannon entropy, normalised 0-1
  fifteenMinScore: number | null; // requires isochrone (see §9b)
  // Distribution data (fed to charts)
  categoryDistribution: Record<string, number>;
  essentialServices: Record<string, boolean>;
}

interface WalkabilityMetrics {
  // Scalar metrics
  compositeWalkScore: number;
  reachableBuildings: number;
  reachablePOIs: number;
  // Distribution data (fed to charts)
  isochroneAreaM2: Record<number, number>;  // minutes → area
  pedshedRatio: Record<number, number>;      // minutes → ratio
  reachablePOIsByCategory: Record<string, number>;
}

// Type-safe section → metrics mapping (used by useSectionQuery)
interface SectionMetricsMap {
  overview: Record<string, never>;
  buildings: BuildingMetrics;
  network: NetworkMetrics;
  amenities: AmenityMetrics;
  walkability: WalkabilityMetrics;
}

type SectionId = keyof SectionMetricsMap;
```

### 9b. Isochrone Bridge Pattern

The isochrone polygon is the ONE cross-section dependency. It's mediated through the Zustand store — never through direct feature imports:

```
┌──────────────────────────────────────────────────────────────┐
│              ISOCHRONE BRIDGE (the only bridge)                │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Walkability section:                                         │
│    1. User clicks map → sets origin in map-store              │
│    2. DuckDB fetches network graph for bbox                   │
│    3. Dijkstra computes reached nodes → isochrone polygon     │
│    4. Writes polygon to map-store.isochronePolygon            │
│                                                               │
│  Map feature:                                                 │
│    5. Subscribes to map-store.isochronePolygon                │
│    6. Renders polygon as GeoJSON layer                        │
│                                                               │
│  Amenities section:                                           │
│    7. Subscribes to map-store.isochronePolygon                │
│    8. When polygon exists AND section is active:              │
│       → DuckDB queries POIs within polygon                    │
│       → Computes fifteenMinScore                              │
│    9. When polygon is null:                                    │
│       → fifteenMinScore = null, shows "Set origin" prompt     │
│                                                               │
│  RULES:                                                       │
│  • features/isochrone/ writes the polygon                     │
│  • features/sections/ reads it (via store subscription)       │
│  • They NEVER import each other                               │
│  • map-store owns the polygon state                           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// state/map-store.ts — the bridge
interface MapState {
  // ... existing fields ...
  isochroneOrigin: LngLat | null;
  isochronePolygon: GeoJSON.Polygon | null;
  isochroneMinutes: number;  // 5, 10, or 15
  setIsochroneResult: (origin: LngLat, polygon: GeoJSON.Polygon) => void;
  clearIsochrone: () => void;
}
```

### 9c. Lazy Metric Pattern

Expensive metrics (fractal dimension, detailed block analysis) don't compute on scroll. They compute on user click:

```typescript
// In MetricDescriptor:
{ key: 'fractalDimension', label: 'Fractal Dimension', unit: 'decimal', lazy: true,
  description: 'Geometric complexity of street network (box-counting method)' }

// In the section component:
function LazyMetric({ descriptor, computeFn }: { descriptor: MetricDescriptor; computeFn: () => Promise<number> }) {
  const [value, setValue] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);

  if (value !== null) return <MetricCard {...descriptor} value={value} />;
  return (
    <button onClick={async () => { setComputing(true); setValue(await computeFn()); setComputing(false); }}>
      {computing ? 'Computing...' : `Calculate ${descriptor.label}`}
    </button>
  );
}
```

Lazy metrics are excluded from the default query. They have their own compute function that runs independently. This prevents expensive computations from blocking the section's initial render.

---

## 10. Component Patterns

### Registry-Driven Section Rendering

Sections render from the registry — not from per-section JSX:

```typescript
// features/sections/components/SectionRenderer.tsx
// This is the ONLY component that renders sections. Individual section components
// only exist when they need custom layout beyond the default grid.

function SectionRenderer({ sectionId }: { sectionId: SectionId }) {
  const config = SECTION_REGISTRY.find(s => s.id === sectionId)!;
  const { data, state } = useSectionQuery(sectionId);

  if (state === 'loading') return <SectionSkeleton config={config} />;
  if (state === 'error') return <SectionError config={config} />;

  return (
    <SectionShell title={config.name} description={config.description}>
      {/* Metrics from descriptor registry — no per-metric JSX */}
      <MetricsGrid descriptors={config.metrics} data={data} />

      {/* Charts from binding registry — no per-chart JSX */}
      <ChartsGrid bindings={config.charts} data={data} />
    </SectionShell>
  );
}
```

### When to use custom section components

Most sections should render from `SectionRenderer`. Only create a custom component when:
- The section has interactive controls (e.g., WalkabilitySection has click-to-set origin)
- The layout differs significantly from the default metrics + charts grid
- There's conditional logic not expressible through descriptors (e.g., "show this only when isochrone exists")

```typescript
// features/sections/components/sections/WalkabilitySection.tsx
// Custom: has isochrone controls + conditional rendering
function WalkabilitySection() {
  const { data, state } = useSectionQuery('walkability');
  const config = SECTION_REGISTRY.find(s => s.id === 'walkability')!;
  const isochronePolygon = useMapStore(s => s.isochronePolygon);

  return (
    <SectionShell title={config.name} description={config.description}>
      <IsochroneControls />  {/* custom interactive element */}
      {isochronePolygon ? (
        <>
          <MetricsGrid descriptors={config.metrics} data={data} />
          <ChartsGrid bindings={config.charts} data={data} />
        </>
      ) : (
        <p>Click on the map to set a walking origin point.</p>
      )}
    </SectionShell>
  );
}
```

### File Size Limits

| File Type | Max Lines | Action if exceeded |
|-----------|-----------|-------------------|
| Component | 150 | Split into sub-components |
| Hook | 100 | Extract logic to utils |
| Utility | 80 | Split by domain |
| Types | 200 | Split into domain files |
| SQL template | 60 | One query per file |
| Test | 300 | Split by test suite |

---

## 11. Agent Ownership Boundaries

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENT ASSIGNMENTS                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Context: map-runtime        → features/map/                     │
│   Context: section-experience → features/sections/                │
│   Context: charts-visual      → features/charts/                  │
│   Context: isochrone-engine   → features/isochrone/               │
│   Context: data-access        → data/ + state/                    │
│   Context: shared-components  → shared/                           │
│                                                                   │
│   COORDINATION RULES:                                             │
│   • Agents own their feature module completely                    │
│   • Changes to shared/ require coordination                       │
│   • Changes to index.ts exports require notification              │
│   • Type changes in shared/types/ require all-agent notification  │
│   • State store changes require data-access agent approval        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Conflict Prevention

1. **Additive only** — agents add new files, rarely modify existing
2. **Append-only exports** — new exports go below `// NEW EXPORTS` marker
3. **One section per agent** — when building sections in parallel
4. **Orchestrator integrates** — main session wires features together

---

## 12. Performance Budgets

| Budget | Target | How to Measure |
|--------|--------|----------------|
| Landing page load | <2s | Lighthouse |
| First section data (cold) | <3s | Performance.now() in hook |
| Section data (cached) | <50ms | Performance.now() in hook |
| Map pan (prefetched) | <50ms | Performance.now() in moveend |
| Section scroll transition | <100ms | requestAnimationFrame timing |
| Layer cross-fade | 300ms | CSS transition duration |
| Metric count-up | 500ms | Animation duration |
| Isochrone (Dijkstra only) | <10ms | Web Worker timing |
| Isochrone total (cold) | <4s | End-to-end in hook |
| Bundle size (app) | Monitor | Vite build output |
| Bundle size (DuckDB) | ~15MB | Expected baseline |
| Memory after 10min use | <200MB | DevTools heap snapshot |

---

## 13. Code Style

### Naming

```
ComponentName.tsx          # PascalCase for components
useHookName.ts            # camelCase with 'use' prefix
utilityName.ts            # camelCase for utilities
kebab-case.sql.ts         # kebab-case for SQL templates
```

### Import Order

```typescript
// 1. React
import { useState, useCallback } from 'react';

// 2. External libraries
import maplibregl from 'maplibre-gl';

// 3. Internal: shared/
import { MetricCard } from '@/shared/components';
import { formatNumber } from '@/shared/utils';

// 4. Internal: data/
import { useSectionQuery } from '@/data';

// 5. Internal: state/
import { useMapStore } from '@/state/map-store';

// 6. Internal: same feature
import { SectionShell } from '../SectionShell';
import type { SectionProps } from '../types';

// 7. Styles (Tailwind preferred, CSS modules as fallback)
```

### TypeScript Rules

- Strict mode, no `any` (use `unknown` and narrow)
- `interface` for object shapes, `type` for unions/intersections
- Named exports only (no default exports)
- Explicit return types on hooks and exported functions

---

## 14. Anti-Patterns to Reject

| Anti-Pattern | Why | Do Instead |
|-------------|-----|------------|
| Feature logic in shared/ | Breaks module isolation | Keep in feature module |
| Layer visibility hardcoded in map + sidebar | Causes drift | Use section registry |
| `querySourceFeatures()` for analytics | Zoom-dependent, inaccurate | Use DuckDB for all analytics |
| Cross-feature imports | Creates coupling | Communicate through state/ stores |
| Inline styles | Inconsistent, hard to theme | Tailwind classes |
| `any` types | Loses type safety | `unknown` + narrowing |
| Side effects on import | Hidden dependencies | Explicit initialization |
| DuckDB queries on main thread | Blocks UI | Use async, consider Web Worker |
| Cache keys without Overture version | Serves stale data | Always prefix with release version |
| Metric ID collisions | Breaks registry | Unique IDs enforced in registry |
| Per-metric JSX in section components | Doesn't scale, hard to maintain | Render from MetricDescriptor registry |
| Magic string chart references | No type safety, silent breakage | Use ChartBinding objects |
| Direct isochrone imports across features | Violates module boundaries | Subscribe via map-store.isochronePolygon |
| Expensive metrics on scroll | Blocks section render | Mark as `lazy: true` in descriptor |

---

## 15. Observability

Structured timing for diagnosing performance issues:

```typescript
// In every data hook:
const start = performance.now();
const result = await queryDuckDB(bbox, section);
const queryMs = performance.now() - start;

// Store in section data for display in dev mode:
console.debug(`[${section}] query: ${queryMs.toFixed(0)}ms, cache: ${cached ? 'HIT' : 'MISS'}`);
```

Events to track:
- `section.activate` — which section, scroll position
- `query.start`, `query.end` — section, bbox, duration, cache hit/miss
- `prefetch.start`, `prefetch.end` — tiles queued, tiles completed
- `isochrone.compute` — origin, time threshold, node count, duration
- `cache.evict` — entries evicted, memory freed

---

## 16. Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUICK REFERENCE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ADD NEW SECTION:                                                │
│  1. Define metrics interface in shared/types/metrics.ts          │
│  2. Add MetricDescriptor[] in config/metrics.ts                  │
│  3. Add ChartBinding[] in config/charts.ts                       │
│  4. Add SectionConfig in config/sections.ts                      │
│  5. Add key to SectionMetricsMap in shared/types/metrics.ts      │
│  6. Create data/duckdb/queries/new-section.sql.ts                │
│  7. Create features/map/components/layers/NewLayer.tsx            │
│  8. (Optional) Custom section component if interactive           │
│                                                                  │
│  ADD NEW METRIC (to existing section):                           │
│  1. Define in docs/METRICS.md                                    │
│  2. Add property to section's metrics interface                  │
│  3. Add MetricDescriptor to section's array in config/metrics.ts │
│  4. Add SQL column in data/duckdb/queries/                       │
│  5. Done — no component changes needed                           │
│                                                                  │
│  ADD NEW CHART TYPE:                                             │
│  1. Create features/charts/components/NewChart.tsx (≤150 lines)  │
│  2. Register in CHART_COMPONENTS map                              │
│  3. Add ChartType union member                                   │
│  4. Export from features/charts/index.ts                          │
│                                                                  │
│  ADD CHART TO SECTION (existing chart type):                     │
│  1. Add distribution/record field to section metrics interface   │
│  2. Add ChartBinding to section's array in config/charts.ts      │
│  3. Add SQL column if needed                                     │
│  4. Done — no component changes needed                           │
│                                                                  │
│  ADD LAZY METRIC:                                                │
│  1. Add property to metrics interface                             │
│  2. Add descriptor with lazy: true in config/metrics.ts          │
│  3. Create compute function (separate from main query)           │
│  4. LazyMetric component handles the UI automatically            │
│                                                                  │
│  BEFORE COMMITTING:                                              │
│  1. npm run lint                                                 │
│  2. npm run typecheck                                            │
│  3. npm run build                                                │
│  4. Test with 3 different cities                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

*Patterns inherited from Urban Explorer (2026-02-06), adapted for chrono.city's zero-backend architecture. Registry-driven metric/chart scalability added 2026-02-07.*

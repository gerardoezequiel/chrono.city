# UX Design

> How chrono.city presents urban analytics through scroll-driven narrative, progressive data loading, and map-sidebar synchronisation.

## Core interaction model

chrono.city is a **scroll-driven urban narrative**. The sidebar tells a story about a place — its physical form, its connectivity, its amenities, its walkability. Each chapter of that story activates a different data layer on the map and loads its own analytics.

The user doesn't configure anything. They don't select layers, toggle filters, or write queries. They scroll, and the city reveals itself.

## Page structure

### Landing state

When the user first arrives, they see:

```
┌──────────────────────────────────────────────┐
│                                              │
│              chrono.city                     │
│                                              │
│     Explore the urban fabric of any          │
│     city on Earth.                           │
│                                              │
│              [ Explore ↓ ]                   │
│                                              │
│         ┌────────────────────┐               │
│         │                    │               │
│         │    basemap only    │               │
│         │    (no data)       │               │
│         │                    │               │
│         └────────────────────┘               │
│                                              │
│     Built on Overture Maps. Open source.     │
│     Zero backend. Zero cost.                 │
│                                              │
└──────────────────────────────────────────────┘
```

No data queries fire. The basemap loads instantly. The user reads about the project, understands what it does, then decides to explore.

### Exploration state

Once the user zooms into a city (or clicks "Explore" and selects a city), the interface transitions to a map + sidebar layout:

```
┌────────────────────────┬─────────────────────┐
│                        │                     │
│                        │  ◉ Overview         │
│                        │    City context,    │
│                        │    population,      │
│       MAP              │    coordinates      │
│                        │                     │
│    (PMTiles layers     │  ◉ Urban Fabric     │  ← scroll here
│     react to sidebar   │    building count   │
│     scroll position)   │    footprint area   │
│                        │    density chart    │
│                        │    morphology       │
│                        │                     │
│                        │  ◉ Street Network   │
│                        │    connectivity     │
│                        │    entropy          │
│                        │    fractal dim      │
│                        │                     │
│                        │  ◉ Amenities        │
│                        │    POI diversity    │
│                        │    15-min city      │
│                        │    category chart   │
│                        │                     │
│                        │  ◉ Walkability      │
│                        │    isochrone        │
│                        │    reachability     │
│                        │    pedshed          │
│                        │                     │
└────────────────────────┴─────────────────────┘
```

## Scroll-driven sections

### Section definition

Each section has:
- A **name** and short description
- A **PMTiles layer set** (which layers to show/hide)
- A **DuckDB query** (what analytics to compute)
- A **metric set** (what numbers to display)
- A **chart set** (what visualisations to render)

```typescript
interface Section {
  id: string;
  name: string;
  description: string;
  layers: {
    show: string[];     // PMTiles layers to activate
    opacity: number;    // Opacity for active layers (1.0)
    fadeOthers: number; // Opacity for inactive layers (0.15)
  };
  query: (bbox: BBox) => Promise<SectionMetrics>;
  charts: ChartConfig[];
}
```

### Sections

| Section | PMTiles layers | DuckDB query | Key metrics |
|---------|---------------|-------------|-------------|
| Overview | basemap only | none | City name, coordinates, area |
| Urban Fabric | buildings | buildings query | Count, area, density, height distribution |
| Street Network | roads | transport query | Segment count, connectivity, road class mix |
| Amenities | POIs | places query | POI count, category diversity, density |
| Walkability | roads + isochrone polygon | network graph + Dijkstra | Isochrone area, reachable POIs, walk score |

### Scroll behaviour

The sidebar uses `IntersectionObserver` to detect which section is in the viewport:

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
        setActiveSection(entry.target.dataset.section);
      }
    }
  },
  { threshold: [0.3, 0.5, 0.7] }
);
```

When a section becomes active:

1. **Map layers transition.** Active section's layers fade to 100% opacity. All other layers fade to 15% opacity. This transition is animated over ~300ms using MapLibre's `setPaintProperty`.

2. **Data loads.** The `useSectionQuery` hook fires the DuckDB query for this section (or returns cached data).

3. **Metrics appear.** Numbers animate in using a count-up effect. Charts draw progressively.

### Cross-fade between sections

As the user scrolls between two sections, the opacity of each layer group interpolates based on scroll position:

```typescript
function onScrollProgress(from: Section, to: Section, progress: number) {
  // progress: 0 = fully in 'from', 1 = fully in 'to'
  setLayerOpacity(from.layers.show, 1.0 - progress * 0.85); // 1.0 → 0.15
  setLayerOpacity(to.layers.show, 0.15 + progress * 0.85);  // 0.15 → 1.0
}
```

This means the user never sees an abrupt layer switch. The map smoothly transitions as they scroll.

## Map interactions

### Pan and zoom

The map is always pannable and zoomable. When the user pans:

1. `moveend` event fires
2. New bbox computed and quantized
3. If bbox changed: refetch data for active section
4. Prefetch 3×3 grid for active section
5. Sidebar metrics update with new data

### Click for isochrone

When the Walkability section is active, clicking the map sets an isochrone origin:

1. Click coordinates captured
2. Network graph fetched (or from cache)
3. Dijkstra runs in Web Worker
4. Isochrone polygon rendered on map
5. Metrics within isochrone computed and displayed

The isochrone supports multiple time thresholds (5, 10, 15 minutes) shown as concentric polygons with decreasing opacity.

### Hover

When hovering over the map, a subtle highlight shows the feature under the cursor (building footprint, road segment, POI). A small tooltip shows the feature's key attribute (building area, road class, POI name/category).

This uses MapLibre's `queryRenderedFeatures()` on the PMTiles layers — no DuckDB involved.

## Sidebar design

### Layout

Each section follows a consistent layout:

```
┌─────────────────────────┐
│ Section Title            │
│ Brief description text   │
├─────────────────────────┤
│                         │
│  ┌─────┐ ┌─────┐       │
│  │ 847 │ │12.4 │       │  ← Key metrics (large numbers)
│  │bldgs│ │  ha │       │
│  └─────┘ └─────┘       │
│                         │
│  ┌─────────────────┐   │
│  │                 │   │  ← Primary chart
│  │   distribution  │   │
│  │   chart         │   │
│  │                 │   │
│  └─────────────────┘   │
│                         │
│  Additional metrics     │  ← Secondary metrics (smaller)
│  in compact rows        │
│                         │
└─────────────────────────┘
```

### Loading states

When data is being fetched:
- Key metric numbers show a subtle shimmer/skeleton
- Charts show a minimal placeholder outline
- A small progress indicator shows which data source is loading

When data arrives:
- Numbers count up from 0 to final value (~500ms animation)
- Charts draw in progressively
- No layout shift — skeleton matches final layout

### Responsive design

| Viewport | Layout |
|----------|--------|
| Desktop (>1024px) | Side-by-side: map left (65%), sidebar right (35%) |
| Tablet (768-1024px) | Side-by-side: map left (55%), sidebar right (45%) |
| Mobile (<768px) | Stacked: map top (50vh), sidebar bottom (scrollable sheet) |

On mobile, the sidebar becomes a bottom sheet that the user can swipe up. The map remains visible above it. Scroll-driven section transitions still work within the sheet.

## Visual design principles

### Map styling

- Dark basemap by default (reduces visual competition with data layers)
- Building footprints: warm fill (amber/sand), thin outline
- Road network: white/light gray lines, width varies by class
- POIs: small coloured dots, category-coded
- Isochrone: semi-transparent fill with a clear boundary, gradient from green (5min) to amber (10min) to red (15min)

### Typography

- Section titles: bold, large, high contrast
- Key metrics: oversized numbers (the "hero" of each section)
- Descriptions: readable body text, muted colour
- Chart labels: small, unobtrusive

### Charts

- Minimal chrome — no gridlines, minimal axes
- Colour-coded to match map layers
- Interactive: hover for exact values
- Responsive to container width

### Animation

- Layer transitions: 300ms ease-out
- Metric count-up: 500ms ease-out
- Chart draw: 400ms staggered
- Map fly-to: 1000ms ease-in-out (when selecting a city)

## User flows

### Flow 1: First-time visitor

```
Land on page → read about project → click "Explore"
  → City selector (search or click map) → fly to city
    → Overview section visible → scroll down
      → Urban Fabric loads → see building metrics
        → Continue scrolling through sections
          → Reach Walkability → click for isochrone
            → Explore reachability
```

### Flow 2: Returning visitor

```
Land on page → last city remembered (localStorage)
  → Auto-fly to city → data loads from IndexedDB cache
    → Instant metrics → explore further
```

### Flow 3: Sharing

```
User explores London, Walkability section
  → URL updates: chrono.city/london?section=walkability&lat=51.5&lon=-0.1
    → Share URL → recipient lands directly in that view
```

### Flow 4: Researcher

```
Explore city → examine metrics in detail
  → Export data (CSV download of current section metrics)
    → Use in paper/report
```

## URL routing

The URL encodes the current state for sharing and deep linking:

```
chrono.city/{city}?section={section}&lat={lat}&lon={lon}&zoom={zoom}

Examples:
chrono.city/london?section=buildings&lat=51.505&lon=-0.09&zoom=14
chrono.city/tokyo?section=walkability&lat=35.68&lon=139.76&zoom=15
chrono.city/?lat=40.71&lon=-74.00&zoom=13  (no city name, just coordinates)
```

The city name is cosmetic (for readable URLs). The actual state is driven by lat/lon/zoom.

## Accessibility

- Sidebar fully keyboard-navigable (Tab through sections)
- Screen reader announces section transitions and metric values
- Map interactions have keyboard equivalents (arrow keys to pan, +/- to zoom)
- Colour choices tested for colour-blind accessibility
- Charts have text alternatives
- Reduced motion: disable animations when `prefers-reduced-motion` is set

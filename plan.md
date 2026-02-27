# UX Plan: Exploration vs. Report — chrono.city vs Aino

## Competitive Analysis: chrono.city vs Aino

### What Aino Does

[Aino](https://www.aino.world/) is an AI-powered GIS platform ($90-150/month) that generates static site analysis reports. Their [15mincity.ai](https://www.15mincity.ai/) demo evaluates any location against the 15-minute city concept.

**Aino's model:** Click → Wait → Get a report. One-shot. Static.

| Aino Strength | How chrono.city Differs |
|--------------|------------------------|
| AI natural language queries | We give direct visual exploration — no prompt needed |
| 10,000+ datasets (demographics, zoning, mobility) | We focus deeply on 4 Overture layers, computed live |
| Persona-based scoring (families, students, etc.) | We show universal urban quality metrics with academic rigor |
| PDF export | We provide a live, interactive, shareable experience |
| 400+ cities | We work on ANY coordinate on Earth (Overture is global) |
| Server-side computation, API keys, accounts | Zero backend. `git clone && npm run dev`. Free forever. |

### Where Aino Falls Short (our opportunity)

1. **No real-time interaction.** You get a report. You can't drag, pan, or explore. You can't say "what if I moved 3 blocks east?"
2. **No progressive discovery.** You wait for the entire analysis. No visual feedback during computation.
3. **No map-as-content.** Their maps are static imagery. Our PMTiles ARE the content — buildings, roads, POIs visible instantly.
4. **No comparative exploration.** You can't easily compare two neighborhoods side-by-side in real-time.
5. **Black box scoring.** Their AI generates scores with opaque methodology. We show every formula, every data source, every academic reference.
6. **Server dependency.** Aino requires accounts, subscriptions, and internet. We run entirely in the browser.

### chrono.city's Differentiator

**Aino = "Ask and wait for a report."**
**chrono.city = "Explore and discover as you move."**

The map tells the story BEFORE any query runs. The user never waits — they read, explore, drag, and discover. Numbers arrive to confirm what the visuals already showed.

---

## The UX Vision: Seven Layers of Progressive Discovery

### Layer 1: PMTiles as Instant Content (0ms)

The map already contains 80% of the analytical story:
- Building footprints → urban fabric density, grain, form
- Road network → connectivity, grid pattern, dead-ends
- POI dots → amenity clustering, service coverage

**What to build:**
- Visual density heatmap derived from building fill opacity (no query needed — PMTiles paint expression)
- Road network emphasis that shifts by section (buildings section → faded roads; network section → road classes colored)
- POI clustering visible at zoom levels (places-dots already exist, need category-colored variant)
- Land use polygons from Overture `base` theme (green spaces, water — currently not loaded!)

### Layer 2: Contextual Narratives (0ms)

Each section opens with editorial text that teaches the user what they're looking at:

```
┌──────────────────────────────────────┐
│ ▸ URBAN FABRIC                       │
│                                      │
│ Building footprints reveal the       │
│ city's DNA. Dense, fine-grained      │
│ patterns — like those visible on     │
│ the map — indicate a walkable        │
│ neighborhood where destinations      │
│ are close together.                  │
│                                      │
│ ↳ Look at the map: are buildings     │
│   tightly packed or spread apart?    │
└──────────────────────────────────────┘
```

**Already implemented** in `config/narratives.ts`. Next step: make narratives dynamic — they should reference actual data once resolved: *"This area has {buildingCount} buildings across {areaHa} hectares..."*

### Layer 3: Scroll-Driven Map Theater (0ms)

As the user scrolls through chapters, the map transforms:

```
Overview:   Basemap + all layers subtle
    ↓ scroll
Buildings:  Building fills darken, 3D extrusions enabled, roads fade
    ↓ scroll
Network:    Roads overlay appears with class-colored styling, buildings recede
    ↓ scroll
Amenities:  POI dots bloom, category colors, 15-min service radius rings
    ↓ scroll
Walkability: Isochrone polygon + all layers combined
```

**Partially implemented** via `useScrollSpy` + `useMapLayerSync`. Missing:
- Smooth cross-fade transitions (currently instant show/hide)
- 3D toggle tied to buildings section scroll
- Category-colored POI dots for amenities section
- Layer opacity animation (300ms ease-out)

### Layer 4: Real-Time Chart Theater During Drag (NEW)

This is the killer feature Aino can't match. While the user drags the pedshed marker, charts update in real-time using `queryRenderedFeatures`:

```
┌──────────────────────────────────────┐
│ ▸ URBAN FABRIC           ← dragging  │
│                                      │
│  ┌──────────┐  ┌──────────┐         │
│  │ ~2,847   │  │ ~890     │         │
│  │ buildings │  │ inside   │   ← approximate
│  │ (approx) │  │ pedshed  │     from tiles
│  └──────────┘  └──────────┘         │
│                                      │
│  Building Heights        Road Mix    │
│  ▁▂▃▅▇█▇▅▃▁           ━━━ 42% res  │
│                         ━━  28% sec  │  ← live charts
│                         ━   18% pri  │    from rendered
│                         ━   12% oth  │    features
│                                      │
│  ↳ Release to compute exact metrics  │
└──────────────────────────────────────┘
```

**Implementation approach:**
1. `queryRenderedFeatures` on drag → approximate building count, height distribution, road class mix
2. Charts render with "approximate" styling (dashed borders, ~prefix on numbers)
3. On drag END → fire DuckDB queries → charts snap to exact values with solid styling
4. Transition from approximate → exact is animated (bars resize, numbers count-up)

**Key charts to build:**
- **Height histogram** (buildings section): bars for 0-5m, 5-10m, 10-20m, 20-50m, 50m+
- **Road class donut** (network section): residential, secondary, primary, footway, cycleway
- **Category treemap** (amenities section): food, health, education, shopping, leisure, civic
- **15-min completeness radar** (amenities section): 6 spokes for service categories
- **Chrono Score radar** (overview): 4 spokes for chapter scores

### Layer 5: Progressive Chapter Scoring (1-15s per chapter)

Each section computes its chapter score independently. The overview's Chrono Score gauge builds up as chapters resolve:

```
t=0s:   Chrono Score: —/100  [Fabric: — ] [Resilience: — ] [Vitality: — ] [Connectivity: — ]
t=3s:   Chrono Score: 72/100 [Fabric: 72] [Resilience: — ] [Vitality: — ] [Connectivity: — ]
t=6s:   Chrono Score: 68/100 [Fabric: 72] [Resilience: 58] [Vitality: — ] [Connectivity: — ]
t=9s:   Chrono Score: 71/100 [Fabric: 72] [Resilience: 58] [Vitality: 81] [Connectivity: — ]
t=12s:  Chrono Score: 69/100 [Fabric: 72] [Resilience: 58] [Vitality: 81] [Connectivity: 62]
```

The composite recalculates with each new chapter. User watches it converge. Feels alive.

**Already partially implemented** in `ChronoScore.tsx`. Missing: actual score computation from metrics (currently all nulls).

### Layer 6: Neighborhood Discovery Mode (NEW — the "best neighborhood" answer)

To answer "which is the best neighborhood?", we need a city-wide view:

**Option A: Hex Grid Heatmap**
1. Tile the visible area into H3 hexagons (~200m radius)
2. For each hex centroid, compute a quick Chrono Score approximation using `queryRenderedFeatures`:
   - Building density from visible footprints → Fabric proxy
   - Road density from visible segments → Connectivity proxy
   - POI count from visible dots → Vitality proxy
3. Color hexagons by score (green → yellow → red)
4. User sees hotspots instantly, clicks one → deep dive

**Option B: Drag-to-Compare**
1. User can pin a location (bookmark the current analysis)
2. Drag to new location → side-by-side comparison appears
3. "This area has 3x more cafes but 40% fewer parks"
4. Radar chart overlays both locations

**Option C: City Pulse (scroll-free overview)**
1. Zoom out to city scale
2. Show aggregated scores as colored dots on major intersections
3. Each dot = quick DuckDB query for that bbox
4. Prefetch as user pans → builds city-wide intelligence map

**Recommended: Start with Option B** (drag-to-compare). It leverages existing infrastructure (pedshed drag, DuckDB queries, metric cards) and directly answers "which neighborhood is better?"

### Layer 7: Deep Research Mode (NEW)

When user wants to go deeper on a specific area:

**Expandable metric cards:**
- Click a metric → it expands to show:
  - Distribution chart (not just the average)
  - Academic context ("GSI of 0.35 indicates Barcelona-style block density")
  - Data quality indicator ("based on 3,247 buildings, 89% with height data")
  - Comparison to global benchmarks

**Section drill-down:**
- Each section has a "Deep Dive" toggle
- Expands to show all 5-6 metrics (normally shows top 3)
- Shows computed formulas with actual values
- Links to academic references

This maps to the `lazy: true` pattern in MetricDescriptor — expensive metrics computed on demand, not on scroll.

---

## Implementation Priority (what to build next)

### Phase A: Charts + Real-Time Drag (HIGH IMPACT)

This is the single biggest UX upgrade. Without charts, we're just showing numbers. Charts make the data spatial, comparative, and beautiful.

1. **MiniBar component** — horizontal bar chart, 60 lines, renders from data array
2. **MiniDonut component** — category donut, 80 lines, renders from distribution
3. **MiniRadar component** — 6-spoke radar, 90 lines, for 15-min completeness + Chrono Score
4. **Chart bindings** in config/charts.ts — register which chart goes where
5. **useVisualChartData hook** — queryRenderedFeatures → chart-ready data during drag
6. **Approximate → Exact transition** — charts animate from tile-derived to DuckDB-derived data

### Phase B: Smooth Layer Transitions (POLISH)

1. Cross-fade layer opacity on scroll (300ms ease-out)
2. Auto-3D toggle when buildings section scrolls into view
3. Category-colored POI dots (food=amber, health=red, education=blue, etc.)
4. Land use PMTiles layer (green spaces visible instantly)

### Phase C: Neighborhood Comparison (DIFFERENTIATOR)

1. Pin/bookmark current analysis
2. Drag to second location → comparison sidebar
3. Delta metrics ("+23% more buildings", "-40% parks")
4. Overlay radar charts

### Phase D: Advanced Metrics Computation (DEPTH)

1. Implement all 21 metrics from METRICS_FRAMEWORK.md
2. Wire chapter scores to real computed values
3. Score normalization against academic ranges
4. Dynamic narratives with actual data values

---

## File Plan

```
NEW FILES:
  src/features/charts/
    components/
      MiniBar.tsx           — horizontal bar chart (≤80 lines)
      MiniDonut.tsx         — category donut chart (≤90 lines)
      MiniRadar.tsx         — 6-spoke radar chart (≤90 lines)
    hooks/
      useChartData.ts       — transform metric data → chart props
    index.ts                — public API

  src/features/sections/
    hooks/
      useVisualChartData.ts — queryRenderedFeatures → chart data during drag
      useDragState.ts       — tracks drag vs settled state
    components/
      ComparisonPanel.tsx   — side-by-side neighborhood comparison

  src/config/
    charts.ts               — ChartBinding[] per section
    benchmarks.ts           — academic reference ranges for each metric

MODIFIED FILES:
  src/features/sections/components/SectionShell.tsx  — add chart rendering from bindings
  src/features/sections/components/Sidebar.tsx       — wire drag state + comparison
  src/features/map/components/MapContainer.tsx       — add land_use PMTiles source + layer
  src/config/sections.ts                             — add chart bindings per section
  src/config/narratives.ts                           — dynamic narrative templates with {placeholders}
  src/shared/components/MetricCard.tsx               — expandable detail mode
```

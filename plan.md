# UX Plan: Visual-First Progressive Loading

## The Problem

Current flow: User clicks → 3 DuckDB queries fire simultaneously → skeletons for 3-15s → numbers appear. The user stares at gray boxes. The map already shows buildings, roads, and could show POIs — but we don't exploit this.

## Core Insight: Two Pipelines, Two Speeds

| Pipeline | Latency | What it gives |
|----------|---------|---------------|
| PMTiles → MapLibre | **0ms** (tiles stream as you pan) | Building footprints, road network, POI dots, land use |
| DuckDB → S3 Parquet | **3-15s** (cold), <50ms (cached) | Exact counts, areas, heights, distributions, scores |

**The map already tells 80% of the story before any query runs.** Dense footprints = urban fabric. Grid streets = high connectivity. Clustered dots = amenity hotspots. We need the UX to leverage what's already visible.

## The "Visual First, Numbers Later" Architecture

### Three-Phase Section Reveal

Each sidebar section transitions through three phases:

```
Phase 1: VISUAL (0ms)                Phase 2: COMPUTING (1-15s)           Phase 3: RESOLVED
┌─────────────────────────┐          ┌─────────────────────────┐          ┌─────────────────────────┐
│ ▸ URBAN FABRIC          │          │ ▸ URBAN FABRIC          │          │ ▸ URBAN FABRIC          │
│                         │          │                         │          │                         │
│ Building footprints     │          │ Building footprints     │          │ 3,247 buildings         │
│ reveal the city's DNA.  │          │ reveal the city's DNA.  │          │ across 2.1 km²          │
│ Dense, fine-grained     │          │                         │          │                         │
│ patterns indicate a     │          │ ┌──────┐ ┌──────┐      │          │ ┌──────┐ ┌──────┐      │
│ walkable neighborhood.  │          │ │██░░░░│ │██░░░░│      │          │ │3,247 │ │12.4  │      │
│                         │          │ │query │ │query │      │          │ │bldgs │ │ha    │      │
│ [map highlights bldgs]  │          │ └──────┘ └──────┘      │          │ └──────┘ └──────┘      │
│                         │          │ ██████░░░░  63%         │          │ ┌──────────────────┐   │
│                         │          │                         │          │ │ ▁▃▅▇█▇▅▃▁       │   │
│                         │          │                         │          │ │ height distrib.  │   │
│                         │          │                         │          │ └──────────────────┘   │
└─────────────────────────┘          └─────────────────────────┘          └─────────────────────────┘
  Map: buildings highlighted           Map: same                           Map: same + data overlays
  Text: contextual narrative           Text: same + progress               Text: data-enriched
```

### What Each Phase Shows

**Phase 1 — VISUAL (instant, 0ms)**
- Section title + rich narrative text about what this analysis means
- Map layer transitions: the relevant PMTiles layer highlights (buildings darken, roads thicken, POI dots appear)
- Visual reading cues: "Look at the building footprints on the map — dense, fine-grained patterns indicate a walkable neighborhood"
- No skeletons, no loading indicators — the section has real content

**Phase 2 — COMPUTING (1-15s)**
- Skeleton metric cards appear below the narrative (pushed down, not replacing text)
- Subtle progress indicator: "Analyzing 1,200m radius..."
- The narrative text remains — user reads it while data loads
- Map continues to be interactive

**Phase 3 — RESOLVED (instant transition)**
- Metrics count-up animate into place (replacing skeletons)
- Charts fade in below metrics
- Narrative text can update with data-specific context: "This area has 3,247 buildings — that's high density"
- Chapter score badge appears in section header

## Implementation Plan

### Step 1: Add PMTiles Places Layer
Currently missing! The map shows buildings and roads but NOT POI dots. Adding this gives the Amenities section instant visual content.

**Files:**
- `src/features/map/components/MapContainer.tsx` — add places source + layer

### Step 2: Section Narrative Component
A new component that shows contextual text for each section. This text is the "content" during the visual phase.

**Files:**
- `src/features/sections/components/SectionNarrative.tsx` — narrative text per section
- `src/config/sections.ts` — add `narrative` field to SectionConfig

### Step 3: Enhanced SectionShell with Three Phases
Refactor SectionShell to show narrative first, then metrics below it (not instead of it).

**Files:**
- `src/features/sections/components/SectionShell.tsx` — three-phase rendering

### Step 4: Scroll-Driven Map Layer Transitions
As user scrolls between sections, map layers cross-fade. Uses IntersectionObserver.

**Files:**
- `src/features/sections/hooks/useScrollSpy.ts` — scroll position tracking
- `src/features/sections/components/Sidebar.tsx` — wire scroll spy to map layers

### Step 5: Overview Section with Progressive Chrono Score
The overview section shows the 4 chapter scores as a gauge that fills in progressively as each section resolves.

**Files:**
- `src/features/sections/components/ChronoScore.tsx` — score gauge component
- `src/config/sections.ts` — overview section config

### Step 6: Staggered Query Loading
Don't fire all 3 DuckDB queries at once. Fire them as sections scroll into view. The visual phase provides content while the user hasn't scrolled there yet.

**Files:**
- `src/data/hooks/useSectionData.ts` — trigger on scroll visibility
- `src/features/sections/components/Sidebar.tsx` — IntersectionObserver integration

### Step 7: Real-Time Pedshed Chart Interaction
During drag: use queryRenderedFeatures for instant visual feedback on building/POI counts within the study area. After drag settles: fire DuckDB for exact numbers.

**Files:**
- `src/features/sections/hooks/useVisualMetrics.ts` — PMTiles-derived quick counts
- `src/features/sections/components/Sidebar.tsx` — wire visual metrics during drag

### Step 8: Metric Count-Up Animation
When metrics resolve, numbers animate from 0 to final value over 600ms. Feels alive, not static.

**Files:**
- `src/shared/components/MetricCard.tsx` — add count-up animation
- `src/shared/hooks/useCountUp.ts` — animation hook

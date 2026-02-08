# Chrono Urban Analysis Framework

> Overture Maps Data -> 21 Core Indicators -> 4 Performance Scores -> 1 Master Chrono Score

## Architecture

The framework works as a **pedshed analysis** -- a catchment area (default 1200m / 15-min walk) centered on any point. All metrics are computed in real-time from 4 Overture Maps layers:

| Data Layer | Overture Source | Features |
|-----------|----------------|----------|
| Buildings | `theme=buildings/type=building` | Footprints, heights, floors, subtypes |
| Streets | `theme=transportation/type=segment` | Road network, rail, pedestrian, cycleway |
| Places | `theme=places/type=place` | POIs with categories |
| Land | `theme=base/type=land_use` + `type=land` | Zoning polygons, vegetation cover |

**Hybrid Architecture:**
- **Input:** Overture Maps Vector Tiles (PMTiles) for rendering
- **Geometry:** 15-Minute Isochrone Polygon (calculated via `ngraph` / custom Dijkstra)
- **Compute:** SQL Aggregations via `DuckDB-WASM`

---

## Chapter 1: Urban Fabric (Morphology)

**Question:** *How is the city built? (Form, Density, Efficiency)*

| Indicator | Formula / Logic | Unit | Range | What it measures |
|-----------|----------------|------|-------|-----------------|
| **GSI (Ground Space Index)** | `SUM(footprint_area) / isochrone_area` | -- | 0-1 | Building coverage ratio. >0.5 = Compact; <0.15 = Sprawl |
| **FSI (Floor Space Index)** | `SUM(footprint_area * num_floors) / isochrone_area` | -- | 0-10 | Building intensity. Distinguishes "Tower in Park" from "Courtyards" |
| **OSR (Open Space Ratio)** | `(1 - GSI) / FSI` | -- | 0-5 | Pressure on open space per m2 of floor area. Low = cramped |
| **Building Compactness** | `AVG((4 * PI * area) / perimeter^2)` | -- | 0-1 | Energy efficiency. 1.0 = Circle; <0.4 = Complex/sprawling shapes |
| **Urban Grain** | `MEDIAN(footprint_area)` | m2 | -- | Human scale. <150 = Fine grain (Soho); >1000 = Mega-structures |
| **Fractal Dimension** | `2 * ln(total_perimeter/4) / ln(total_area)` | -- | 1.0-2.0 | Complexity. >1.5 = Mature/Organic; <1.3 = Planned/Artificial |

**Performance Score:** Fabric Score (Balanced Density + High Complexity)

**References:** Berghauser Pont & Haupt (2010), Alexander (1977), Fleischmann et al. (2021), Batty & Longley (1994)

---

## Chapter 2: Land Use & Resilience

**Question:** *Is it mixed, green, and climate-ready?*

| Indicator | Formula / Logic | Unit | Range | What it measures |
|-----------|----------------|------|-------|-----------------|
| **Land Use Mix (Entropy)** | `-SUM(p * ln(p))` normalised | -- | 0-1 | Functional diversity. >0.7 reduces car dependency |
| **Canopy Cover ("The 30")** | `SUM(green_area) / isochrone_area` | % | 0-1 | Cooling. 30% threshold for microclimate cooling (Konijnendijk) |
| **Park Proximity ("The 300")** | `ST_Distance(center, nearest_park)` | m | -- | Mental health. Every home within 300m of park >0.5ha |
| **Imperviousness** | `(building_area + road_area) / isochrone_area` | % | 0-1 | Flood risk. High sealed surfaces = high runoff |
| **Active Frontage** | Ratio of commercial/civic polygons touching street buffer | % | 0-1 | Safety. "Eyes on the street." Blank walls feel unsafe |

**Performance Score:** Resilience Score (Mix + Green + Permeability)

**References:** Song et al. (2013), WHO (2016), White et al. (2020), Konijnendijk (2023)

---

## Chapter 3: Amenities (Vitality)

**Question:** *Can I live here without a car?*

| Indicator | Formula / Logic | Unit | Range | What it measures |
|-----------|----------------|------|-------|-----------------|
| **15-Min Completeness** | `COUNT(DISTINCT category_group)` | -- | 0-6 | Pass/Fail: Food, Health, Edu, Shop, Leisure, Civic |
| **Retail Clustering (ANN)** | `AVG(NearestNeighborDist)` for shops | -- | 0-2 | Viability. Shops need neighbors (agglomeration) |
| **Social Density** | `COUNT(cafe, pub, library, park) / ha` | /ha | 0-50 | "Third Places" build social capital (Oldenburg) |
| **Fresh Food Access** | Distance to nearest supermarket/market | m | -- | Food desert risk. >500m = potential food insecurity |
| **Daily Needs Index** | Weighted sum: grocery + pharmacy + school + transit | -- | 0-100 | Convenience of daily necessities |

**Performance Score:** Vitality Score (Completeness + Clustering)

**Essential Service Categories (15-Min City):**
```
food:      supermarket, grocery, market, bakery
health:    hospital, doctor, pharmacy, clinic
education: school, college_university, library
shopping:  clothing_store, department_store, retail
leisure:   park, sports_and_recreation, entertainment, gym, museum
civic:     government, post_office, bank, professional_services
```

**References:** Ewing & Cervero (2010), Moreno et al. (2021), Oldenburg (1989)

---

## Chapter 4: Network (Connectivity)

**Question:** *Is the grid walkable and efficient?*

| Indicator | Formula / Logic | Unit | Range | What it measures |
|-----------|----------------|------|-------|-----------------|
| **Intersection Density** | `COUNT(nodes_degree > 2) / isochrone_area` | /km2 | 0-200 | Route choice. >100 = walkable grid; <50 = car-dependent |
| **Alpha Score (Efficiency)** | `Area(isochrone) / Area(circle_r1200)` | -- | 0-1 | "Truth Ratio." 1.0 = Perfect grid; <0.4 = Disconnected sprawl |
| **Orientation Entropy** | `Entropy(histogram(segment_bearings))` | -- | 0-1 | Legibility. Low = Grid (navigable); High = Organic/chaotic |
| **SNDi (Dead-End Ratio)** | `COUNT(nodes_degree = 1) / total_nodes` | % | 0-1 | Sprawl indicator. High = forces long detours |
| **Active Transport Share** | `SUM(footway + cycleway) / total_length` | % | 0-1 | Investment priority in non-car infrastructure |

**Performance Score:** Connectivity Score (Density + Efficiency - Dead Ends)

**References:** Marshall (2004), Hillier & Hanson (1984), Boeing (2019), Gehl (2010)

---

## Composite Scores

### Fabric Score (0-100)

| Component | Weight | Metric | Normalization |
|-----------|--------|--------|---------------|
| Density balance | 25% | GSI | Peak at 0.25-0.45 (triangular) |
| Grain quality | 25% | Urban Grain | fine=100, medium=60, coarse=20 |
| Compactness | 25% | Building Compactness | 0.3-0.8 -> 0-100 |
| Complexity | 25% | Fractal Dimension | 1.1-1.8 -> 0-100 |

### Resilience Score (0-100)

| Component | Weight | Metric | Normalization |
|-----------|--------|--------|---------------|
| Mix | 35% | Land Use Entropy | 0.2-0.8 -> 0-100 |
| Green | 35% | Canopy Cover | 0.02-0.30 -> 0-100 |
| Permeability | 30% | 1 - Imperviousness | 0.3-0.8 -> 0-100 |

### Vitality Score (0-100)

| Component | Weight | Metric | Normalization |
|-----------|--------|--------|---------------|
| Completeness | 40% | Categories / 6 | 0-1 -> 0-100 |
| Social density | 30% | Social places / ha | 0.5-10 -> 0-100 |
| Food proximity | 30% | 1 - (distance/1200) | 0-1 -> 0-100 |

### Connectivity Score (0-100)

| Component | Weight | Metric | Normalization |
|-----------|--------|--------|---------------|
| Intersection density | 40% | intersections / km2 | 30-150 -> 0-100 |
| Dead-end penalty | 25% | 1 - dead_end_ratio | 0.5-0.95 -> 0-100 |
| Active transport | 20% | active_share | 0.02-0.30 -> 0-100 |
| Legibility | 15% | 1 - orientation_entropy | 0.3-0.8 -> 0-100 |

### Master Chrono Score (0-100)

| Sub-Score | Weight |
|-----------|--------|
| Fabric Score | 25% |
| Resilience Score | 20% |
| Vitality Score | 30% |
| Connectivity Score | 25% |

**Grading:**
- **A** >= 85 -- Excellent Urban Quality
- **B** >= 70 -- Good
- **C** >= 55 -- Moderate
- **D** >= 40 -- Below Average
- **F** < 40 -- Car-Dependent Area

---

## Implementation Notes

### Overture Feature Column Reference

- **`theme`**: Top-level Overture dataset (e.g., `buildings`)
- **`subtype`**: Discriminator in `base` or `transportation`
- **`class`**: Specific OSM tag mapped to Overture (e.g., `footway`)
- **`connectors`**: Pre-calculated topology in transportation (which lines connect to which nodes)

### Geometry Processing

- All Overture geometry is WKB-encoded: use `ST_GeomFromWKB(geometry)`
- Bbox predicate pushdown first, then circular/isochrone filter
- Use `ST_Area_Spheroid()` and `ST_Length_Spheroid()` for geodetic accuracy
- Building perimeter: `ST_Perimeter_Spheroid(ST_GeomFromWKB(geometry))`

### Data Quality Caveats

- `height` available for ~30-40% of buildings globally
- `num_floors` available for ~20-30%; fallback: `ROUND(height / 3.5)`
- Bus stops NOT in Overture data; transit metrics focus on rail
- Land cover classification varies by region
- POI category taxonomy is evolving across Overture releases

---

## Academic References

1. **Berghauser Pont & Haupt (2010)** -- Spacematrix: density typology (GSI, FSI, OSR)
2. **Alexander (1977)** -- A Pattern Language: urban grain
3. **Fleischmann et al. (2021)** -- Environment and Planning B: morphometric analysis
4. **Batty & Longley (1994)** -- Fractal Cities: fractal dimension, lacunarity
5. **Marshall (2004)** -- Streets and Patterns: network connectivity
6. **Boeing (2019)** -- Urban Spatial Order: street orientation analysis
7. **Ewing & Cervero (2010)** -- Travel and the Built Environment: D-variables
8. **Moreno et al. (2021)** -- 15-Minute City: essential service accessibility
9. **Gehl (2010)** -- Cities for People: human-scale design, active transport
10. **Jacobs (1961)** -- Death and Life of Great American Cities: small blocks, mixed use
11. **WHO (2016)** -- Urban Green Spaces and Health: green infrastructure benchmarks
12. **Song et al. (2013)** -- Land use mix measurement
13. **Konijnendijk (2023)** -- 3-30-300 Rule for urban forestry
14. **Oldenburg (1989)** -- The Great Good Place: third places and social capital

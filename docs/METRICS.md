# Metrics

> Definitions, formulas, and data sources for every metric computed by chrono.city. This document is the reference for implementing metric calculations and for researchers citing chrono.city outputs.

## Metric computation context

All metrics are computed within a **spatial boundary** — either a bounding box (for scroll-driven sections) or an isochrone polygon (for walkability analysis). The boundary is always defined at query time by the user's viewport or click location.

Metrics are computed from **raw features**, not pre-aggregated data. DuckDB-WASM queries individual building footprints, road segments, and POIs from Overture GeoParquet, then aggregates client-side.

## Section: Urban Fabric

Data source: `theme=buildings/type=building`

### Building count

- **Definition:** Total number of building footprints within the boundary.
- **Formula:** `COUNT(*)`
- **Unit:** integer
- **Notes:** Includes all building types. Overture may have duplicate footprints from different sources; deduplication is handled upstream by Overture.

### Total footprint area

- **Definition:** Sum of all building ground-floor footprint areas.
- **Formula:** `SUM(ST_Area(geometry))` in square metres, converted to hectares for display.
- **Unit:** m² (internal), ha (display)
- **Notes:** Uses geodetic area calculation via DuckDB's spatial extension. Accuracy depends on Overture's geometry quality.

### Average footprint area

- **Definition:** Mean building footprint area.
- **Formula:** `AVG(ST_Area(geometry))`
- **Unit:** m²
- **Notes:** Useful for characterising building typology — large footprints suggest commercial/industrial, small suggest residential.

### Footprint area standard deviation

- **Definition:** Variation in building sizes.
- **Formula:** `STDDEV(ST_Area(geometry))`
- **Unit:** m²
- **Notes:** High stddev indicates mixed typology (e.g., houses alongside a shopping centre). Low stddev indicates uniform development.

### Building density

- **Definition:** Ratio of total footprint area to boundary area.
- **Formula:** `total_footprint_area / boundary_area`
- **Unit:** ratio (0-1), displayed as percentage
- **Notes:** Boundary area is computed from the bbox or isochrone polygon. Values above 0.5 indicate very dense urban fabric. Typical European city centres: 0.3-0.5.

### Ground Space Index (GSI)

- **Definition:** Same as building density. Standard urban morphology term.
- **Formula:** `total_footprint_area / boundary_area`
- **Unit:** ratio (0-1)
- **Reference:** Berghauser Pont & Haupt, 2010.

### Floor Space Index (FSI)

- **Definition:** Ratio of total floor space to boundary area. Requires building height or floor count.
- **Formula:** `SUM(footprint_area * num_floors) / boundary_area`
- **Unit:** ratio
- **Notes:** Only computable where Overture has `num_floors` or `height` data. Coverage varies by region. Falls back to estimated floors (`height / 3.5m`) if `num_floors` is missing.
- **Reference:** Berghauser Pont & Haupt, 2010.

### Height distribution

- **Definition:** Distribution of building heights across the boundary.
- **Formula:** histogram of `height` values (where available)
- **Unit:** metres
- **Chart:** histogram with 2m bins
- **Notes:** Many buildings in Overture lack height data. Display coverage percentage alongside the chart.

### Footprint area distribution

- **Definition:** Distribution of building footprint sizes.
- **Formula:** histogram of `ST_Area(geometry)` values
- **Unit:** m²
- **Chart:** histogram with log-scale bins (building sizes follow a power law)

## Section: Street Network

Data source: `theme=transportation/type=segment` and `type=connector`

### Segment count

- **Definition:** Total number of road segments within the boundary.
- **Formula:** `COUNT(*) WHERE subtype = 'road'`
- **Unit:** integer

### Total network length

- **Definition:** Sum of all road segment lengths.
- **Formula:** `SUM(ST_Length(geometry))`
- **Unit:** metres, displayed as km

### Road class distribution

- **Definition:** Breakdown of road segments by Overture `class` attribute.
- **Categories:** motorway, trunk, primary, secondary, tertiary, residential, service, pedestrian, footway, cycleway, path, track, other
- **Formula:** `GROUP BY class`
- **Chart:** horizontal bar chart, ordered by count

### Intersection density

- **Definition:** Number of intersections (connectors with 3+ connecting segments) per unit area.
- **Formula:** `COUNT(connectors with degree >= 3) / boundary_area_km2`
- **Unit:** intersections per km²
- **Notes:** High intersection density (>100/km²) indicates a fine-grained, walkable grid. Low density (<40/km²) indicates large blocks or cul-de-sac patterns.
- **Reference:** Ewing & Cervero, 2010.

### Network connectivity (alpha index)

- **Definition:** Ratio of observed circuits to maximum possible circuits in the network.
- **Formula:** `α = (e - v + p) / (2v - 5p)` where e = edges, v = vertices (degree >= 3), p = connected components
- **Unit:** ratio (0-1)
- **Notes:** Values near 1 indicate a highly connected grid. Values near 0 indicate a tree-like network (cul-de-sacs, dead ends).
- **Reference:** Kansky, 1963.

### Network connectivity (beta index)

- **Definition:** Average number of edges per node.
- **Formula:** `β = e / v`
- **Unit:** ratio
- **Notes:** β = 1 indicates a simple connected graph. β > 1.5 indicates a well-connected urban grid.

### Network connectivity (gamma index)

- **Definition:** Ratio of observed edges to maximum possible edges.
- **Formula:** `γ = e / (3(v - 2))`
- **Unit:** ratio (0-1)

### Dead-end ratio

- **Definition:** Proportion of connectors that are dead ends (degree = 1).
- **Formula:** `COUNT(connectors with degree = 1) / COUNT(all connectors)`
- **Unit:** ratio (0-1)
- **Notes:** High dead-end ratio indicates cul-de-sac suburbs. Low ratio indicates grid or mesh networks.

### Block size (average)

- **Definition:** Average area of city blocks formed by the road network.
- **Formula:** `boundary_area / (intersection_count + 1)` (approximation)
- **Unit:** m²
- **Notes:** Proper block detection requires polygon formation from the network graph. The approximation provides a reasonable estimate. Typical walkable block: 5,000-15,000 m².

### Street orientation entropy

- **Definition:** Measure of how evenly distributed street orientations are. High entropy = grid disorder. Low entropy = regular grid.
- **Formula:** Compute bearing of each segment, bin into 36 bins (10° each, 0-180° due to symmetry), compute Shannon entropy: `H = -Σ(p_i * log(p_i))`
- **Unit:** bits
- **Notes:** Maximum entropy (perfectly uniform orientation) ≈ 3.58 bits. Manhattan-like grids ≈ 1.5-2.0 bits. Organic medieval street patterns ≈ 3.0-3.5 bits.
- **Reference:** Boeing, 2019. "Urban spatial order: street network orientation, configuration, and entropy."
- **Chart:** polar histogram (rose diagram) of street orientations

### Fractal dimension (future)

- **Definition:** Measure of the geometric complexity of the street network.
- **Formula:** Box-counting method on the network geometry. Requires multi-scale analysis.
- **Unit:** dimensionless (1.0-2.0)
- **Notes:** Computationally expensive. Consider pre-computing or computing only on user request.
- **Reference:** Batty & Longley, 1994.

## Section: Amenities

Data source: `theme=places/type=place`

### POI count

- **Definition:** Total number of points of interest within the boundary.
- **Formula:** `COUNT(*)`
- **Unit:** integer

### POI density

- **Definition:** Points of interest per unit area.
- **Formula:** `poi_count / boundary_area_km2`
- **Unit:** POIs per km²

### Category distribution

- **Definition:** Breakdown of POIs by Overture `categories.primary`.
- **Formula:** `GROUP BY categories.primary ORDER BY count DESC`
- **Chart:** treemap or horizontal bar chart, top 15 categories

### Category diversity (Shannon entropy)

- **Definition:** How evenly distributed POI categories are. High entropy = diverse mix. Low entropy = dominated by one category.
- **Formula:** `H = -Σ(p_i * log(p_i))` where p_i = proportion of POIs in category i
- **Unit:** bits
- **Notes:** Normalised to 0-1 by dividing by `log(number_of_categories)`.

### 15-minute city score

- **Definition:** Composite score measuring access to essential services within a 15-minute walk.
- **Formula:** Requires isochrone. Within the 15-minute isochrone, check presence of:
  - Grocery/supermarket
  - Healthcare (pharmacy, clinic, hospital)
  - Education (school, library)
  - Public transport (bus stop, metro station)
  - Green space / park
  - Restaurant / café
  - Sports / recreation
  - Culture (museum, cinema, theatre)
- **Scoring:** Each category present = 1 point. Score = count / 8 categories.
- **Unit:** ratio (0-1), displayed as percentage
- **Notes:** This is a simplified version. Full 15-minute city analysis requires network distance to nearest facility per category, not just presence/absence.
- **Reference:** Moreno et al., 2021. "Introducing the '15-Minute City'."

### Essential services coverage

- **Definition:** Which essential service categories are present within the boundary.
- **Formula:** Boolean check per category from the 15-minute city list.
- **Chart:** Checklist with ✓/✗ per category, or radar chart showing coverage.

## Section: Walkability

Data source: network graph (segments + connectors) + all other themes within isochrone

### Isochrone area

- **Definition:** Area reachable within a given walk time from the origin point.
- **Formula:** Concave hull of all reached connectors → `ST_Area(polygon)`
- **Unit:** m², displayed as ha or km²
- **Time thresholds:** 5 min, 10 min, 15 min (shown as nested polygons)

### Pedshed ratio

- **Definition:** Ratio of the isochrone area to the area of a circle with the same radius (crow-flies distance equivalent).
- **Formula:** `isochrone_area / (π * r²)` where r = walk_speed × time_threshold
- **Unit:** ratio (0-1)
- **Notes:** A pedshed ratio of 1.0 would mean perfect permeability (you can walk in a straight line in every direction). Typical values: 0.2-0.5 for suburbs, 0.4-0.7 for urban areas.
- **Reference:** Porta & Renne, 2005.

### Walk speed assumption

- **Default:** 5 km/h (83.3 m/min)
- **Adjustable:** User can modify in settings
- **Road class modifiers:**
  - Pedestrian/footway: 1.0× (no penalty)
  - Residential: 0.95× (slight crossing delay)
  - Tertiary/secondary: 0.85× (crossing delay)
  - Primary/trunk: 0.7× (major crossing delay)
  - Motorway: excluded (not walkable)

### Reachable buildings

- **Definition:** Number of buildings whose footprint intersects the isochrone polygon.
- **Formula:** DuckDB spatial query: buildings `WHERE ST_Intersects(geometry, isochrone_polygon)`
- **Unit:** integer

### Reachable POIs

- **Definition:** Number of POIs within the isochrone polygon.
- **Formula:** DuckDB spatial query: places `WHERE ST_Within(geometry, isochrone_polygon)`
- **Unit:** integer
- **Chart:** Category breakdown of reachable POIs

### Composite walk score

- **Definition:** A normalised walkability score combining network quality, amenity access, and permeability.
- **Formula:**
  ```
  walk_score = (
    0.3 × normalise(pedshed_ratio) +
    0.3 × normalise(poi_density_in_isochrone) +
    0.2 × normalise(intersection_density) +
    0.2 × normalise(fifteen_min_city_score)
  )
  ```
- **Unit:** 0-100
- **Notes:** Weights are initial estimates. Calibrate against established walkability indices (Walk Score®, etc.) for validation. This is a research metric, not a commercial index.

## Metric computation: where it happens

| Metric | Computed by | Location |
|--------|------------|----------|
| Counts, sums, averages | DuckDB SQL | DuckDB-WASM (browser) |
| Distributions / histograms | DuckDB SQL + JS binning | DuckDB query + TypeScript |
| Intersection density | JS graph analysis | TypeScript (from network graph) |
| Network connectivity indices | JS graph analysis | TypeScript (from network graph) |
| Street orientation entropy | JS bearing computation | TypeScript (from segment geometries) |
| Isochrone polygon | Dijkstra + Turf.js | Web Worker |
| Pedshed ratio | JS area comparison | TypeScript |
| 15-min city score | DuckDB spatial query + JS | Combined |
| Composite walk score | JS weighted formula | TypeScript |

## Data quality notes

- **Building height:** Available for ~30-40% of buildings globally. Coverage higher in Europe, North America. Always display coverage percentage.
- **Building floors:** Available for ~20-30% of buildings. Less reliable than height.
- **POI categories:** Overture's category taxonomy is evolving. Some categories may be inconsistent across regions.
- **Road connectivity:** Overture's connector model is generally reliable but may have topology errors at complex intersections.
- **Coverage gaps:** Overture coverage varies by region. Rural areas may have incomplete building footprints. Always show feature count so users can assess data quality.

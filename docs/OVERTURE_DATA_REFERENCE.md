# Overture Maps Data Reference

> Comprehensive reference of all available Overture Maps data for chrono.city. This document defines every theme, type, property, enum value, PMTiles layer, S3 path, and computable metric. It is the foundation for all data access and analytics implementation.
>
> **Latest release:** `2026-01-21.0` | **Schema:** `v1.15.0` | **Data size:** ~500 GB | **Features:** ~4.2 billion
>
> Overture releases monthly. Only the two most recent releases are kept in public storage.

---

## Table of Contents

1. [Data Access](#data-access)
2. [Theme Overview](#theme-overview)
3. [Shared Properties](#shared-properties)
4. [Theme: Buildings](#theme-buildings)
5. [Theme: Transportation](#theme-transportation)
6. [Theme: Places](#theme-places)
7. [Theme: Base](#theme-base)
8. [Theme: Divisions](#theme-divisions)
9. [Theme: Addresses](#theme-addresses)
10. [PMTiles Layer Details](#pmtiles-layer-details)
11. [Computable Metrics by Section](#computable-metrics-by-section)
12. [DuckDB Query Templates](#duckdb-query-templates)
13. [Data Quality & Coverage](#data-quality--coverage)
14. [Release Management](#release-management)

---

## Data Access

### Constants

```typescript
export const OVERTURE_RELEASE = '2026-01-21.0';
export const OVERTURE_SCHEMA = 'v1.15.0';
export const OVERTURE_S3_BASE = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme`;
export const OVERTURE_AZURE_BASE = `https://overturemapswestus2.blob.core.windows.net/release/${OVERTURE_RELEASE}/theme`;
export const OVERTURE_PMTILES_BASE = `https://tiles.overturemaps.org/${OVERTURE_RELEASE}`;
```

### PMTiles URLs (for MapLibre rendering)

| Theme | URL |
|-------|-----|
| Buildings | `https://tiles.overturemaps.org/2026-01-21.0/buildings.pmtiles` |
| Transportation | `https://tiles.overturemaps.org/2026-01-21.0/transportation.pmtiles` |
| Places | `https://tiles.overturemaps.org/2026-01-21.0/places.pmtiles` |
| Base | `https://tiles.overturemaps.org/2026-01-21.0/base.pmtiles` |
| Divisions | `https://tiles.overturemaps.org/2026-01-21.0/divisions.pmtiles` |
| Addresses | `https://tiles.overturemaps.org/2026-01-21.0/addresses.pmtiles` |

### S3 GeoParquet Paths (for DuckDB-WASM analytics)

| Theme | Type | S3 Path |
|-------|------|---------|
| buildings | building | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=buildings/type=building/*` |
| buildings | building_part | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=buildings/type=building_part/*` |
| transportation | segment | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=transportation/type=segment/*` |
| transportation | connector | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=transportation/type=connector/*` |
| places | place | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=places/type=place/*` |
| base | land_use | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=base/type=land_use/*` |
| base | land | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=base/type=land/*` |
| base | land_cover | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=base/type=land_cover/*` |
| base | water | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=base/type=water/*` |
| base | infrastructure | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=base/type=infrastructure/*` |
| base | bathymetry | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=base/type=bathymetry/*` |
| divisions | division | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=divisions/type=division/*` |
| divisions | division_area | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=divisions/type=division_area/*` |
| divisions | division_boundary | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=divisions/type=division_boundary/*` |
| addresses | address | `s3://overturemaps-us-west-2/release/2026-01-21.0/theme=addresses/type=address/*` |

### DuckDB-WASM Configuration

```typescript
await conn.query("INSTALL httpfs; LOAD httpfs;");
await conn.query("INSTALL spatial; LOAD spatial;");
await conn.query("SET s3_region='us-west-2';");
```

No authentication required. S3 bucket is on AWS Open Data Program (zero egress cost).

### STAC Catalog (programmatic discovery)

```
https://labs.overturemaps.org/stac/catalog.json
```

---

## Theme Overview

| Theme | Types | Total Features | Geometry | Primary Use in chrono.city |
|-------|-------|----------------|----------|---------------------------|
| **buildings** | `building`, `building_part` | ~2.5 billion | Polygon/Multi | Urban fabric metrics, density, morphology |
| **transportation** | `segment`, `connector` | hundreds of millions | LineString, Point | Street network metrics, isochrone graph |
| **places** | `place` | ~72 million | Point | Amenity analysis, 15-min city, POI diversity |
| **base** | `land_use`, `land`, `land_cover`, `water`, `infrastructure`, `bathymetry` | hundreds of millions | Mixed | Land use mix, green space, context layers |
| **divisions** | `division`, `division_area`, `division_boundary` | millions | Point, Polygon, Line | City boundaries, administrative context |
| **addresses** | `address` | hundreds of millions | Point | Address-level geocoding (future) |

---

## Shared Properties

Every Overture feature includes these fields:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | GERS ID — globally unique, stable across releases |
| `geometry` | GeoJSON (WKB in Parquet) | Yes | Use `ST_GeomFromWKB(geometry)` in DuckDB |
| `bbox` | `struct{xmin, xmax, ymin, ymax}` | Yes | WGS84 bounding box for predicate pushdown |
| `theme` | `string` | Yes | Theme name |
| `type` | `string` | Yes | Feature type within theme |
| `version` | `integer` | Yes | Schema version |
| `sources` | `array<struct>` | Varies | `{property, dataset, record_id, confidence}` |

### Names Container (used by most types)

```
names: {
  primary: string              -- Default display name
  common: map<string, string>  -- Language-keyed: {"en": "Tokyo", "ja": "東京"}
  rules: array<struct>         -- Conditional name rules with variant, language, value
}
```

### Bbox Predicate Pushdown (critical for performance)

```sql
WHERE bbox.xmin <= {east}
  AND bbox.xmax >= {west}
  AND bbox.ymin <= {north}
  AND bbox.ymax >= {south}
```

DuckDB reads Parquet row group statistics and skips groups that don't intersect the query bbox. Only matching row groups are downloaded via HTTP range requests.

---

## Theme: Buildings

### Type: `building`

**Geometry:** Polygon | MultiPolygon (footprint/roofprint)

| Property | Type | Required | Description | Analytics Use |
|----------|------|----------|-------------|---------------|
| `id` | `string` | Yes | GERS ID | Deduplication |
| `geometry` | Polygon/Multi | Yes | Building footprint | Area, density, morphology |
| `names` | names container | No | Building name | Display |
| `subtype` | `string` | No | Functional classification | Typology analysis |
| `class` | `string` | No | Detailed building type | Typology analysis |
| `height` | `number` | No | Height in metres | 3D metrics, FSI |
| `num_floors` | `integer` | No | Above-ground floors | FSI, density |
| `num_floors_underground` | `integer` | No | Below-ground floors | Underground analysis |
| `is_underground` | `boolean` | No | Underground building flag | Filtering |
| `has_parts` | `boolean` | No | Has building_part children | 3D detail |
| `level` | `integer` | No | Feature level | Rendering order |

**`subtype` values (13):**
`agricultural`, `civic`, `commercial`, `education`, `entertainment`, `industrial`, `medical`, `military`, `outbuilding`, `religious`, `residential`, `service`, `transportation`

**`class` values (88):**
`agricultural`, `allotment_house`, `apartments`, `barn`, `beach_hut`, `boathouse`, `bridge_structure`, `bungalow`, `bunker`, `cabin`, `carport`, `cathedral`, `chapel`, `church`, `civic`, `college`, `commercial`, `cowshed`, `detached`, `digester`, `dormitory`, `dwelling_house`, `factory`, `farm`, `farm_auxiliary`, `fire_station`, `garage`, `garages`, `ger`, `glasshouse`, `government`, `grandstand`, `greenhouse`, `guardhouse`, `hangar`, `hospital`, `hotel`, `house`, `houseboat`, `hut`, `industrial`, `kindergarten`, `kiosk`, `library`, `manufacture`, `military`, `monastery`, `mosque`, `office`, `outbuilding`, `parking`, `pavilion`, `post_office`, `presbytery`, `public`, `religious`, `residential`, `retail`, `roof`, `school`, `semi`, `semidetached_house`, `service`, `shed`, `shrine`, `silo`, `slurry_tank`, `sports_centre`, `sports_hall`, `stable`, `stadium`, `static_caravan`, `stilt_house`, `storage_tank`, `sty`, `supermarket`, `synagogue`, `temple`, `terrace`, `toilets`, `train_station`, `transformer_tower`, `transportation`, `trullo`, `university`, `warehouse`, `wayside_shrine`

**Data quality:**
- `height`: available for ~30-40% of buildings globally, higher in Europe/North America
- `num_floors`: available for ~20-30% of buildings, less reliable than height
- Fallback: estimate floors as `height / 3.5`

### Type: `building_part`

**Geometry:** Polygon | MultiPolygon

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `building_id` | `string` | Yes | Parent building GERS ID |
| `height` | `number` | No | Part height in metres |
| `num_floors` | `integer` | No | Part floor count |
| `min_height` | `number` | No | Base height (for stacked parts) |
| `min_floor` | `integer` | No | Starting floor |
| `roof_shape` | `string` | No | `dome`, `flat`, `gabled`, etc. |
| `roof_orientation` | `string` | No | `across`, `along` |
| `roof_direction` | `number` | No | Degrees |
| `roof_height` | `number` | No | Roof height in metres |

---

## Theme: Transportation

### Type: `segment`

**Geometry:** LineString (road/rail/waterway centerline)

| Property | Type | Required | Description | Analytics Use |
|----------|------|----------|-------------|---------------|
| `id` | `string` | Yes | GERS ID | Graph edges |
| `geometry` | LineString | Yes | Segment centerline | Length, orientation, graph geometry |
| `subtype` | `string` | Yes | `road`, `rail`, `water` | Filtering |
| `connectors` | `array<struct>` | Yes | `{connector_id, at}` (min 2) | Graph topology |
| `names` | names container | No | Street name | Display |
| `level` | `integer` | No | Z-order | Bridge/tunnel rendering |

#### Road-specific properties (`subtype = 'road'`)

| Property | Type | Required | Description | Analytics Use |
|----------|------|----------|-------------|---------------|
| `class` | `string` | Yes | Road classification | Network hierarchy, walk speed |
| `subclass` | `string` | No | Road sub-classification | Fine-grained analysis |
| `road_surface` | `array<struct>` | No | Surface type | Walk quality |
| `road_flags` | `array<string>` | No | Boolean flags | Bridge/tunnel filtering |
| `speed_limits` | `array<struct>` | No | Speed limits | Drive isochrone |
| `width_rules` | `array<struct>` | No | Width in metres | Street width analysis |
| `access_restrictions` | `array<struct>` | No | Access rules | Walkability filtering |
| `prohibited_transitions` | `array<struct>` | No | Turn restrictions | Routing |
| `destinations` | `array<struct>` | No | Signage info | Navigation |

**Road `class` values (17):**

| Class | Walk Speed Modifier | Description |
|-------|-------------------|-------------|
| `motorway` | Excluded | Limited-access highway |
| `trunk` | 0.7× | Major intercity road |
| `primary` | 0.7× | Major urban road |
| `secondary` | 0.85× | Urban arterial |
| `tertiary` | 0.85× | Urban collector |
| `residential` | 0.95× | Residential street |
| `living_street` | 1.0× | Shared space |
| `unclassified` | 0.95× | Minor road |
| `service` | 0.95× | Access/service road |
| `pedestrian` | 1.0× | Pedestrian zone |
| `footway` | 1.0× | Dedicated footpath |
| `steps` | 0.7× | Stairs |
| `path` | 1.0× | General path |
| `track` | 0.85× | Agricultural/forest track |
| `cycleway` | 0.95× | Dedicated cycle path |
| `bridleway` | 0.85× | Horse path |
| `unknown` | 0.85× | Unclassified |

**Road `subclass` values (7):**
`link`, `sidewalk`, `crosswalk`, `parking_aisle`, `driveway`, `alley`, `cycle_crossing`

**`road_surface` values (7):**
`paved`, `unpaved`, `gravel`, `dirt`, `paving_stones`, `metal`, `unknown`

**`road_flags` values (7):**
`is_bridge`, `is_link`, `is_tunnel`, `is_under_construction`, `is_abandoned`, `is_covered`, `is_indoor`

#### Rail-specific properties (`subtype = 'rail'`)

| Property | Type | Description |
|----------|------|-------------|
| `class` | `string` | Rail classification |
| `rail_flags` | `array<string>` | Boolean flags |

**Rail `class` values (8):**
`funicular`, `light_rail`, `monorail`, `narrow_gauge`, `standard_gauge`, `subway`, `tram`, `unknown`

**`rail_flags` values (8):**
`is_bridge`, `is_tunnel`, `is_under_construction`, `is_abandoned`, `is_covered`, `is_passenger`, `is_freight`, `is_disused`

#### Access Restrictions Structure

```typescript
interface AccessRestriction {
  access_type: 'allowed' | 'denied' | 'designated';
  when?: {
    heading?: 'forward' | 'backward';
    during?: string;           // Opening hours format
    using?: ('as_customer' | 'at_destination' | 'to_deliver' | 'to_farm' | 'for_forestry')[];
    recognized?: ('as_permitted' | 'as_private' | 'as_disabled' | 'as_employee' | 'as_student')[];
    mode?: ('vehicle' | 'motor_vehicle' | 'car' | 'truck' | 'motorcycle' | 'foot' | 'bicycle' | 'bus' | 'hgv' | 'hov' | 'emergency')[];
    vehicle?: {
      dimension: 'axle_count' | 'height' | 'length' | 'weight' | 'width';
      comparison: 'greater_than' | 'greater_than_equal' | 'equal' | 'less_than' | 'less_than_equal';
      value: number;
      unit: string;
    };
  };
}
```

#### Speed Limits Structure

```typescript
interface SpeedLimit {
  min_speed?: { value: number; unit: 'km/h' | 'mph' };
  max_speed?: { value: number; unit: 'km/h' | 'mph' };
  is_max_speed_variable?: boolean;
  when?: ScopingObject;
}
```

#### Connectors Array Structure

```typescript
interface ConnectorRef {
  connector_id: string;  // References a connector feature
  at: number;            // 0.0 = start of segment, 1.0 = end
}
// Every segment has at least 2 connectors (start and end)
```

### Type: `connector`

**Geometry:** Point

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | GERS ID |
| `geometry` | Point | Yes | Connection point |

Connectors are intentionally minimal — purely topological nodes. They define where segments physically intersect or connect. Their degree (number of connecting segments) determines intersection type.

---

## Theme: Places

### Type: `place`

**Geometry:** Point

| Property | Type | Required | Description | Analytics Use |
|----------|------|----------|-------------|---------------|
| `id` | `string` | Yes | GERS ID | Deduplication |
| `geometry` | Point | Yes | POI location | Spatial queries, density |
| `names` | names container | No | Place name | Display |
| `categories` | `struct` | Yes | `{primary, alternate[]}` | Category analysis |
| `basic_category` | `string` | No | Simplified category | Quick classification |
| `taxonomy` | `struct` | No | `{primary, hierarchy[], alternates[]}` | Hierarchical analysis |
| `confidence` | `number` | No | 0.0-1.0 existence confidence | Quality filtering |
| `operating_status` | `string` | Yes | Operating state | Active POI filtering |
| `websites` | `array<string>` | No | Website URLs | Enrichment |
| `socials` | `array<string>` | No | Social media URLs | Enrichment |
| `emails` | `array<string>` | No | Email addresses | Enrichment |
| `phones` | `array<string>` | No | Phone numbers | Enrichment |
| `brand` | `struct` | No | `{names, wikidata}` | Brand analysis |
| `addresses` | `array<struct>` | No | `{freeform, locality, region, country}` | Location context |

**`operating_status` values (3):**
`open`, `permanently_closed`, `temporarily_closed`

**Important:** Always filter `operating_status = 'open'` for active POI analysis. `confidence` is 0 when status is closed.

### Place Categories — Complete Taxonomy (2,117 categories)

#### 22 Top-Level Primary Categories

| # | Category | Subcategories | 15-min City Relevance |
|---|----------|---------------|----------------------|
| 1 | `eat_and_drink` | 227 | Food & drink access |
| 2 | `retail` | 287 | Shopping & daily needs |
| 3 | `professional_services` | 270 | Professional services |
| 4 | `business_to_business` | 238 | Commercial/industrial |
| 5 | `health_and_medical` | 192 | Healthcare |
| 6 | `active_life` | 126 | Sports & fitness |
| 7 | `attractions_and_activities` | 99 | Recreation & culture |
| 8 | `home_service` | 93 | Home maintenance |
| 9 | `arts_and_entertainment` | 85 | Cultural amenities |
| 10 | `travel` | 81 | Transit & travel |
| 11 | `automotive` | 74 | Vehicle services |
| 12 | `education` | 67 | Schools & education |
| 13 | `public_service_and_government` | 66 | Government & civic |
| 14 | `beauty_and_spa` | 41 | Personal care |
| 15 | `financial_service` | 33 | Banking & finance |
| 16 | `real_estate` | 28 | Housing |
| 17 | `pets` | 27 | Pet services |
| 18 | `mass_media` | 23 | Media |
| 19 | `religious_organization` | 19 | Religious institutions |
| 20 | `accommodation` | 18 | Lodging |
| 21 | `structure_and_geography` | 18 | Landmarks |
| 22 | `private_establishments_and_corporates` | 5 | Corporate offices |

#### Key Level-2 Categories (for chrono.city analytics)

**eat_and_drink:** `restaurant`, `bar`, `cafe`

**retail:** `food`, `shopping`, `pharmacy`, `drugstore`, `beverage_store`, `meat_shop`, `seafood_market`, `health_market`

**health_and_medical:** `hospital`, `doctor`, `dentist`, `pharmacy`, `clinic`, `urgent_care_clinic`, `emergency_room`, `community_health_center`, `chiropractor`, `optometrist`

**education:** `school`, `college_university`, `kindergarten`, `specialty_school`, `adult_education`, `tutoring_center`, `educational_services`

**public_service_and_government:** `library`, `post_office`, `fire_department`, `police_department`, `community_center`, `courthouse`, `town_hall`

**active_life:** `sports_and_recreation_venue`, `sports_and_fitness_instruction`, `sports_club_and_league`

**arts_and_entertainment:** `cinema`, `music_venue`, `performing_arts`, `casino`, `comedy_club`, `arcade`

**attractions_and_activities:** `museum`, `park`, `art_gallery`, `aquarium`, `zoo`, `botanical_garden`, `amusement_park`, `beach`, `trail`

**travel:** `airport`, `transportation`, `bus_ticket_agency`, `rental_service`

**religious_organization:** `church_cathedral`, `mosque`, `synagogue`, `buddhist_temple`, `hindu_temple`, `temple`

**accommodation:** `hotel`, `hostel`, `motel`, `campground`, `bed_and_breakfast`

#### 15-Minute City Category Mapping

```typescript
const FIFTEEN_MIN_CATEGORIES: Record<string, string[]> = {
  grocery: ['food', 'supermarket', 'meat_shop', 'seafood_market', 'beverage_store'],
  healthcare: ['hospital', 'doctor', 'dentist', 'pharmacy', 'clinic', 'urgent_care_clinic', 'community_health_center'],
  education: ['school', 'college_university', 'kindergarten', 'library'],
  public_transport: ['airport', 'transportation', 'bus_ticket_agency', 'bus_station', 'bus_stop', 'subway_station', 'railway_station'],
  green_space: ['park', 'botanical_garden', 'nature_reserve', 'trail', 'beach', 'garden'],
  food_drink: ['restaurant', 'cafe', 'bar'],
  sports_recreation: ['sports_and_recreation_venue', 'sports_and_fitness_instruction', 'playground', 'sports_centre'],
  culture: ['museum', 'cinema', 'performing_arts', 'art_gallery', 'cultural_center', 'library'],
};
```

#### New Taxonomy System (schema v1.15.0)

```typescript
interface PlaceTaxonomy {
  primary: string;          // Most specific category
  hierarchy: string[];      // General → specific: ["food_and_drink", "restaurant", "casual_eatery"]
  alternates: string[];     // Additional applicable categories
}
// basic_category: simplified "cognitive" category (e.g., "casual_eatery" for "gas_station_sushi")
```

---

## Theme: Base

### Type: `land_use`

**Geometry:** Point | LineString | Polygon | MultiPolygon

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | Land use classification |
| `class` | `string` | Yes | Detailed land use type |
| `names` | names container | No | Area name |
| `elevation` | `number` | No | Height above sea level |
| `surface` | `string` | No | Physical surface |
| `source_tags` | `map<string,string>` | No | Original OSM tags |

**`subtype` values (24):**
`agriculture`, `aquaculture`, `campground`, `cemetery`, `construction`, `developed`, `education`, `entertainment`, `golf`, `grass`, `horticulture`, `landfill`, `managed`, `medical`, `military`, `park`, `pedestrian`, `protected`, `recreation`, `religious`, `residential`, `resource_extraction`, `transportation`, `winter_sports`

**`class` values (108):** includes:
`residential`, `commercial`, `industrial`, `park`, `cemetery`, `farmland`, `forest`, `school`, `university`, `hospital`, `playground`, `stadium`, `retail`, `garden`, `recreation_ground`, `nature_reserve`, `national_park`, `military`, `quarry`, `zoo`, `marina`, `camp_site`, `allotments`, `vineyard`, `orchard`, `meadow`, `village_green`, `plaza`, ...and 80+ more.

### Type: `land`

**Geometry:** Point | LineString | Polygon | MultiPolygon

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | Natural land classification |
| `class` | `string` | Yes | Detailed land type |
| `names` | names container | No | Feature name |
| `elevation` | `number` | No | Height above sea level |

**`subtype` values (13):**
`crater`, `desert`, `forest`, `glacier`, `grass`, `land`, `physical`, `reef`, `rock`, `sand`, `shrub`, `tree`, `wetland`

**`class` values (41):**
`archipelago`, `bare_rock`, `beach`, `cave_entrance`, `cliff`, `desert`, `dune`, `fell`, `forest`, `glacier`, `grass`, `grassland`, `heath`, `hill`, `island`, `islet`, `land`, `meadow`, `meteor_crater`, `mountain_range`, `peak`, `peninsula`, `plateau`, `reef`, `ridge`, `rock`, `saddle`, `sand`, `scree`, `scrub`, `shingle`, `shrub`, `shrubbery`, `stone`, `tree`, `tree_row`, `tundra`, `valley`, `volcanic_caldera_rim`, `volcano`, `wetland`, `wood`

### Type: `land_cover`

**Geometry:** Polygon | MultiPolygon (satellite-derived, not OSM)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | Land cover classification |
| `cartography` | `struct` | No | `{min_zoom, max_zoom, sort_key}` |

**`subtype` values (10):**
`barren`, `crop`, `forest`, `grass`, `mangrove`, `moss`, `shrub`, `snow`, `urban`, `wetland`

### Type: `water`

**Geometry:** Point | LineString | Polygon | MultiPolygon

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | Water body classification |
| `class` | `string` | Yes | Detailed water type |
| `names` | names container | No | Water body name |
| `is_salt` | `boolean` | No | Salt vs fresh water |
| `is_intermittent` | `boolean` | No | Seasonal water |
| `wikidata` | `string` | No | Wikidata ID |

**`subtype` values (12):**
`canal`, `human_made`, `lake`, `ocean`, `physical`, `pond`, `reservoir`, `river`, `spring`, `stream`, `wastewater`, `water`

**`class` values (36):**
`basin`, `bay`, `blowhole`, `canal`, `cape`, `ditch`, `dock`, `drain`, `fairway`, `fish_pass`, `fishpond`, `geyser`, `hot_spring`, `lagoon`, `lake`, `moat`, `ocean`, `oxbow`, `pond`, `reflecting_pool`, `reservoir`, `river`, `salt_pond`, `sea`, `sewage`, `shoal`, `spring`, `strait`, `stream`, `swimming_pool`, `tidal_channel`, `wastewater`, `water`, `water_storage`, `waterfall`

### Type: `infrastructure`

**Geometry:** Point | LineString | Polygon | MultiPolygon

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | Infrastructure category |
| `class` | `string` | Yes | Detailed infrastructure type |
| `names` | names container | No | Feature name |
| `height` | `number` | No | Height in metres |
| `surface` | `string` | No | Surface material |

**`subtype` values (18):**
`aerialway`, `airport`, `barrier`, `bridge`, `communication`, `emergency`, `manhole`, `pedestrian`, `pier`, `power`, `quay`, `recreation`, `tower`, `transit`, `transportation`, `utility`, `waste_management`, `water`

**`class` values (170+):** includes transit infrastructure critical for chrono.city:
`bus_station`, `bus_stop`, `subway_station`, `railway_station`, `railway_halt`, `ferry_terminal`, `charging_station`, `parking`, `bicycle_parking`, `bicycle_rental`, `traffic_signals`, `pedestrian_crossing`, `street_lamp`, `bench`, `drinking_water`, `toilets`, `recycling`, ...and 150+ more.

### Type: `bathymetry`

**Geometry:** Polygon | MultiPolygon

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `depth` | `number` | Yes | Underwater depth |
| `cartography` | `struct` | No | `{min_zoom, max_zoom, sort_key}` |

---

## Theme: Divisions

### Type: `division`

**Geometry:** Point (approximate location)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | Administrative level |
| `class` | `string` | No | Settlement size (localities only) |
| `names` | names container | Yes | Division name |
| `country` | `string` | Yes | ISO 3166-1 alpha-2 |
| `region` | `string` | No | ISO 3166-2 |
| `population` | `integer` | No | Population count |
| `parent_division_id` | `string` | Conditional | Parent division |
| `hierarchies` | `array<struct>` | Yes | Administrative hierarchy |
| `norms` | `struct` | No | `{driving_side: "left"|"right"}` |
| `wikidata` | `string` | No | Wikidata ID |

**`subtype` values (9):**
`country`, `dependency`, `region`, `county`, `localadmin`, `locality`, `macrohood`, `neighborhood`, `microhood`

**`class` values (5, locality only):**
`megacity`, `city`, `town`, `village`, `hamlet`

### Type: `division_area`

**Geometry:** Polygon | MultiPolygon (administrative boundaries)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | Administrative level |
| `class` | `string` | Yes | `land` or `maritime` |
| `is_land` | `boolean` | Yes | Land boundary |
| `is_territorial` | `boolean` | Yes | Maritime boundary |
| `division_id` | `string` | Yes | Parent division reference |
| `names` | names container | Yes | Area name |
| `country` | `string` | Yes | ISO 3166-1 alpha-2 |

### Type: `division_boundary`

**Geometry:** LineString | MultiLineString

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subtype` | `string` | Yes | `country`, `region`, `county` |
| `class` | `string` | Yes | `land` or `maritime` |
| `division_ids` | `array<string>` | Yes | Left and right divisions (exactly 2) |
| `is_disputed` | `boolean` | No | Disputed boundary flag |

---

## Theme: Addresses

### Type: `address`

**Geometry:** Point

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `country` | `string` | No | ISO 3166-1 alpha-2 |
| `postcode` | `string` | No | Postal code |
| `street` | `string` | No | Street name |
| `number` | `string` | No | House number (may include "74B", "189 1/2") |
| `unit` | `string` | No | Apartment/suite |
| `address_levels` | `array<struct>` | Yes | Administrative divisions (1-5 levels) |
| `postal_city` | `string` | No | Mailing city name |

---

## PMTiles Layer Details

### Buildings PMTiles

| Source Layer | Geometry | Min Zoom | Max Zoom |
|-------------|----------|----------|----------|
| `building` | polygon (3D) | 13 | 14 |
| `building_part` | polygon (3D) | 13 | 14 |

Properties at z14: `id`, `@name`, `class`, `subtype`, `height`, `num_floors`, `has_parts`, `is_underground`, `roof_shape`, `roof_color`, `facade_color`

### Transportation PMTiles

| Source Layer | Geometry | Min Zoom | Max Zoom |
|-------------|----------|----------|----------|
| `segment` | line | 4-14 (by class) | 14 |
| `connector` | point | 13 | 14 |

**Segment min zoom by road class:**

| Class | Min Zoom |
|-------|----------|
| `motorway` | 4 |
| `trunk` | 5 |
| `primary` | 7 |
| `secondary` | 9 |
| `tertiary` | 11 |
| `residential` | 12 |
| `living_street` | 13 |
| All other road classes | 14 |
| Rail (subtype) | 8 |
| Water (subtype) | 10 |

### Places PMTiles

| Source Layer | Geometry | Min Zoom | Max Zoom |
|-------------|----------|----------|----------|
| `place` | point | auto (density-based) | auto |

Properties at all zooms: `@name`, `@category`, `confidence`
Full properties at z14+: `id`, `names`, `categories`, `websites`, `socials`, `phones`, `brand`, `addresses`

### Base PMTiles

| Source Layer | Geometry | Min Zoom | Max Zoom |
|-------------|----------|----------|----------|
| `bathymetry` | polygon | 0 | 13 |
| `infrastructure` | polygon/point/line | 13 | 13 |
| `land` | polygon/point | 0-13 | 13 |
| `land_cover` | polygon | dynamic | dynamic |
| `land_use` | polygon/point/line | 6-13 | 13 |
| `water` | polygon/point | 0-13 | 13 |

### Divisions PMTiles

| Source Layer | Geometry | Min Zoom | Max Zoom |
|-------------|----------|----------|----------|
| `division` | point | 0-10 (by subtype) | 12 |
| `division_area` | polygon | 0-10 (by subtype) | 12 |
| `division_boundary` | line | 0-10 (by subtype) | 12 |

### Key Differences: PMTiles vs GeoParquet

| Aspect | PMTiles | GeoParquet |
|--------|---------|------------|
| Purpose | Rendering | Analytics |
| Geometry | Simplified at low zoom | Full resolution |
| Properties | Subset (expand at max zoom) | All fields |
| Structs | JSON-serialized strings | Native nested Parquet |
| `@name` | Flattened from `names.primary` | Full `names` struct |
| `@category` | Flattened from `categories.primary` | Full `categories` struct |
| Feature count | Density-dropped at low zoom | All features |
| Access | HTTP tile requests | SQL via DuckDB-WASM |

---

## Computable Metrics by Section

### Section: Urban Fabric (buildings)

| Metric | Formula | Unit | DuckDB/JS | Data Quality |
|--------|---------|------|-----------|--------------|
| Building count | `COUNT(*)` | integer | DuckDB | Reliable globally |
| Total footprint area | `SUM(ST_Area(ST_GeomFromWKB(geometry)))` | m² → ha | DuckDB | Reliable |
| Average footprint area | `AVG(ST_Area(ST_GeomFromWKB(geometry)))` | m² | DuckDB | Reliable |
| Footprint area stddev | `STDDEV(ST_Area(ST_GeomFromWKB(geometry)))` | m² | DuckDB | Reliable |
| Building density (GSI) | `total_footprint / boundary_area` | ratio 0-1 | JS | Reliable |
| Floor Space Index (FSI) | `SUM(footprint × num_floors) / boundary_area` | ratio | JS | 20-40% coverage |
| Average height | `AVG(height)` | metres | DuckDB | 30-40% coverage |
| Average floors | `AVG(num_floors)` | count | DuckDB | 20-30% coverage |
| Height coverage % | `COUNT(height IS NOT NULL) / COUNT(*)` | % | DuckDB | Meta-metric |
| Floor coverage % | `COUNT(num_floors IS NOT NULL) / COUNT(*)` | % | DuckDB | Meta-metric |
| Subtype distribution | `GROUP BY subtype` | chart | DuckDB | Variable |
| Class distribution | `GROUP BY class` | chart | DuckDB | Variable |
| Footprint area distribution | histogram of `ST_Area(geometry)` | chart | DuckDB+JS | Reliable |
| Height distribution | histogram of `height` | chart | DuckDB+JS | 30-40% |

### Section: Street Network (transportation)

| Metric | Formula | Unit | DuckDB/JS | Data Quality |
|--------|---------|------|-----------|--------------|
| Segment count | `COUNT(*) WHERE subtype='road'` | integer | DuckDB | Reliable |
| Total network length | `SUM(ST_Length(ST_GeomFromWKB(geometry)))` | m → km | DuckDB | Reliable |
| Road class distribution | `GROUP BY class` | chart | DuckDB | Reliable |
| Intersection density | `COUNT(connectors degree≥3) / area_km²` | per km² | JS (graph) | Reliable |
| Dead-end ratio | `COUNT(degree=1) / COUNT(all)` | ratio 0-1 | JS (graph) | Reliable |
| Alpha index | `(e-v+p) / (2v-5p)` | ratio 0-1 | JS (graph) | Reliable |
| Beta index | `e / v` | ratio | JS (graph) | Reliable |
| Gamma index | `e / (3(v-2))` | ratio 0-1 | JS (graph) | Reliable |
| Street orientation entropy | Shannon entropy of bearing bins | bits | JS | Reliable |
| Average block size | `boundary_area / (intersections+1)` | m² | JS | Approximation |
| Road surface distribution | `GROUP BY road_surface` | chart | DuckDB | Variable |
| Bridge/tunnel count | `COUNT(road_flags contains is_bridge/is_tunnel)` | integer | DuckDB | Reliable |

### Section: Amenities (places)

| Metric | Formula | Unit | DuckDB/JS | Data Quality |
|--------|---------|------|-----------|--------------|
| POI count | `COUNT(*) WHERE operating_status='open'` | integer | DuckDB | Reliable |
| POI density | `poi_count / area_km²` | per km² | JS | Reliable |
| Category distribution | `GROUP BY categories.primary` | chart | DuckDB | Reliable |
| Category diversity (Shannon) | `H = -Σ(p_i × log(p_i))` | bits (normalised 0-1) | JS | Reliable |
| 15-min city score | presence of 8 essential categories in isochrone | ratio 0-1 | JS | Depends on isochrone |
| Essential services coverage | boolean per category | checklist | JS | Depends on coverage |
| Brand diversity | `COUNT(DISTINCT brand.names.primary)` | integer | DuckDB | Variable |
| High-confidence POIs | `COUNT(*) WHERE confidence > 0.8` | integer | DuckDB | Meta-metric |

### Section: Walkability (transportation + all themes)

| Metric | Formula | Unit | DuckDB/JS | Data Quality |
|--------|---------|------|-----------|--------------|
| Isochrone area (5/10/15 min) | concave hull of reached nodes | m² → ha | Web Worker + JS | Reliable |
| Pedshed ratio | `isochrone_area / (π × r²)` | ratio 0-1 | JS | Reliable |
| Reachable buildings | `ST_Intersects(building, isochrone)` | integer | DuckDB | Reliable |
| Reachable POIs | `ST_Within(place, isochrone)` | integer | DuckDB | Reliable |
| Reachable POI categories | `GROUP BY categories.primary` within isochrone | chart | DuckDB | Reliable |
| Composite walk score | weighted formula (pedshed + POI density + intersection density + 15-min score) | 0-100 | JS | Composite |

### Future Sections

| Section | Data Source | Key Metrics |
|---------|-----------|-------------|
| Land Use Mix | `base/land_use` | Land use entropy, residential-commercial ratio, green space % |
| Green Space | `base/land`, `base/land_use` | Park area, tree coverage, green space per capita |
| Water Features | `base/water` | Water body area, waterfront length, blue space access |
| Infrastructure | `base/infrastructure` | Transit stop density, bike parking, EV charging, street furniture |
| Administrative Context | `divisions` | City boundary, population, neighborhood names |

---

## DuckDB Query Templates

### Buildings: Aggregate Metrics

```sql
SELECT
  COUNT(*) as building_count,
  SUM(ST_Area(ST_GeomFromWKB(geometry))) as total_footprint_area_m2,
  AVG(ST_Area(ST_GeomFromWKB(geometry))) as avg_footprint_area_m2,
  STDDEV(ST_Area(ST_GeomFromWKB(geometry))) as stddev_footprint_area_m2,
  MIN(ST_Area(ST_GeomFromWKB(geometry))) as min_footprint_area_m2,
  MAX(ST_Area(ST_GeomFromWKB(geometry))) as max_footprint_area_m2,
  COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
  AVG(height) as avg_height_m,
  MAX(height) as max_height_m,
  COUNT(CASE WHEN num_floors IS NOT NULL THEN 1 END) as buildings_with_floors,
  AVG(num_floors) as avg_floors,
  MAX(num_floors) as max_floors
FROM read_parquet(
  '${OVERTURE_S3_BASE}=buildings/type=building/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
```

### Buildings: Subtype Distribution

```sql
SELECT
  subtype,
  COUNT(*) as count,
  SUM(ST_Area(ST_GeomFromWKB(geometry))) as total_area_m2,
  AVG(height) as avg_height
FROM read_parquet(
  '${OVERTURE_S3_BASE}=buildings/type=building/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
GROUP BY subtype
ORDER BY count DESC
```

### Places: Category Distribution

```sql
SELECT
  categories.primary as primary_category,
  COUNT(*) as count
FROM read_parquet(
  '${OVERTURE_S3_BASE}=places/type=place/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
  AND operating_status = 'open'
GROUP BY categories.primary
ORDER BY count DESC
```

### Transportation: Road Metrics by Class

```sql
SELECT
  class as road_class,
  COUNT(*) as segment_count,
  SUM(ST_Length(ST_GeomFromWKB(geometry))) as total_length_m,
  AVG(ST_Length(ST_GeomFromWKB(geometry))) as avg_segment_length_m
FROM read_parquet(
  '${OVERTURE_S3_BASE}=transportation/type=segment/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
  AND subtype = 'road'
GROUP BY class
ORDER BY total_length_m DESC
```

### Transportation: Network Graph (for Isochrone)

```sql
-- Edges
SELECT
  id,
  class,
  connectors,
  ST_AsGeoJSON(ST_GeomFromWKB(geometry)) as geom_json,
  ST_Length(ST_GeomFromWKB(geometry)) as length_m
FROM read_parquet(
  '${OVERTURE_S3_BASE}=transportation/type=segment/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
  AND subtype = 'road'
  AND (class NOT IN ('motorway') OR class IS NULL)

-- Nodes
SELECT
  id,
  ST_X(ST_GeomFromWKB(geometry)) as lon,
  ST_Y(ST_GeomFromWKB(geometry)) as lat
FROM read_parquet(
  '${OVERTURE_S3_BASE}=transportation/type=connector/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
```

### Land Use: Distribution

```sql
SELECT
  subtype,
  class,
  COUNT(*) as count,
  SUM(ST_Area(ST_GeomFromWKB(geometry))) as total_area_m2
FROM read_parquet(
  '${OVERTURE_S3_BASE}=base/type=land_use/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
GROUP BY subtype, class
ORDER BY total_area_m2 DESC
```

### Infrastructure: Transit Stops

```sql
SELECT
  class,
  COUNT(*) as count,
  ST_X(ST_GeomFromWKB(geometry)) as lon,
  ST_Y(ST_GeomFromWKB(geometry)) as lat
FROM read_parquet(
  '${OVERTURE_S3_BASE}=base/type=infrastructure/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
  AND subtype = 'transit'
  AND class IN ('bus_stop', 'bus_station', 'subway_station', 'railway_station', 'railway_halt', 'ferry_terminal')
GROUP BY class
```

### Divisions: City Context

```sql
SELECT
  names.primary as name,
  subtype,
  class,
  population,
  country,
  region
FROM read_parquet(
  '${OVERTURE_S3_BASE}=divisions/type=division/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${east}
  AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north}
  AND bbox.ymax >= ${south}
  AND subtype IN ('locality', 'localadmin')
ORDER BY population DESC NULLS LAST
LIMIT 5
```

### Query Within Isochrone Polygon

```sql
-- Reachable buildings
SELECT COUNT(*) as reachable_buildings
FROM read_parquet(
  '${OVERTURE_S3_BASE}=buildings/type=building/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${polygon_east}
  AND bbox.xmax >= ${polygon_west}
  AND bbox.ymin <= ${polygon_north}
  AND bbox.ymax >= ${polygon_south}
  AND ST_Intersects(
    ST_GeomFromWKB(geometry),
    ST_GeomFromGeoJSON('${isochrone_geojson}')
  )

-- Reachable POIs by category
SELECT
  categories.primary as category,
  COUNT(*) as count
FROM read_parquet(
  '${OVERTURE_S3_BASE}=places/type=place/*',
  hive_partitioning=1
)
WHERE bbox.xmin <= ${polygon_east}
  AND bbox.xmax >= ${polygon_west}
  AND bbox.ymin <= ${polygon_north}
  AND bbox.ymax >= ${polygon_south}
  AND operating_status = 'open'
  AND ST_Within(
    ST_GeomFromWKB(geometry),
    ST_GeomFromGeoJSON('${isochrone_geojson}')
  )
GROUP BY categories.primary
ORDER BY count DESC
```

---

## Data Quality & Coverage

### Global Coverage by Theme

| Theme | Global Coverage | Best Coverage | Known Gaps |
|-------|----------------|---------------|------------|
| Buildings | Very high | Europe, North America, East Asia | Rural areas, developing regions |
| Places | High (~72M) | North America, Europe | Categories may be inconsistent across regions |
| Transportation | Very high | Global road network | Topology errors at complex intersections |
| Land Use | Moderate | Europe, North America | Sparse in rural/developing areas |
| Divisions | Very high | Administrative boundaries globally | Disputed territories need `perspectives` handling |
| Addresses | Growing | North America, Europe | Many regions incomplete |

### Property Completeness

| Property | Estimated Completeness | Notes |
|----------|----------------------|-------|
| `building.height` | 30-40% globally | Higher in Europe, North America |
| `building.num_floors` | 20-30% globally | Less reliable than height |
| `building.subtype` | Variable | Many buildings untyped |
| `place.confidence` | High | Always present |
| `segment.speed_limits` | Low-moderate | Mainly major roads |
| `segment.road_surface` | Low-moderate | Better in developed regions |
| `division.population` | High for localities | Often missing for neighborhoods |

### Always Display Coverage

For any metric derived from partially-available data (height, floors, etc.), always show the coverage percentage alongside the metric:

```typescript
const heightCoverage = buildings_with_height / building_count;
// Display: "Average height: 12.3m (38% of buildings have height data)"
```

---

## Release Management

### Release Calendar

Overture releases monthly. Only the **two most recent** releases are kept in public S3/Azure storage (GDPR compliance).

| Date | Version | Schema |
|------|---------|--------|
| 21 Jan 2026 | `2026-01-21.0` | `v1.15.0` |
| 17 Dec 2025 | `2025-12-17.0` | `v1.15.0` |

### Updating to a New Release

1. Update `OVERTURE_RELEASE` constant
2. Update all PMTiles URLs
3. Deploy — all cache keys auto-invalidate (version prefix mismatch)
4. On next startup, prune IndexedDB entries with old version prefix

```typescript
// constants.ts — single source of truth
export const OVERTURE_RELEASE = '2026-01-21.0';
```

### STAC Catalog for Programmatic Discovery

```typescript
// Fetch latest release version programmatically
const catalog = await fetch('https://labs.overturemaps.org/stac/catalog.json').then(r => r.json());
const latest = catalog.links.find(l => l.latest === true);
// latest.title = "2026-01-21.0"
```

---

## References

- [Overture Maps Documentation](https://docs.overturemaps.org/)
- [Overture Schema Reference](https://docs.overturemaps.org/schema/)
- [Overture Release Calendar](https://docs.overturemaps.org/release-calendar/)
- [STAC Catalog](https://labs.overturemaps.org/stac/catalog.json)
- [Overture STAC Browser](https://radiantearth.github.io/stac-browser/#/external/labs.overturemaps.org/stac/catalog.json)
- [Overture Tiles Source Code](https://github.com/OvertureMaps/overture-tiles)
- [DuckDB-WASM](https://duckdb.org/docs/api/wasm)
- [PMTiles Specification](https://protomaps.com/docs/pmtiles)

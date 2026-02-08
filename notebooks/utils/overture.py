"""Shared DuckDB setup and helpers for chrono.city metric exploration notebooks."""

from __future__ import annotations

import math
from dataclasses import dataclass

import duckdb


# ---------------------------------------------------------------------------
# Overture release constants
# ---------------------------------------------------------------------------
OVERTURE_RELEASE = "2026-01-21.0"
OVERTURE_S3_BASE = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme"

S3_BUILDINGS = f"{OVERTURE_S3_BASE}=buildings/type=building/*"
S3_SEGMENTS = f"{OVERTURE_S3_BASE}=transportation/type=segment/*"
S3_CONNECTORS = f"{OVERTURE_S3_BASE}=transportation/type=connector/*"
S3_PLACES = f"{OVERTURE_S3_BASE}=places/type=place/*"
S3_LAND_USE = f"{OVERTURE_S3_BASE}=base/type=land_use/*"
S3_LAND_COVER = f"{OVERTURE_S3_BASE}=base/type=land/*"
S3_ADDRESSES = f"{OVERTURE_S3_BASE}=addresses/type=address/*"
S3_DIVISIONS = f"{OVERTURE_S3_BASE}=divisions/type=division/*"
S3_DIVISION_AREAS = f"{OVERTURE_S3_BASE}=divisions/type=division_area/*"
S3_DIVISION_BOUNDARIES = f"{OVERTURE_S3_BASE}=divisions/type=division_boundary/*"
S3_WATER = f"{OVERTURE_S3_BASE}=base/type=water/*"
S3_INFRASTRUCTURE = f"{OVERTURE_S3_BASE}=base/type=infrastructure/*"
S3_BUILDING_PARTS = f"{OVERTURE_S3_BASE}=buildings/type=building_part/*"


# ---------------------------------------------------------------------------
# PMTiles constants
# ---------------------------------------------------------------------------
PMTILES_BASE = f"https://tiles.overturemaps.org/{OVERTURE_RELEASE}"
PMTILES_URLS: dict[str, str] = {
    "buildings": f"{PMTILES_BASE}/buildings.pmtiles",
    "transportation": f"{PMTILES_BASE}/transportation.pmtiles",
    "places": f"{PMTILES_BASE}/places.pmtiles",
    "base": f"{PMTILES_BASE}/base.pmtiles",
    "divisions": f"{PMTILES_BASE}/divisions.pmtiles",
    "addresses": f"{PMTILES_BASE}/addresses.pmtiles",
}

# STAC catalog
STAC_CATALOG_URL = "https://labs.overturemaps.org/stac/catalog.json"


# ---------------------------------------------------------------------------
# Overture theme → type registry
# ---------------------------------------------------------------------------
OVERTURE_THEMES: dict[str, list[str]] = {
    "buildings": ["building", "building_part"],
    "transportation": ["segment", "connector"],
    "places": ["place"],
    "base": ["land_use", "land", "water", "infrastructure"],
    "divisions": ["division", "division_area", "division_boundary"],
    "addresses": ["address"],
}


def s3_path(theme: str, type_name: str) -> str:
    """Return full S3 glob path for an Overture theme/type."""
    return f"{OVERTURE_S3_BASE}={theme}/type={type_name}/*"


def latlng_to_tile(lat: float, lng: float, zoom: int) -> tuple[int, int, int]:
    """Convert lat/lng to tile coordinates (x, y, z) for slippy map tiles."""
    n = 2 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(math.radians(lat)) + 1.0 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y, zoom


# ---------------------------------------------------------------------------
# Metric → Overture column mapping (for EDA coverage analysis)
# ---------------------------------------------------------------------------
METRIC_COLUMN_MAP: dict[str, dict] = {
    # Chapter 1: Urban Fabric
    "GSI (Ground Space Index)": {"theme": "buildings", "type": "building", "columns": ["geometry"], "notes": "footprint area / study area"},
    "FSI (Floor Space Index)": {"theme": "buildings", "type": "building", "columns": ["geometry", "height", "num_floors"], "notes": "total floor area / study area"},
    "OSR (Open Space Ratio)": {"theme": "buildings", "type": "building", "columns": ["geometry", "num_floors"], "notes": "(1 - GSI) / FSI"},
    "Building Compactness": {"theme": "buildings", "type": "building", "columns": ["geometry"], "notes": "4π·area/perimeter²"},
    "Grain Size": {"theme": "buildings", "type": "building", "columns": ["geometry"], "notes": "median footprint area"},
    "Fractal Dimension": {"theme": "buildings", "type": "building", "columns": ["geometry"], "notes": "2·log(perimeter/4)/log(area)"},
    # Chapter 2: Land Use
    "Land-Use Entropy": {"theme": "base", "type": "land_use", "columns": ["geometry", "class", "subtype"], "notes": "Shannon entropy of land-use classes"},
    "Green Ratio": {"theme": "base", "type": "land_use", "columns": ["geometry", "class"], "notes": "green area / study area"},
    "Impervious %": {"theme": "base", "type": "land", "columns": ["geometry", "class"], "notes": "developed land / study area"},
    "Water Proximity": {"theme": "base", "type": "water", "columns": ["geometry"], "notes": "distance to nearest water body"},
    "Canopy Cover": {"theme": "base", "type": "land", "columns": ["geometry", "class"], "notes": "tree/forest area / study area"},
    # Chapter 3: Amenities
    "POI Density": {"theme": "places", "type": "place", "columns": ["geometry", "categories"], "notes": "POIs per hectare"},
    "Category Entropy": {"theme": "places", "type": "place", "columns": ["categories"], "notes": "Shannon entropy of primary categories"},
    "15-min Coverage": {"theme": "places", "type": "place", "columns": ["geometry", "categories"], "notes": "6 essential categories within walk"},
    "Anchor Presence": {"theme": "places", "type": "place", "columns": ["categories"], "notes": "presence of supermarket/school/clinic"},
    "Third-Place Ratio": {"theme": "places", "type": "place", "columns": ["categories"], "notes": "social venues / total POIs"},
    # Chapter 4: Street Network
    "Intersection Density": {"theme": "transportation", "type": "connector", "columns": ["geometry"], "notes": "intersections per km²"},
    "Link-Node Ratio": {"theme": "transportation", "type": ["segment", "connector"], "columns": ["geometry", "connectors"], "notes": "segments / connectors"},
    "Dead-End %": {"theme": "transportation", "type": "connector", "columns": ["geometry"], "notes": "degree-1 nodes / total nodes"},
    "Street Length per ha": {"theme": "transportation", "type": "segment", "columns": ["geometry", "subtype"], "notes": "total road length / area"},
    "Pedestrian Segment %": {"theme": "transportation", "type": "segment", "columns": ["geometry", "class", "subtype"], "notes": "walkable segments / total"},
}


# ---------------------------------------------------------------------------
# City presets — diverse urban morphologies for cross-validation
# ---------------------------------------------------------------------------
@dataclass
class CityPreset:
    name: str
    lat: float
    lng: float
    description: str


CITIES: dict[str, CityPreset] = {
    # ── Canonical reference location ──────────────────────────────────────
    # All notebooks and documentation default to Piccadilly Circus.
    # This gives us a single, consistent study area to validate every query
    # against S3 GeoParquet and PMTiles.  Dense West End fabric, strong
    # transit, rich POI mix — exercises all metrics well.
    "london_piccadilly": CityPreset(
        "London Piccadilly Circus", 51.5099, -0.1337,
        "Canonical reference — West End, dense mixed-use, transit hub",
    ),
    # ── Cross-validation presets ──────────────────────────────────────────
    "london_soho": CityPreset("London Soho", 51.5134, -0.1365, "Fine-grain historic, high POI density"),
    "london_canary": CityPreset("London Canary Wharf", 51.5054, -0.0235, "Tower-in-park, commercial district"),
    "nyc_manhattan": CityPreset("NYC Midtown", 40.7549, -73.9840, "Orthogonal grid, extreme density"),
    "nyc_brooklyn": CityPreset("Brooklyn Heights", 40.6960, -73.9936, "Mixed residential, brownstone fabric"),
    "barcelona_eixample": CityPreset("Barcelona Eixample", 41.3925, 2.1640, "Cerda grid, chamfered blocks"),
    "buenos_aires_centro": CityPreset("Buenos Aires Centro", -34.6037, -58.3816, "Latin American grid, high density"),
    "tokyo_shibuya": CityPreset("Tokyo Shibuya", 35.6580, 139.7016, "Asian megacity, fine grain"),
    "paris_marais": CityPreset("Paris Le Marais", 48.8566, 2.3522, "Historic European, organic layout"),
    "houston_suburbs": CityPreset("Houston Suburbs", 29.7240, -95.5450, "Car-dependent sprawl, cul-de-sacs"),
    "amsterdam_centrum": CityPreset("Amsterdam Centrum", 52.3676, 4.9041, "Canal grid, cycling infrastructure"),
}


# ---------------------------------------------------------------------------
# Reference location — Piccadilly Circus, London
# ---------------------------------------------------------------------------
# Every notebook and doc example defaults to this location.  The 1200 m
# pedshed covers the West End from Mayfair to Covent Garden, Soho to
# St James's — a rich test area that exercises every Overture theme.
#
# Pre-computed reference bbox (1200 m radius, 1.5× buffer):
#   south: 51.493724  north: 51.526076
#   west:  -0.160549  east:  -0.106851
#
# Pre-computed isochrone mock: the circular pedshed itself is the
# "isochrone stand-in" for notebooks.  In the app, this is replaced by
# a true Dijkstra isochrone from the walkable street network.
REFERENCE_CITY = CITIES["london_piccadilly"]
REFERENCE_LAT = REFERENCE_CITY.lat
REFERENCE_LNG = REFERENCE_CITY.lng


# ---------------------------------------------------------------------------
# Pedshed geometry helpers
# ---------------------------------------------------------------------------
DEFAULT_RADIUS_M = 1200  # 15-minute walk at 80m/min


def pedshed_area_m2(radius_m: float = DEFAULT_RADIUS_M) -> float:
    """Area of a circular pedshed in square metres."""
    return math.pi * radius_m ** 2


def pedshed_area_ha(radius_m: float = DEFAULT_RADIUS_M) -> float:
    """Area of a circular pedshed in hectares."""
    return pedshed_area_m2(radius_m) / 10_000


def pedshed_area_km2(radius_m: float = DEFAULT_RADIUS_M) -> float:
    """Area of a circular pedshed in square kilometres."""
    return pedshed_area_m2(radius_m) / 1_000_000


def bbox_from_center(lat: float, lng: float, radius_m: float = DEFAULT_RADIUS_M) -> dict:
    """Generate a bounding box around a center point for predicate pushdown.

    Uses a generous buffer (1.5x radius) to ensure the bbox captures
    all features that might fall within the circular pedshed.
    """
    buffer = radius_m * 1.5
    # Approximate degrees per metre at given latitude
    lat_deg_per_m = 1 / 111_320
    lng_deg_per_m = 1 / (111_320 * math.cos(math.radians(lat)))

    return {
        "south": lat - buffer * lat_deg_per_m,
        "north": lat + buffer * lat_deg_per_m,
        "west": lng - buffer * lng_deg_per_m,
        "east": lng + buffer * lng_deg_per_m,
    }


def bbox_predicate(bbox: dict) -> str:
    """Return SQL WHERE clause for Overture bbox predicate pushdown."""
    return (
        f"bbox.xmin <= {bbox['east']:.6f} "
        f"AND bbox.xmax >= {bbox['west']:.6f} "
        f"AND bbox.ymin <= {bbox['north']:.6f} "
        f"AND bbox.ymax >= {bbox['south']:.6f}"
    )


def pedshed_filter(lat: float, lng: float, radius_m: float = DEFAULT_RADIUS_M) -> str:
    """Return SQL WHERE clause for circular pedshed filter (post-predicate-pushdown).

    Uses ST_DWithin on the Overture geometry column. The bbox predicate
    should be applied FIRST for predicate pushdown, then this filter
    narrows to the actual circle.
    """
    return (
        f"ST_DWithin("
        f"geometry, "
        f"ST_Point({lng:.6f}, {lat:.6f}), "
        f"{radius_m / 111_320:.6f}"  # approximate degrees
        f")"
    )


# ---------------------------------------------------------------------------
# DuckDB connection
# ---------------------------------------------------------------------------
def init_duckdb() -> duckdb.DuckDBPyConnection:
    """Create a DuckDB connection with httpfs and spatial extensions loaded."""
    conn = duckdb.connect()
    conn.execute("INSTALL httpfs; LOAD httpfs;")
    conn.execute("INSTALL spatial; LOAD spatial;")
    conn.execute("SET s3_region='us-west-2';")
    return conn


# ---------------------------------------------------------------------------
# Normalisation helpers (for composite scores)
# ---------------------------------------------------------------------------
def normalize(value: float, min_val: float, max_val: float) -> float:
    """Normalise a value to 0-1 range with clamping."""
    if max_val == min_val:
        return 0.5
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def shannon_entropy(proportions: list[float]) -> float:
    """Compute Shannon entropy from a list of proportions."""
    return -sum(p * math.log2(p) for p in proportions if p > 0)


def normalized_entropy(proportions: list[float]) -> float:
    """Compute Shannon entropy normalised to 0-1."""
    n = len([p for p in proportions if p > 0])
    if n <= 1:
        return 0.0
    h = shannon_entropy(proportions)
    return h / math.log2(n)

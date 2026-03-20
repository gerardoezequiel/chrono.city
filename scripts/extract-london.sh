#!/usr/bin/env bash
# Pre-extract London Soho data for instant demo loading.
# Runs DuckDB CLI queries against Overture S3 and saves results as JSON.
#
# Usage: ./scripts/extract-london.sh
# Requires: duckdb CLI (brew install duckdb)

set -euo pipefail

RELEASE="2026-01-21.0"
S3_BASE="s3://overturemaps-us-west-2/release/${RELEASE}/theme"
OUT_DIR="public/preload"
TMP_DIR=$(mktemp -d)

# London Soho center: lng=-0.130, lat=51.513
# Ring mode, 15 min walk → radius ~1250m → bbox ±0.011°
# Circle bbox: west=-0.141, south=51.502, east=-0.119, north=51.524
# Quantized to 0.005° grid:
WEST="-0.150"
SOUTH="51.500"
EAST="-0.110"
NORTH="51.525"

BBOX_PRED="bbox.xmin <= ${EAST} AND bbox.xmax >= ${WEST} AND bbox.ymin <= ${NORTH} AND bbox.ymax >= ${SOUTH}"

# Cache key components (must match src/data/cache/bbox-quantize.ts)
CACHE_PREFIX="${RELEASE}:${WEST},${SOUTH},${EAST},${NORTH}"

echo "=== Extracting London Soho data ==="
echo "  bbox: [${WEST}, ${SOUTH}, ${EAST}, ${NORTH}]"
echo "  cache prefix: ${CACHE_PREFIX}"
echo ""

# ─── Buildings ────────────────────────────────────────────────────────
echo "[1/3] Querying buildings..."

duckdb -json -c "
  INSTALL httpfs; LOAD httpfs;
  INSTALL spatial; LOAD spatial;
  SET s3_region='us-west-2';

  SELECT
    COUNT(*) as building_count,
    SUM(ST_Area_Spheroid(geometry)) as total_footprint_area_m2,
    AVG(ST_Area_Spheroid(geometry)) as avg_footprint_area_m2,
    COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as buildings_with_height,
    AVG(height) as avg_height_m,
    AVG(num_floors) as avg_floors
  FROM read_parquet('${S3_BASE}=buildings/type=building/*', hive_partitioning=1)
  WHERE ${BBOX_PRED};
" > "${TMP_DIR}/buildings_stats.json"

duckdb -json -c "
  INSTALL httpfs; LOAD httpfs;
  INSTALL spatial; LOAD spatial;
  SET s3_region='us-west-2';

  SELECT COALESCE(subtype, 'unknown') as building_type, COUNT(*) as cnt
  FROM read_parquet('${S3_BASE}=buildings/type=building/*', hive_partitioning=1)
  WHERE ${BBOX_PRED}
  GROUP BY 1
  ORDER BY cnt DESC;
" > "${TMP_DIR}/buildings_types.json"

echo "  ✓ Buildings done"

# ─── Transport ────────────────────────────────────────────────────────
echo "[2/3] Querying transport..."

duckdb -json -c "
  INSTALL httpfs; LOAD httpfs;
  INSTALL spatial; LOAD spatial;
  SET s3_region='us-west-2';

  SELECT
    class as road_class,
    COUNT(*) as segment_count,
    SUM(ST_Length_Spheroid(geometry)) as total_length_m
  FROM read_parquet('${S3_BASE}=transportation/type=segment/*', hive_partitioning=1)
  WHERE ${BBOX_PRED}
    AND subtype = 'road'
  GROUP BY class
  ORDER BY total_length_m DESC;
" > "${TMP_DIR}/transport.json"

echo "  ✓ Transport done"

# ─── Places ───────────────────────────────────────────────────────────
echo "[3/3] Querying places..."

duckdb -json -c "
  INSTALL httpfs; LOAD httpfs;
  INSTALL spatial; LOAD spatial;
  SET s3_region='us-west-2';

  SELECT
    categories.primary as primary_category,
    COUNT(*) as count
  FROM read_parquet('${S3_BASE}=places/type=place/*', hive_partitioning=1)
  WHERE ${BBOX_PRED}
  GROUP BY categories.primary
  ORDER BY count DESC;
" > "${TMP_DIR}/places.json"

echo "  ✓ Places done"

# ─── Assemble bundle with Python ─────────────────────────────────────
echo ""
echo "Assembling ${OUT_DIR}/london.json..."

TMP_DIR="${TMP_DIR}" OUT_DIR="${OUT_DIR}" CACHE_PREFIX="${CACHE_PREFIX}" RELEASE="${RELEASE}" python3 << 'PYEOF'
import json, os, sys

tmp = os.environ["TMP_DIR"]
out = os.environ["OUT_DIR"]
prefix = os.environ["CACHE_PREFIX"]

# Read raw DuckDB JSON outputs
with open(f"{tmp}/buildings_stats.json") as f:
    bstats = json.load(f)
with open(f"{tmp}/buildings_types.json") as f:
    btypes = json.load(f)
with open(f"{tmp}/transport.json") as f:
    trows = json.load(f)
with open(f"{tmp}/places.json") as f:
    prows = json.load(f)

# ─── Build buildings result ───
r = bstats[0] if bstats else {}
type_dist = {}
for t in btypes:
    type_dist[t["building_type"]] = t["cnt"]

bc = r.get("building_count", 0)
bwh = r.get("buildings_with_height", 0)
buildings = {
    "buildingCount": bc,
    "totalFootprintAreaM2": r.get("total_footprint_area_m2", 0),
    "avgFootprintAreaM2": r.get("avg_footprint_area_m2", 0),
    "buildingsWithHeight": bwh,
    "avgHeightM": r.get("avg_height_m"),
    "avgFloors": r.get("avg_floors"),
    "heightCoverage": bwh / bc if bc > 0 else 0,
    "buildingTypeDistribution": type_dist,
}

# ─── Build transport result ───
road_dist = {}
total_seg = 0
total_len_m = 0
for row in trows:
    cls = row.get("road_class") or "unknown"
    cnt = row["segment_count"]
    road_dist[cls] = cnt
    total_seg += cnt
    total_len_m += row["total_length_m"]

transport = {
    "segmentCount": total_seg,
    "totalLengthKm": total_len_m / 1000.0,
    "roadClassDistribution": road_dist,
}

# ─── Build places result ───
cat_dist = {}
total_pois = 0
for row in prows:
    cat = row.get("primary_category") or "uncategorized"
    cnt = row["count"]
    cat_dist[cat] = cnt
    total_pois += cnt

top_cats = sorted(cat_dist.items(), key=lambda x: -x[1])[:10]
top_categories = [{"category": c, "count": n} for c, n in top_cats]

# 15-minute city classification
CATEGORY_MAP = {
    "restaurant": "Food & Drink", "cafe": "Food & Drink", "bar": "Food & Drink",
    "fast_food_restaurant": "Food & Drink", "bakery": "Food & Drink",
    "grocery_store": "Food & Drink", "supermarket": "Food & Drink",
    "coffee_shop": "Food & Drink", "pub": "Food & Drink", "deli": "Food & Drink",
    "ice_cream_shop": "Food & Drink", "juice_bar": "Food & Drink",
    "pizza_restaurant": "Food & Drink", "seafood_restaurant": "Food & Drink",
    "sushi_restaurant": "Food & Drink", "burger_restaurant": "Food & Drink",
    "mexican_restaurant": "Food & Drink", "chinese_restaurant": "Food & Drink",
    "indian_restaurant": "Food & Drink", "italian_restaurant": "Food & Drink",
    "thai_restaurant": "Food & Drink", "vietnamese_restaurant": "Food & Drink",
    "japanese_restaurant": "Food & Drink", "korean_restaurant": "Food & Drink",
    "food_truck": "Food & Drink", "wine_bar": "Food & Drink",
    "cocktail_bar": "Food & Drink", "lounge": "Food & Drink",
    "tea_room": "Food & Drink", "breakfast_restaurant": "Food & Drink",
    "hospital": "Health", "pharmacy": "Health", "dentist": "Health",
    "doctor": "Health", "clinic": "Health", "veterinarian": "Health",
    "optician": "Health", "medical_center": "Health",
    "school": "Education", "university": "Education", "kindergarten": "Education",
    "college": "Education", "library": "Education", "language_school": "Education",
    "preschool": "Education", "music_school": "Education",
    "clothing_store": "Shopping", "convenience_store": "Shopping",
    "shopping_mall": "Shopping", "department_store": "Shopping",
    "shoe_store": "Shopping", "electronics_store": "Shopping",
    "bookstore": "Shopping", "hardware_store": "Shopping", "pet_store": "Shopping",
    "jewelry_store": "Shopping", "gift_shop": "Shopping", "florist": "Shopping",
    "market": "Shopping", "furniture_store": "Shopping",
    "park": "Leisure & Sport", "gym": "Leisure & Sport", "playground": "Leisure & Sport",
    "swimming_pool": "Leisure & Sport", "fitness_center": "Leisure & Sport",
    "yoga_studio": "Leisure & Sport", "spa": "Leisure & Sport",
    "sports_club": "Leisure & Sport", "recreation_center": "Leisure & Sport",
    "post_office": "Civic Services", "police_station": "Civic Services",
    "fire_station": "Civic Services", "government_office": "Civic Services",
    "community_center": "Civic Services", "courthouse": "Civic Services",
    "museum": "Culture", "art_gallery": "Culture", "theater": "Culture",
    "cinema": "Culture", "concert_hall": "Culture", "cultural_center": "Culture",
    "historic_site": "Culture", "nightclub": "Culture", "music_venue": "Culture",
    "religious_organization": "Culture", "place_of_worship": "Culture",
    "bus_station": "Transport", "train_station": "Transport",
    "subway_station": "Transport", "tram_stop": "Transport",
    "taxi_stand": "Transport", "bike_rental": "Transport",
    "car_rental": "Transport", "parking_lot": "Transport",
    "gas_station": "Transport", "charging_station": "Transport",
    "transportation_service": "Transport", "travel_agency": "Transport",
}
GROUPS = ["Food & Drink", "Health", "Education", "Shopping", "Leisure & Sport", "Civic Services", "Culture", "Transport"]
found = set()
for cat, count in cat_dist.items():
    if count > 0 and cat in CATEGORY_MAP:
        found.add(CATEGORY_MAP[cat])

places = {
    "poiCount": total_pois,
    "uniqueCategories": len(cat_dist),
    "categoryDistribution": cat_dist,
    "topCategories": top_categories,
    "fifteenMinCategories": {g: g in found for g in GROUPS},
}

# ─── Write bundle ───
bundle = {
    "version": os.environ["RELEASE"],
    "center": {"lat": 51.513, "lng": -0.130},
    "entries": {
        f"{prefix}:buildings": buildings,
        f"{prefix}:network": transport,
        f"{prefix}:amenities": places,
    }
}

os.makedirs(out, exist_ok=True)
with open(f"{out}/london.json", "w") as f:
    json.dump(bundle, f, separators=(",", ":"))

size = os.path.getsize(f"{out}/london.json")
print(f"  ✓ Written {size:,} bytes")
for key in bundle["entries"]:
    print(f"  Key: {key}")
PYEOF

rm -rf "${TMP_DIR}"

echo ""
echo "=== Done! Pre-extracted London data ready for demo ==="

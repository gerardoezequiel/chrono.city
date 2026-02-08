import marimo

__generated_with = "0.10.0"
app = marimo.App(width="medium")


# ---------------------------------------------------------------------------
# Cell 1 — Imports
# ---------------------------------------------------------------------------
@app.cell
def _():
    import marimo as mo
    import sys, os, math
    import polars as pl
    import altair as alt

    # Ensure the notebooks/ directory is on the path so we can import utils
    _nb_dir = os.path.dirname(os.path.abspath("__file__"))
    if _nb_dir not in sys.path:
        sys.path.insert(0, _nb_dir)

    from utils.overture import (
        init_duckdb,
        CITIES,
        S3_PLACES,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_ha,
        normalized_entropy,
        DEFAULT_RADIUS_M,
    )

    return (
        mo,
        sys,
        os,
        math,
        pl,
        alt,
        init_duckdb,
        CITIES,
        S3_PLACES,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_ha,
        normalized_entropy,
        DEFAULT_RADIUS_M,
    )


# ---------------------------------------------------------------------------
# Cell 2 — DuckDB init
# ---------------------------------------------------------------------------
@app.cell
def _(init_duckdb, mo):
    conn = init_duckdb()
    mo.md("**DuckDB** initialised with `httpfs` + `spatial` extensions.")
    return (conn,)


# ---------------------------------------------------------------------------
# Cell 3 — Essential categories mapping
# ---------------------------------------------------------------------------
@app.cell
def _():
    ESSENTIAL_CATEGORIES = {
        "food": [
            "supermarket", "grocery", "market", "butcher", "bakery",
            "greengrocer", "food",
        ],
        "health": [
            "hospital", "doctor", "dentist", "pharmacy", "clinic",
            "health_and_medical",
        ],
        "education": [
            "school", "college_university", "kindergarten", "library",
            "education",
        ],
        "shopping": [
            "shopping", "clothing_store", "department_store",
            "shopping_mall", "retail",
        ],
        "leisure": [
            "park", "sports_and_recreation", "entertainment", "gym",
            "museum", "cinema",
        ],
        "civic": [
            "government", "post_office", "bank",
            "professional_services", "community_center",
        ],
    }
    return (ESSENTIAL_CATEGORIES,)


# ---------------------------------------------------------------------------
# Cell 4 — City selector and radius slider
# ---------------------------------------------------------------------------
@app.cell
def _(mo, CITIES, DEFAULT_RADIUS_M):
    city_options = {
        f"{preset.name} -- {preset.description}": key
        for key, preset in CITIES.items()
    }
    _default = CITIES["london_piccadilly"]
    city_dropdown = mo.ui.dropdown(
        options=city_options,
        value=f"{_default.name} -- {_default.description}",
        label="City preset",
    )
    radius_slider = mo.ui.slider(
        start=400,
        stop=2000,
        step=100,
        value=DEFAULT_RADIUS_M,
        label="Pedshed radius (m)",
    )
    mo.md(f"""
## Ch 3 -- Amenities (Vitality)

Select a city and pedshed radius to compute 5 amenity metrics
from Overture Maps *places* data.

{city_dropdown}

{radius_slider}
""")
    return (city_dropdown, radius_slider)


# ---------------------------------------------------------------------------
# Cell 5 — Compute bbox and pedshed parameters
# ---------------------------------------------------------------------------
@app.cell
def _(
    city_dropdown,
    radius_slider,
    CITIES,
    bbox_from_center,
    pedshed_area_ha,
    mo,
):
    _city_key = city_dropdown.value
    _city = CITIES[_city_key]
    _radius = radius_slider.value

    center_lat = _city.lat
    center_lng = _city.lng
    study_radius = _radius
    study_bbox = bbox_from_center(center_lat, center_lng, study_radius)
    study_area_ha = pedshed_area_ha(study_radius)

    mo.md(f"""
**{_city.name}** -- {_city.description}

| Parameter | Value |
|-----------|-------|
| Center | {center_lat:.4f}, {center_lng:.4f} |
| Radius | {study_radius} m |
| Study area | {study_area_ha:.1f} ha |
| Bbox S/N | {study_bbox['south']:.4f} / {study_bbox['north']:.4f} |
| Bbox W/E | {study_bbox['west']:.4f} / {study_bbox['east']:.4f} |
""")
    return (
        center_lat,
        center_lng,
        study_radius,
        study_bbox,
        study_area_ha,
    )


# ---------------------------------------------------------------------------
# Cell 6 — Places query
# ---------------------------------------------------------------------------
@app.cell
def _(
    conn,
    center_lat,
    center_lng,
    study_radius,
    study_bbox,
    S3_PLACES,
    bbox_predicate,
    pedshed_filter,
    pl,
    mo,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _ped_filter = pedshed_filter(center_lat, center_lng, study_radius)

    _sql = f"""
    SELECT
        id,
        categories.primary AS primary_category,
        ST_X(geometry) AS lng,
        ST_Y(geometry) AS lat,
        ST_Distance_Spheroid(
            geometry,
            ST_Point({center_lng:.6f}, {center_lat:.6f})
        ) AS distance_m
    FROM read_parquet('{S3_PLACES}', hive_partitioning=1)
    WHERE {_bbox_pred}
      AND {_ped_filter}
    """

    mo.md(f"Querying places for **{study_radius} m** pedshed ...")
    places_df = conn.execute(_sql).pl()
    place_count = len(places_df)

    mo.md(f"Fetched **{place_count:,}** places within the pedshed.")
    return (places_df, place_count)


# ---------------------------------------------------------------------------
# Cell 7 — Metric 1: 15-Minute Completeness
# ---------------------------------------------------------------------------
@app.cell
def _(places_df, ESSENTIAL_CATEGORIES, pl, mo):
    # Map each POI to an essential group
    _cat_list = places_df["primary_category"].to_list()
    _reverse_map = {}
    for group, keywords in ESSENTIAL_CATEGORIES.items():
        for kw in keywords:
            _reverse_map[kw] = group

    matched_groups = set()
    essential_group_counts = {g: 0 for g in ESSENTIAL_CATEGORIES}
    for _cat in _cat_list:
        if _cat is not None:
            _g = _reverse_map.get(_cat.lower())
            if _g is not None:
                matched_groups.add(_g)
                essential_group_counts[_g] += 1

    groups_present = len(matched_groups)
    completeness_score = groups_present / 6.0

    # Build display
    _rows = []
    for g in ESSENTIAL_CATEGORIES:
        _status = "Present" if g in matched_groups else "**MISSING**"
        _rows.append(f"| {g.title()} | {essential_group_counts[g]} | {_status} |")

    _missing_names = [
        g.title() for g in ESSENTIAL_CATEGORIES if g not in matched_groups
    ]

    mo.md(f"""
### Metric 1: 15-Minute Completeness

Score = essential groups present / 6 = **{groups_present} / 6 = {completeness_score:.2f}**

| Essential Group | POI Count | Status |
|-----------------|----------:|--------|
{chr(10).join(_rows)}

{"All 6 essential categories are present within the pedshed." if groups_present == 6
else f"Missing categories: **{', '.join(_missing_names)}**"}
""")
    return (completeness_score, groups_present, essential_group_counts, matched_groups)


# ---------------------------------------------------------------------------
# Cell 8 — Metric 2: Social Density
# ---------------------------------------------------------------------------
@app.cell
def _(places_df, study_area_ha, pl, mo):
    SOCIAL_CATEGORIES = [
        "cafe", "pub", "bar", "restaurant", "library",
        "community_center", "park",
    ]

    social_places_df = places_df.filter(
        pl.col("primary_category")
        .str.to_lowercase()
        .is_in(SOCIAL_CATEGORIES)
    )
    social_count = len(social_places_df)
    social_density = social_count / study_area_ha if study_area_ha > 0 else 0.0

    if social_density > 2.0:
        _interpretation = "Vibrant social fabric (> 2 per ha)"
    elif social_density >= 0.5:
        _interpretation = "Moderate social activity"
    else:
        _interpretation = "Dormitory-like -- low social infrastructure (< 0.5 per ha)"

    mo.md(f"""
### Metric 2: Social Density

Social places (cafe, pub, bar, restaurant, library, community_center, park)
within the pedshed.

| Measure | Value |
|---------|-------|
| Social POI count | {social_count} |
| Pedshed area | {study_area_ha:.1f} ha |
| **Social density** | **{social_density:.2f} per ha** |
| Interpretation | {_interpretation} |
""")
    return (social_density, social_count)


# ---------------------------------------------------------------------------
# Cell 9 — Metric 3: Fresh Food Access
# ---------------------------------------------------------------------------
@app.cell
def _(places_df, pl, mo):
    FRESH_FOOD_CATEGORIES = ["supermarket", "grocery", "market"]

    fresh_food_df = places_df.filter(
        pl.col("primary_category")
        .str.to_lowercase()
        .is_in(FRESH_FOOD_CATEGORIES)
    )
    fresh_food_count = len(fresh_food_df)

    if fresh_food_count > 0:
        nearest_food_distance = fresh_food_df["distance_m"].min()
    else:
        nearest_food_distance = None

    if nearest_food_distance is None:
        _food_flag = "**FOOD DESERT** -- no supermarket/grocery/market found in pedshed"
    elif nearest_food_distance > 500:
        _food_flag = f"**Food desert risk** -- nearest fresh food at {nearest_food_distance:.0f} m (> 500 m threshold)"
    else:
        _food_flag = f"Good access -- nearest fresh food at {nearest_food_distance:.0f} m (<= 500 m)"

    mo.md(f"""
### Metric 3: Fresh Food Access

Nearest supermarket, grocery, or market within the pedshed.

| Measure | Value |
|---------|-------|
| Fresh food POIs found | {fresh_food_count} |
| Nearest distance | {f'{nearest_food_distance:.0f} m' if nearest_food_distance is not None else 'N/A'} |
| **Assessment** | {_food_flag} |
""")
    return (nearest_food_distance, fresh_food_count)


# ---------------------------------------------------------------------------
# Cell 10 — Metric 4: Daily Needs Index
# ---------------------------------------------------------------------------
@app.cell
def _(places_df, pl, mo):
    # Weighted count of daily-need POIs, normalised to 0-100
    DAILY_WEIGHTS = {
        "grocery": 2.0,
        "supermarket": 2.0,
        "market": 2.0,
        "pharmacy": 2.0,
        "school": 1.5,
        "kindergarten": 1.5,
        "college_university": 1.5,
        "bus_station": 1.0,
        "train_station": 1.0,
        "subway_station": 1.0,
        "public_transportation": 1.0,
    }

    _cats = places_df["primary_category"].to_list()
    _raw_score = 0.0
    for _cat in _cats:
        if _cat is not None:
            _w = DAILY_WEIGHTS.get(_cat.lower(), 0.0)
            _raw_score += _w

    # Normalise: assume 50 weighted points = score of 100 (saturation point)
    _saturation = 50.0
    daily_needs_index = min((_raw_score / _saturation) * 100.0, 100.0)

    mo.md(f"""
### Metric 4: Daily Needs Index

Weighted count of daily-need POIs (grocery x2, pharmacy x2, school x1.5,
transit x1), normalised to 0-100.

| Measure | Value |
|---------|-------|
| Raw weighted score | {_raw_score:.1f} |
| Saturation point | {_saturation:.0f} |
| **Daily Needs Index** | **{daily_needs_index:.1f} / 100** |

*Weight scheme: grocery/supermarket/market/pharmacy = 2x, school/kindergarten = 1.5x, transit = 1x.*
""")
    return (daily_needs_index,)


# ---------------------------------------------------------------------------
# Cell 11 — Metric 5: Retail Clustering (Average Nearest Neighbour)
# ---------------------------------------------------------------------------
@app.cell
def _(places_df, study_area_ha, pl, math, mo):
    RETAIL_CATEGORIES = [
        "shopping", "clothing_store", "department_store",
        "shopping_mall", "retail", "supermarket", "grocery",
        "convenience_store", "store",
    ]

    retail_df = places_df.filter(
        pl.col("primary_category")
        .str.to_lowercase()
        .is_in(RETAIL_CATEGORIES)
    )
    retail_count = len(retail_df)

    if retail_count >= 2:
        # Extract coordinates
        _lngs = retail_df["lng"].to_list()
        _lats = retail_df["lat"].to_list()
        _n = len(_lngs)

        # Compute nearest neighbour distance for each point (in degrees, convert to approx metres)
        # Use mean latitude for degree-to-metre conversion
        _mean_lat = sum(_lats) / _n
        _lat_m = 111_320.0
        _lng_m = 111_320.0 * math.cos(math.radians(_mean_lat))

        _nn_distances = []
        for _i in range(_n):
            _min_d = float("inf")
            for _j in range(_n):
                if _i == _j:
                    continue
                _dx = (_lngs[_j] - _lngs[_i]) * _lng_m
                _dy = (_lats[_j] - _lats[_i]) * _lat_m
                _d = math.sqrt(_dx * _dx + _dy * _dy)
                if _d < _min_d:
                    _min_d = _d
            _nn_distances.append(_min_d)

        # Observed mean nearest neighbour distance
        observed_ann = sum(_nn_distances) / _n

        # Expected mean nearest neighbour distance for random distribution
        # E(d) = 0.5 * sqrt(A/n), where A is area in m^2
        _area_m2 = study_area_ha * 10_000
        expected_ann = 0.5 * math.sqrt(_area_m2 / _n)

        # ANN ratio
        ann_ratio = observed_ann / expected_ann if expected_ann > 0 else 1.0

        if ann_ratio < 1.0:
            _cluster_interpretation = f"Clustered (ratio {ann_ratio:.3f} < 1.0) -- retail agglomeration detected"
        elif ann_ratio > 1.0:
            _cluster_interpretation = f"Dispersed (ratio {ann_ratio:.3f} > 1.0) -- retail is spread out"
        else:
            _cluster_interpretation = "Random distribution (ratio ~ 1.0)"
    else:
        observed_ann = None
        expected_ann = None
        ann_ratio = None
        _cluster_interpretation = "Insufficient retail POIs (< 2) to compute ANN"

    mo.md(f"""
### Metric 5: Retail Clustering (Average Nearest Neighbour)

Compares the observed mean nearest-neighbour distance among retail/shopping
POIs to the expected distance under a random spatial distribution.

| Measure | Value |
|---------|-------|
| Retail POIs | {retail_count} |
| Observed mean NN distance | {f'{observed_ann:.1f} m' if observed_ann is not None else 'N/A'} |
| Expected random NN distance | {f'{expected_ann:.1f} m' if expected_ann is not None else 'N/A'} |
| **ANN Ratio** | {f'**{ann_ratio:.3f}**' if ann_ratio is not None else 'N/A'} |
| Interpretation | {_cluster_interpretation} |

*Ratio < 1 = clustered, = 1 = random, > 1 = dispersed.*
""")
    return (ann_ratio, observed_ann, expected_ann, retail_count)


# ---------------------------------------------------------------------------
# Cell 12 — Summary table (all 5 metrics)
# ---------------------------------------------------------------------------
@app.cell
def _(
    completeness_score,
    groups_present,
    social_density,
    nearest_food_distance,
    daily_needs_index,
    ann_ratio,
    city_dropdown,
    radius_slider,
    CITIES,
    pl,
    mo,
):
    _city = CITIES[city_dropdown.value]

    # Interpret completeness
    if completeness_score >= 1.0:
        _compl_interp = "Full 15-min city coverage"
    elif completeness_score >= 0.67:
        _compl_interp = "Good coverage, minor gaps"
    else:
        _compl_interp = "Significant gaps in essential services"

    # Interpret social density
    if social_density > 2.0:
        _social_interp = "Vibrant social fabric"
    elif social_density >= 0.5:
        _social_interp = "Moderate"
    else:
        _social_interp = "Dormitory-like"

    # Interpret food access
    if nearest_food_distance is None:
        _food_interp = "Food desert -- no fresh food POI"
    elif nearest_food_distance > 500:
        _food_interp = "Food desert risk (> 500 m)"
    else:
        _food_interp = "Good access (<= 500 m)"

    # Interpret daily needs
    if daily_needs_index >= 75:
        _daily_interp = "Excellent daily services"
    elif daily_needs_index >= 40:
        _daily_interp = "Adequate"
    else:
        _daily_interp = "Under-served"

    # Interpret ANN
    if ann_ratio is None:
        _ann_interp = "Insufficient data"
    elif ann_ratio < 0.8:
        _ann_interp = "Strongly clustered"
    elif ann_ratio < 1.0:
        _ann_interp = "Mildly clustered"
    elif ann_ratio > 1.2:
        _ann_interp = "Dispersed"
    else:
        _ann_interp = "Near random"

    summary_df = pl.DataFrame({
        "Metric": [
            "15-Min Completeness",
            "Social Density",
            "Fresh Food Access",
            "Daily Needs Index",
            "Retail Clustering (ANN)",
        ],
        "Value": [
            f"{groups_present}/6 ({completeness_score:.2f})",
            f"{social_density:.2f} per ha",
            f"{nearest_food_distance:.0f} m" if nearest_food_distance is not None else "N/A",
            f"{daily_needs_index:.1f} / 100",
            f"{ann_ratio:.3f}" if ann_ratio is not None else "N/A",
        ],
        "Interpretation": [
            _compl_interp,
            _social_interp,
            _food_interp,
            _daily_interp,
            _ann_interp,
        ],
    })

    mo.md(f"""
---

## Summary -- {_city.name} ({radius_slider.value} m pedshed)

| # | Metric | Value | Interpretation |
|---|--------|-------|----------------|
| 1 | **15-Min Completeness** | {groups_present}/6 ({completeness_score:.2f}) | {_compl_interp} |
| 2 | **Social Density** | {social_density:.2f} per ha | {_social_interp} |
| 3 | **Fresh Food Access** | {f'{nearest_food_distance:.0f} m' if nearest_food_distance is not None else 'N/A'} | {_food_interp} |
| 4 | **Daily Needs Index** | {daily_needs_index:.1f} / 100 | {_daily_interp} |
| 5 | **Retail Clustering (ANN)** | {f'{ann_ratio:.3f}' if ann_ratio is not None else 'N/A'} | {_ann_interp} |

*5 Amenities (Vitality) metrics from Overture Maps places data, computed via DuckDB + S3 predicate pushdown.*
""")
    return (summary_df,)


# ---------------------------------------------------------------------------
# Cell 13 — Visualization: Category distribution bar chart (top 15)
# ---------------------------------------------------------------------------
@app.cell
def _(places_df, pl, alt, mo):
    _cat_counts = (
        places_df
        .filter(pl.col("primary_category").is_not_null())
        .group_by("primary_category")
        .len()
        .sort("len", descending=True)
        .head(15)
    )

    category_bar_chart = (
        alt.Chart(_cat_counts.to_pandas())
        .mark_bar()
        .encode(
            x=alt.X("len:Q", title="Count"),
            y=alt.Y("primary_category:N", sort="-x", title="Category"),
            color=alt.Color(
                "len:Q",
                scale=alt.Scale(scheme="tealblues"),
                legend=None,
            ),
            tooltip=["primary_category:N", "len:Q"],
        )
        .properties(
            title="Top 15 POI Categories",
            width=500,
            height=350,
        )
    )

    mo.md("### Category Distribution (Top 15)")
    category_bar_chart
    return (category_bar_chart,)


# ---------------------------------------------------------------------------
# Cell 14 — Visualization: 15-Min Completeness radar / petal chart
# ---------------------------------------------------------------------------
@app.cell
def _(essential_group_counts, matched_groups, ESSENTIAL_CATEGORIES, pl, alt, math, mo):
    _categories = list(ESSENTIAL_CATEGORIES.keys())
    _values = [essential_group_counts[g] for g in _categories]
    _max_val = max(_values) if _values and max(_values) > 0 else 1

    # Normalise to 0-1 for the radar
    _normed = [v / _max_val for v in _values]

    _n = len(_categories)
    _radar_rows = []
    for _i, (_cat, norm_val) in enumerate(zip(_categories, _normed)):
        _angle = 2 * math.pi * _i / _n
        _radar_rows.append({
            "category": _cat.title(),
            "value": norm_val,
            "raw_count": _values[_i],
            "angle": _angle,
            "x": norm_val * math.cos(_angle),
            "y": norm_val * math.sin(_angle),
            "order": _i,
        })
    # Close polygon
    if _radar_rows:
        _close = dict(_radar_rows[0])
        _close["order"] = _n
        _radar_rows.append(_close)

    _radar_df = pl.DataFrame(_radar_rows).to_pandas()

    _polygon = (
        alt.Chart(_radar_df)
        .mark_area(opacity=0.3, color="#2ca02c")
        .encode(
            x=alt.X("x:Q", axis=None, scale=alt.Scale(domain=[-1.3, 1.3])),
            y=alt.Y("y:Q", axis=None, scale=alt.Scale(domain=[-1.3, 1.3])),
            order="order:O",
        )
    )

    _line = (
        alt.Chart(_radar_df)
        .mark_line(color="#2ca02c", strokeWidth=2)
        .encode(x="x:Q", y="y:Q", order="order:O")
    )

    _points_df = pl.DataFrame(_radar_rows[:_n]).to_pandas()
    _points = (
        alt.Chart(_points_df)
        .mark_point(size=80, filled=True, color="#2ca02c")
        .encode(
            x="x:Q",
            y="y:Q",
            tooltip=["category:N", "raw_count:Q", "value:Q"],
        )
    )

    # Axis labels
    _labels_data = []
    for _i, _cat in enumerate(_categories):
        _a = 2 * math.pi * _i / _n
        _labels_data.append({
            "category": _cat.title(),
            "lx": 1.15 * math.cos(_a),
            "ly": 1.15 * math.sin(_a),
        })
    _labels_df = pl.DataFrame(_labels_data).to_pandas()

    _labels = (
        alt.Chart(_labels_df)
        .mark_text(fontSize=11, fontWeight="bold")
        .encode(x="lx:Q", y="ly:Q", text="category:N")
    )

    completeness_radar_chart = (
        (_polygon + _line + _points + _labels)
        .properties(
            title="15-Min Completeness Radar (6 Essential Categories)",
            width=380,
            height=380,
        )
    )

    mo.md("### 15-Minute Completeness Radar")
    completeness_radar_chart
    return (completeness_radar_chart,)


# ---------------------------------------------------------------------------
# Cell 15 — Visualization: Distance histogram
# ---------------------------------------------------------------------------
@app.cell
def _(places_df, pl, alt, mo):
    _dist_data = places_df.select(
        pl.col("distance_m").alias("distance")
    ).filter(pl.col("distance").is_not_null())

    distance_histogram = (
        alt.Chart(_dist_data.to_pandas())
        .mark_bar(opacity=0.7, cornerRadiusTopLeft=3, cornerRadiusTopRight=3)
        .encode(
            x=alt.X(
                "distance:Q",
                bin=alt.Bin(maxbins=30),
                title="Distance from center (m)",
            ),
            y=alt.Y("count()", title="Number of POIs"),
            tooltip=[
                alt.Tooltip("distance:Q", bin=alt.Bin(maxbins=30), title="Distance bin"),
                alt.Tooltip("count()", title="Count"),
            ],
        )
        .properties(
            title="POI Distance Distribution",
            width=500,
            height=280,
        )
    )

    mo.md("### Distance Distribution (How Far Are POIs?)")
    distance_histogram
    return (distance_histogram,)


if __name__ == "__main__":
    app.run()

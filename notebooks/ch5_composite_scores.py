import marimo

__generated_with = "0.10.0"
app = marimo.App(width="medium")


# ---------------------------------------------------------------------------
# Cell 1 — Imports
# ---------------------------------------------------------------------------
@app.cell
def imports_cell():
    import marimo as mo
    import duckdb
    import polars as pl
    import altair as alt
    import math
    import sys
    import os
    import time

    # Ensure the notebooks/ directory is on the path so we can import utils
    _nb_dir = os.path.dirname(os.path.abspath("__file__"))
    if _nb_dir not in sys.path:
        sys.path.insert(0, _nb_dir)

    from utils.overture import (
        CITIES,
        S3_BUILDINGS,
        S3_SEGMENTS,
        S3_CONNECTORS,
        S3_PLACES,
        S3_LAND_USE,
        S3_LAND_COVER,
        init_duckdb,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_m2,
        pedshed_area_ha,
        pedshed_area_km2,
        normalize,
        normalized_entropy,
        DEFAULT_RADIUS_M,
    )

    return (
        mo,
        duckdb,
        pl,
        alt,
        math,
        sys,
        os,
        time,
        CITIES,
        S3_BUILDINGS,
        S3_SEGMENTS,
        S3_CONNECTORS,
        S3_PLACES,
        S3_LAND_USE,
        S3_LAND_COVER,
        init_duckdb,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_m2,
        pedshed_area_ha,
        pedshed_area_km2,
        normalize,
        normalized_entropy,
        DEFAULT_RADIUS_M,
    )


# ---------------------------------------------------------------------------
# Cell 2 — DuckDB init
# ---------------------------------------------------------------------------
@app.cell
def duckdb_init_cell(init_duckdb, mo):
    conn = init_duckdb()
    mo.md("**DuckDB** initialised with `httpfs` + `spatial` extensions.")
    return (conn,)


# ---------------------------------------------------------------------------
# Cell 3 — City selector and radius slider
# ---------------------------------------------------------------------------
@app.cell
def city_selector_cell(mo, CITIES, DEFAULT_RADIUS_M):
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
## Ch 5 -- Composite Scores & Chrono Score

Select a city and pedshed radius to compute **all four chapter scores**
and the master **Chrono Score**.

{city_dropdown}

{radius_slider}
""")
    return (city_dropdown, radius_slider)


# ---------------------------------------------------------------------------
# Cell 4 — Compute bbox and pedshed
# ---------------------------------------------------------------------------
@app.cell
def compute_bbox_cell(
    city_dropdown,
    radius_slider,
    CITIES,
    bbox_from_center,
    pedshed_area_ha,
    pedshed_area_km2,
    pedshed_area_m2,
    mo,
):
    _city_key = city_dropdown.value
    _city = CITIES[_city_key]
    _radius = radius_slider.value

    study_lat = _city.lat
    study_lng = _city.lng
    study_radius = _radius
    study_bbox = bbox_from_center(study_lat, study_lng, study_radius)
    study_area_ha = pedshed_area_ha(study_radius)
    study_area_km2 = pedshed_area_km2(study_radius)
    study_area_m2 = pedshed_area_m2(study_radius)
    study_city_name = _city.name

    mo.md(f"""
**{_city.name}** -- {_city.description}

| Parameter | Value |
|-----------|-------|
| Center | {study_lat:.4f}, {study_lng:.4f} |
| Radius | {study_radius} m |
| Study area | {study_area_ha:.1f} ha ({study_area_km2:.2f} km^2) |
| Bbox S/N | {study_bbox['south']:.4f} / {study_bbox['north']:.4f} |
| Bbox W/E | {study_bbox['west']:.4f} / {study_bbox['east']:.4f} |
""")
    return (
        study_lat,
        study_lng,
        study_radius,
        study_bbox,
        study_area_ha,
        study_area_km2,
        study_area_m2,
        study_city_name,
    )


# ---------------------------------------------------------------------------
# Cell 5 — Essential categories (self-contained)
# ---------------------------------------------------------------------------
@app.cell
def essential_categories_cell():
    ESSENTIAL_CATEGORIES = {
        "food": ["supermarket", "grocery", "market", "bakery", "food"],
        "health": ["hospital", "doctor", "pharmacy", "clinic", "health_and_medical"],
        "education": ["school", "college_university", "library", "education"],
        "shopping": ["shopping", "clothing_store", "department_store", "retail"],
        "leisure": ["park", "sports_and_recreation", "entertainment", "gym", "museum"],
        "civic": ["government", "post_office", "bank", "professional_services"],
    }
    return (ESSENTIAL_CATEGORIES,)


# ---------------------------------------------------------------------------
# Cell 6 — Run all queries
# ---------------------------------------------------------------------------
@app.cell
def run_all_queries_cell(
    conn,
    study_lat,
    study_lng,
    study_radius,
    study_bbox,
    bbox_predicate,
    pedshed_filter,
    S3_BUILDINGS,
    S3_LAND_USE,
    S3_LAND_COVER,
    S3_PLACES,
    S3_SEGMENTS,
    S3_CONNECTORS,
    pl,
    time,
    mo,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, study_radius)

    _status_lines = ["### Query Execution Log\n"]

    # ----- Buildings -----
    _t0 = time.time()
    _sql_buildings = f"""
    SELECT
        id,
        ST_Area(geometry)     AS footprint_area_m2,
        4 * pi() * ST_Area(geometry)
            / POWER(ST_Perimeter(geometry), 2)
                                               AS compactness,
        num_floors,
        height,
        ST_Perimeter(geometry) AS perimeter_m,
        ST_NPoints(geometry)   AS vertex_count
    FROM read_parquet('{S3_BUILDINGS}', hive_partitioning=1)
    WHERE {_bbox_pred}
      AND {_circle_pred}
    """
    buildings_df = pl.from_arrow(conn.execute(_sql_buildings).fetch_arrow_table())
    _dt_buildings = time.time() - _t0
    _status_lines.append(
        f"- **Buildings**: {buildings_df.height:,} rows in {_dt_buildings:.1f}s"
    )

    # ----- Land Use -----
    _t0 = time.time()
    _sql_land_use = f"""
    SELECT
        subtype AS class,
        ST_Area(geometry) AS area_m2
    FROM read_parquet('{S3_LAND_USE}', hive_partitioning=1)
    WHERE {_bbox_pred}
      AND {_circle_pred}
    """
    land_use_df = pl.from_arrow(conn.execute(_sql_land_use).fetch_arrow_table())
    _dt_land_use = time.time() - _t0
    _status_lines.append(
        f"- **Land Use**: {land_use_df.height:,} rows in {_dt_land_use:.1f}s"
    )

    # ----- Land Cover -----
    _t0 = time.time()
    _sql_land_cover = f"""
    SELECT
        subtype AS class,
        ST_Area(geometry) AS area_m2
    FROM read_parquet('{S3_LAND_COVER}', hive_partitioning=1)
    WHERE {_bbox_pred}
      AND {_circle_pred}
    """
    land_cover_df = pl.from_arrow(conn.execute(_sql_land_cover).fetch_arrow_table())
    _dt_land_cover = time.time() - _t0
    _status_lines.append(
        f"- **Land Cover**: {land_cover_df.height:,} rows in {_dt_land_cover:.1f}s"
    )

    # ----- Places -----
    _t0 = time.time()
    _sql_places = f"""
    SELECT
        id,
        categories.primary AS category,
        ST_Distance(
            geometry,
            ST_Point({study_lng:.6f}, {study_lat:.6f})
        ) * 111320 AS distance_m
    FROM read_parquet('{S3_PLACES}', hive_partitioning=1)
    WHERE {_bbox_pred}
      AND {_circle_pred}
    """
    places_df = pl.from_arrow(conn.execute(_sql_places).fetch_arrow_table())
    _dt_places = time.time() - _t0
    _status_lines.append(
        f"- **Places**: {places_df.height:,} rows in {_dt_places:.1f}s"
    )

    # ----- Segments -----
    _t0 = time.time()
    _sql_segments = f"""
    SELECT
        id,
        class AS class,
        ST_Length(geometry) * 111320 AS length_m,
        connectors
    FROM read_parquet('{S3_SEGMENTS}', hive_partitioning=1)
    WHERE {_bbox_pred}
      AND {_circle_pred}
    """
    segments_df = pl.from_arrow(conn.execute(_sql_segments).fetch_arrow_table())
    _dt_segments = time.time() - _t0
    _status_lines.append(
        f"- **Segments**: {segments_df.height:,} rows in {_dt_segments:.1f}s"
    )

    # ----- Connectors -----
    _t0 = time.time()
    _sql_connectors = f"""
    SELECT
        id,
        ST_X(geometry) AS lng,
        ST_Y(geometry) AS lat
    FROM read_parquet('{S3_CONNECTORS}', hive_partitioning=1)
    WHERE {_bbox_pred}
      AND {_circle_pred}
    """
    connectors_df = pl.from_arrow(conn.execute(_sql_connectors).fetch_arrow_table())
    _dt_connectors = time.time() - _t0
    _status_lines.append(
        f"- **Connectors**: {connectors_df.height:,} rows in {_dt_connectors:.1f}s"
    )

    _total_time = (
        _dt_buildings + _dt_land_use + _dt_land_cover
        + _dt_places + _dt_segments + _dt_connectors
    )
    _status_lines.append(f"\n**Total query time: {_total_time:.1f}s**")

    mo.md("\n".join(_status_lines))

    return (
        buildings_df,
        land_use_df,
        land_cover_df,
        places_df,
        segments_df,
        connectors_df,
    )


# ---------------------------------------------------------------------------
# Cell 7 — Grade helper function
# ---------------------------------------------------------------------------
@app.cell
def grade_helper_cell():
    def letter_grade(score):
        if score >= 85:
            return "A"
        if score >= 70:
            return "B"
        if score >= 55:
            return "C"
        if score >= 40:
            return "D"
        return "F"

    return (letter_grade,)


# ---------------------------------------------------------------------------
# Cell 8 — Compute Chapter 1 metrics
# ---------------------------------------------------------------------------
@app.cell
def compute_ch1_metrics_cell(
    buildings_df,
    study_area_m2,
    math,
    pl,
    normalize,
):
    _building_count = buildings_df.height

    # Total footprint area
    _total_footprint = buildings_df["footprint_area_m2"].sum()

    # Estimate floors: num_floors if available, else height/3.5, else 1
    _floors = buildings_df.select(
        pl.when(pl.col("num_floors").is_not_null())
        .then(pl.col("num_floors"))
        .when(pl.col("height").is_not_null())
        .then((pl.col("height") / 3.5).round(0).cast(pl.Int64).clip(1))
        .otherwise(pl.lit(1))
        .alias("est_floors")
    )["est_floors"]

    _gfa = (buildings_df["footprint_area_m2"] * _floors).sum()

    # GSI -- Ground Space Index
    ch1_gsi = _total_footprint / study_area_m2 if study_area_m2 > 0 else 0.0

    # FSI -- Floor Space Index
    ch1_fsi = _gfa / study_area_m2 if study_area_m2 > 0 else 0.0

    # OSR -- Open Space Ratio
    ch1_osr = (1 - ch1_gsi) / ch1_fsi if ch1_fsi > 0 else float("inf")

    # Compactness (isoperimetric quotient, already computed in query)
    _compactness_valid = buildings_df.filter(
        pl.col("compactness").is_not_null() & pl.col("compactness").is_finite()
    )["compactness"]
    ch1_avg_compactness = (
        _compactness_valid.mean() if len(_compactness_valid) > 0 else 0.0
    )

    # Urban grain -- median footprint area
    _median_area = buildings_df["footprint_area_m2"].median()
    ch1_urban_grain_median = _median_area if _median_area is not None else 0.0

    # Fractal proxy -- average log(perimeter) / log(area) for buildings > 10 m2
    _frac_df = buildings_df.filter(
        (pl.col("footprint_area_m2") > 10)
        & (pl.col("perimeter_m") > 0)
    ).select(
        (pl.col("perimeter_m").log() / pl.col("footprint_area_m2").log()).alias("fd")
    ).filter(pl.col("fd").is_finite())

    ch1_fractal_proxy = _frac_df["fd"].mean() if _frac_df.height > 0 else 1.0

    ch1_metrics = {
        "gsi": ch1_gsi,
        "fsi": ch1_fsi,
        "osr": ch1_osr,
        "avg_compactness": ch1_avg_compactness,
        "urban_grain_median": ch1_urban_grain_median,
        "fractal_proxy": ch1_fractal_proxy,
        "building_count": _building_count,
    }

    return (
        ch1_metrics,
        ch1_gsi,
        ch1_fsi,
        ch1_osr,
        ch1_avg_compactness,
        ch1_urban_grain_median,
        ch1_fractal_proxy,
    )


# ---------------------------------------------------------------------------
# Cell 9 — Fabric Score (Chapter 1)
# ---------------------------------------------------------------------------
@app.cell
def fabric_score_cell(
    ch1_gsi,
    ch1_avg_compactness,
    ch1_urban_grain_median,
    ch1_fractal_proxy,
    normalize,
    letter_grade,
    mo,
):
    # Density balance (25%): triangular normalization
    # Peak at GSI 0.25-0.45, falls off outside 0.1-0.5
    if ch1_gsi < 0.25:
        _density_balance = normalize(ch1_gsi, 0.10, 0.25)
    elif ch1_gsi <= 0.45:
        _density_balance = 1.0
    else:
        _density_balance = 1.0 - normalize(ch1_gsi, 0.45, 0.50)
    _density_balance = max(0.0, min(1.0, _density_balance))

    # Grain quality (25%): fine=1.0, medium=0.6, coarse=0.2
    if ch1_urban_grain_median < 150:
        _grain_quality = 1.0
    elif ch1_urban_grain_median <= 500:
        _grain_quality = 0.6
    else:
        _grain_quality = 0.2

    # Compactness (25%): normalize avg_compactness between 0.3 and 0.8
    _compactness_norm = normalize(ch1_avg_compactness, 0.3, 0.8)

    # Complexity (25%): normalize fractal dimension proxy between 1.1 and 1.8
    _complexity_norm = normalize(ch1_fractal_proxy, 1.1, 1.8)

    fabric_score = (
        0.25 * _density_balance
        + 0.25 * _grain_quality
        + 0.25 * _compactness_norm
        + 0.25 * _complexity_norm
    ) * 100

    fabric_grade = letter_grade(fabric_score)

    mo.md(f"""
### Chapter 1: Fabric Score

| Component | Weight | Raw | Normalised |
|-----------|--------|-----|-----------|
| Density Balance (GSI peak 0.25-0.45) | 25% | GSI={ch1_gsi:.3f} | {_density_balance:.3f} |
| Grain Quality | 25% | median={ch1_urban_grain_median:.0f} m^2 | {_grain_quality:.3f} |
| Compactness | 25% | {ch1_avg_compactness:.3f} | {_compactness_norm:.3f} |
| Complexity (fractal proxy) | 25% | {ch1_fractal_proxy:.3f} | {_complexity_norm:.3f} |

**Fabric Score: {fabric_score:.1f} / 100  (Grade: {fabric_grade})**
""")
    return (fabric_score, fabric_grade)


# ---------------------------------------------------------------------------
# Cell 10 — Compute Chapter 2 metrics
# ---------------------------------------------------------------------------
@app.cell
def compute_ch2_metrics_cell(
    land_use_df,
    land_cover_df,
    study_area_m2,
    normalized_entropy,
    pl,
):
    # --- Land use mix (Shannon entropy) ---
    _lu_agg = (
        land_use_df
        .group_by("class")
        .agg(pl.col("area_m2").sum().alias("total_area"))
        .sort("total_area", descending=True)
    )
    _lu_total = _lu_agg["total_area"].sum()
    _lu_proportions = (
        [a / _lu_total for a in _lu_agg["total_area"].to_list()]
        if _lu_total > 0
        else []
    )
    ch2_land_use_mix = normalized_entropy(_lu_proportions) if _lu_proportions else 0.0

    # --- Land cover aggregation ---
    _lc_agg = (
        land_cover_df
        .group_by("class")
        .agg(pl.col("area_m2").sum().alias("total_area"))
        .sort("total_area", descending=True)
    )
    _lc_areas = dict(
        zip(
            _lc_agg["class"].to_list(),
            _lc_agg["total_area"].to_list(),
        )
    )

    # Canopy cover: forest + shrub relative to pedshed area
    _canopy_types = ["forest", "shrub"]
    _canopy_area = sum(_lc_areas.get(t, 0.0) for t in _canopy_types)
    ch2_canopy_cover = _canopy_area / study_area_m2 if study_area_m2 > 0 else 0.0

    # Imperviousness: built / developed types relative to pedshed
    _impervious_types = ["urban", "developed", "barren"]
    _impervious_area = sum(_lc_areas.get(t, 0.0) for t in _impervious_types)
    # Also add any land cover total minus green types as a fallback estimate
    _green_types = ["forest", "shrub", "grass", "wetland", "moss", "crop"]
    _green_area = sum(_lc_areas.get(t, 0.0) for t in _green_types)
    _lc_total = _lc_agg["total_area"].sum()
    if _impervious_area > 0:
        ch2_imperviousness = _impervious_area / study_area_m2 if study_area_m2 > 0 else 0.0
    else:
        # Fallback: non-green portion of classified land cover
        _non_green = _lc_total - _green_area
        ch2_imperviousness = _non_green / study_area_m2 if study_area_m2 > 0 else 0.0
    ch2_imperviousness = max(0.0, min(1.0, ch2_imperviousness))

    ch2_metrics = {
        "land_use_mix": ch2_land_use_mix,
        "canopy_cover": ch2_canopy_cover,
        "imperviousness": ch2_imperviousness,
    }

    return (
        ch2_metrics,
        ch2_land_use_mix,
        ch2_canopy_cover,
        ch2_imperviousness,
    )


# ---------------------------------------------------------------------------
# Cell 11 — Resilience Score (Chapter 2)
# ---------------------------------------------------------------------------
@app.cell
def resilience_score_cell(
    ch2_land_use_mix,
    ch2_canopy_cover,
    ch2_imperviousness,
    normalize,
    letter_grade,
    mo,
):
    # Mix (35%): normalize entropy between 0.2 and 0.8
    _mix_norm = normalize(ch2_land_use_mix, 0.2, 0.8)

    # Green (35%): normalize canopy cover between 0.02 and 0.30
    _green_norm = normalize(ch2_canopy_cover, 0.02, 0.30)

    # Permeability (30%): normalize (1 - imperviousness) between 0.3 and 0.8
    _permeability = 1 - ch2_imperviousness
    _perm_norm = normalize(_permeability, 0.3, 0.8)

    resilience_score = (
        0.35 * _mix_norm
        + 0.35 * _green_norm
        + 0.30 * _perm_norm
    ) * 100

    resilience_grade = letter_grade(resilience_score)

    mo.md(f"""
### Chapter 2: Resilience Score

| Component | Weight | Raw | Normalised |
|-----------|--------|-----|-----------|
| Land Use Mix | 35% | entropy={ch2_land_use_mix:.3f} | {_mix_norm:.3f} |
| Canopy Cover | 35% | {ch2_canopy_cover:.4f} | {_green_norm:.3f} |
| Permeability (1 - imperv.) | 30% | {_permeability:.3f} | {_perm_norm:.3f} |

**Resilience Score: {resilience_score:.1f} / 100  (Grade: {resilience_grade})**
""")
    return (resilience_score, resilience_grade)


# ---------------------------------------------------------------------------
# Cell 12 — Compute Chapter 3 metrics
# ---------------------------------------------------------------------------
@app.cell
def compute_ch3_metrics_cell(
    places_df,
    ESSENTIAL_CATEGORIES,
    study_area_ha,
    pl,
):
    _total_places = places_df.height

    # Classify places into essential categories
    def _match_essential(category, keywords):
        kw_set = set(k.lower() for k in keywords)
        return places_df.filter(
            pl.col("category").is_not_null()
            & pl.col("category").str.to_lowercase().is_in(kw_set)
        ).height

    _essential_counts = {
        cat: _match_essential(cat, kws)
        for cat, kws in ESSENTIAL_CATEGORIES.items()
    }

    # Completeness: categories found / 6
    _categories_found = sum(1 for c in _essential_counts.values() if c > 0)
    ch3_completeness = _categories_found / 6.0

    # Social density: total places per hectare
    ch3_social_density = _total_places / study_area_ha if study_area_ha > 0 else 0.0

    # Food access distance: median distance to food-related places
    _food_kw = set(k.lower() for k in ESSENTIAL_CATEGORIES.get("food", []))
    _food_places = places_df.filter(
        pl.col("category").is_not_null()
        & pl.col("category").str.to_lowercase().is_in(_food_kw)
    )
    if _food_places.height > 0:
        _food_median_dist = _food_places["distance_m"].median()
        ch3_food_access_distance = (
            _food_median_dist if _food_median_dist is not None else 1200.0
        )
    else:
        ch3_food_access_distance = 1200.0  # worst case, at pedshed edge

    ch3_metrics = {
        "completeness": ch3_completeness,
        "categories_found": _categories_found,
        "social_density_per_ha": ch3_social_density,
        "food_access_distance": ch3_food_access_distance,
        "essential_counts": _essential_counts,
    }

    return (
        ch3_metrics,
        ch3_completeness,
        ch3_social_density,
        ch3_food_access_distance,
    )


# ---------------------------------------------------------------------------
# Cell 13 — Vitality Score (Chapter 3)
# ---------------------------------------------------------------------------
@app.cell
def vitality_score_cell(
    ch3_completeness,
    ch3_social_density,
    ch3_food_access_distance,
    normalize,
    letter_grade,
    mo,
):
    # Completeness (40%): categories_found / 6 (already 0-1)
    _completeness_norm = max(0.0, min(1.0, ch3_completeness))

    # Social density (30%): normalize per-ha density between 0.5 and 10
    _social_norm = normalize(ch3_social_density, 0.5, 10.0)

    # Food proximity (30%): normalize(1 - food_distance/1200, 0, 1)
    _food_prox_raw = 1.0 - ch3_food_access_distance / 1200.0
    _food_prox_norm = normalize(_food_prox_raw, 0.0, 1.0)

    vitality_score = (
        0.40 * _completeness_norm
        + 0.30 * _social_norm
        + 0.30 * _food_prox_norm
    ) * 100

    vitality_grade = letter_grade(vitality_score)

    mo.md(f"""
### Chapter 3: Vitality Score

| Component | Weight | Raw | Normalised |
|-----------|--------|-----|-----------|
| Completeness (categories/6) | 40% | {ch3_completeness:.2f} | {_completeness_norm:.3f} |
| Social Density (/ha) | 30% | {ch3_social_density:.2f} | {_social_norm:.3f} |
| Food Proximity | 30% | dist={ch3_food_access_distance:.0f}m | {_food_prox_norm:.3f} |

**Vitality Score: {vitality_score:.1f} / 100  (Grade: {vitality_grade})**
""")
    return (vitality_score, vitality_grade)


# ---------------------------------------------------------------------------
# Cell 14 — Compute Chapter 4 metrics
# ---------------------------------------------------------------------------
@app.cell
def compute_ch4_metrics_cell(
    segments_df,
    connectors_df,
    study_area_ha,
    normalized_entropy,
    math,
    pl,
):
    _connector_count = connectors_df.height

    # --- Intersection density (connectors per hectare) ---
    ch4_intersection_density = (
        _connector_count / study_area_ha if study_area_ha > 0 else 0.0
    )

    # --- Dead-end ratio ---
    # Dead-ends are connectors that appear in only one segment's connector list.
    # Since connectors column is a list, we explode and count occurrences.
    if segments_df.height > 0 and "connectors" in segments_df.columns:
        try:
            _connector_refs = (
                segments_df
                .select(pl.col("connectors").explode().alias("connector_id"))
                .filter(pl.col("connector_id").is_not_null())
                .group_by("connector_id")
                .len()
            )
            _dead_ends = _connector_refs.filter(pl.col("len") == 1).height
            _total_connectors_ref = _connector_refs.height
            ch4_dead_end_ratio = (
                _dead_ends / _total_connectors_ref
                if _total_connectors_ref > 0
                else 0.0
            )
        except Exception:
            ch4_dead_end_ratio = 0.0
    else:
        ch4_dead_end_ratio = 0.0

    # --- Active transport share ---
    # Active = footway, cycleway, path, pedestrian, steps, living_street
    _active_classes = {
        "footway", "cycleway", "path", "pedestrian", "steps", "living_street",
    }
    if segments_df.height > 0 and "class" in segments_df.columns:
        _total_length = segments_df["length_m"].sum()
        _active_df = segments_df.filter(
            pl.col("class").is_not_null()
            & pl.col("class").str.to_lowercase().is_in(_active_classes)
        )
        _active_length = _active_df["length_m"].sum()
        ch4_active_transport_share = (
            _active_length / _total_length if _total_length > 0 else 0.0
        )
    else:
        ch4_active_transport_share = 0.0

    # --- Orientation entropy ---
    # Compute bearing of each segment from connector positions (simplified:
    # use segment class distribution as a proxy for orientation diversity).
    # A more precise method would use segment geometry bearings.
    if segments_df.height > 0 and "class" in segments_df.columns:
        _class_counts = (
            segments_df
            .filter(pl.col("class").is_not_null())
            .group_by("class")
            .len()
            .sort("len", descending=True)
        )
        _class_total = _class_counts["len"].sum()
        _class_props = (
            [c / _class_total for c in _class_counts["len"].to_list()]
            if _class_total > 0
            else []
        )
        ch4_orientation_entropy = (
            normalized_entropy(_class_props) if _class_props else 0.0
        )
    else:
        ch4_orientation_entropy = 0.0

    ch4_metrics = {
        "intersection_density": ch4_intersection_density,
        "dead_end_ratio": ch4_dead_end_ratio,
        "active_transport_share": ch4_active_transport_share,
        "orientation_entropy": ch4_orientation_entropy,
    }

    return (
        ch4_metrics,
        ch4_intersection_density,
        ch4_dead_end_ratio,
        ch4_active_transport_share,
        ch4_orientation_entropy,
    )


# ---------------------------------------------------------------------------
# Cell 15 — Connectivity Score (Chapter 4)
# ---------------------------------------------------------------------------
@app.cell
def connectivity_score_cell(
    ch4_intersection_density,
    ch4_dead_end_ratio,
    ch4_active_transport_share,
    ch4_orientation_entropy,
    normalize,
    letter_grade,
    mo,
):
    # Intersection density (40%): normalize between 30 and 150 per ha
    _intx_norm = normalize(ch4_intersection_density, 30, 150)

    # Dead-end penalty (25%): normalize (1 - dead_end_ratio) between 0.5 and 0.95
    _dead_end_norm = normalize(1 - ch4_dead_end_ratio, 0.5, 0.95)

    # Active transport (20%): normalize share between 0.02 and 0.30
    _active_norm = normalize(ch4_active_transport_share, 0.02, 0.30)

    # Orientation (15%): normalize (1 - entropy) between 0.3 and 0.8
    # Lower entropy = more legible grid
    _orient_norm = normalize(1 - ch4_orientation_entropy, 0.3, 0.8)

    connectivity_score = (
        0.40 * _intx_norm
        + 0.25 * _dead_end_norm
        + 0.20 * _active_norm
        + 0.15 * _orient_norm
    ) * 100

    connectivity_grade = letter_grade(connectivity_score)

    mo.md(f"""
### Chapter 4: Connectivity Score

| Component | Weight | Raw | Normalised |
|-----------|--------|-----|-----------|
| Intersection Density (/ha) | 40% | {ch4_intersection_density:.1f} | {_intx_norm:.3f} |
| Dead-End Penalty (1-ratio) | 25% | ratio={ch4_dead_end_ratio:.3f} | {_dead_end_norm:.3f} |
| Active Transport Share | 20% | {ch4_active_transport_share:.3f} | {_active_norm:.3f} |
| Orientation (1-entropy) | 15% | entropy={ch4_orientation_entropy:.3f} | {_orient_norm:.3f} |

**Connectivity Score: {connectivity_score:.1f} / 100  (Grade: {connectivity_grade})**
""")
    return (connectivity_score, connectivity_grade)


# ---------------------------------------------------------------------------
# Cell 16 — Master Chrono Score
# ---------------------------------------------------------------------------
@app.cell
def chrono_score_cell(
    fabric_score,
    resilience_score,
    vitality_score,
    connectivity_score,
    fabric_grade,
    resilience_grade,
    vitality_grade,
    connectivity_grade,
    letter_grade,
    study_city_name,
    study_radius,
    mo,
):
    chrono_score = (
        0.25 * fabric_score
        + 0.20 * resilience_score
        + 0.30 * vitality_score
        + 0.25 * connectivity_score
    )

    chrono_grade = letter_grade(chrono_score)

    # Colour based on grade
    _grade_colors = {
        "A": "#2e7d32",
        "B": "#558b2f",
        "C": "#f9a825",
        "D": "#e65100",
        "F": "#b71c1c",
    }
    _color = _grade_colors.get(chrono_grade, "#333")

    mo.md(f"""
---

# <span style="color:{_color}">Chrono Score: {chrono_score:.1f} / 100 &mdash; Grade {chrono_grade}</span>

**{study_city_name}** | Pedshed: {study_radius}m

| Chapter | Score | Grade | Weight |
|---------|------:|-------|--------|
| 1. Fabric | {fabric_score:.1f} | {fabric_grade} | 25% |
| 2. Resilience | {resilience_score:.1f} | {resilience_grade} | 20% |
| 3. Vitality | {vitality_score:.1f} | {vitality_grade} | 30% |
| 4. Connectivity | {connectivity_score:.1f} | {connectivity_grade} | 25% |
| **Chrono Score** | **{chrono_score:.1f}** | **{chrono_grade}** | **100%** |

Grading: A >= 85 | B >= 70 | C >= 55 | D >= 40 | F < 40
""")
    return (chrono_score, chrono_grade)


# ---------------------------------------------------------------------------
# Cell 17 — Radar chart (bar chart approximation of 4 sub-scores)
# ---------------------------------------------------------------------------
@app.cell
def radar_chart_cell(
    fabric_score,
    resilience_score,
    vitality_score,
    connectivity_score,
    alt,
    pl,
    math,
    mo,
):
    # Build radar-style polygon using x/y coordinates
    _dimensions = ["Fabric", "Resilience", "Vitality", "Connectivity"]
    _scores = [fabric_score, resilience_score, vitality_score, connectivity_score]
    _n = len(_dimensions)

    _radar_rows = []
    for i, (dim, score) in enumerate(zip(_dimensions, _scores)):
        _angle = 2 * math.pi * i / _n
        _normed = score / 100.0
        _radar_rows.append({
            "dimension": dim,
            "score": score,
            "normed": _normed,
            "angle": _angle,
            "x": _normed * math.cos(_angle),
            "y": _normed * math.sin(_angle),
            "order": i,
        })
    # Close polygon
    _close = dict(_radar_rows[0])
    _close["order"] = _n
    _radar_rows.append(_close)

    _radar_df = pl.DataFrame(_radar_rows).to_pandas()

    # Background grid circles at 25, 50, 75, 100
    _grid_rows = []
    for _r_pct in [0.25, 0.50, 0.75, 1.00]:
        for _j in range(61):
            _a = 2 * math.pi * _j / 60
            _grid_rows.append({
                "gx": _r_pct * math.cos(_a),
                "gy": _r_pct * math.sin(_a),
                "ring": f"{int(_r_pct * 100)}",
                "order": _j,
            })
    _grid_df = pl.DataFrame(_grid_rows).to_pandas()

    _grid_layer = (
        alt.Chart(_grid_df)
        .mark_line(opacity=0.15, color="#888", strokeWidth=0.8)
        .encode(
            x=alt.X("gx:Q", axis=None, scale=alt.Scale(domain=[-1.4, 1.4])),
            y=alt.Y("gy:Q", axis=None, scale=alt.Scale(domain=[-1.4, 1.4])),
            detail="ring:N",
            order="order:O",
        )
    )

    # Axis spokes
    _spoke_rows = []
    for i in range(_n):
        _a = 2 * math.pi * i / _n
        _spoke_rows.append({"sx": 0, "sy": 0, "order": 0, "dim": _dimensions[i]})
        _spoke_rows.append({
            "sx": 1.0 * math.cos(_a),
            "sy": 1.0 * math.sin(_a),
            "order": 1,
            "dim": _dimensions[i],
        })
    _spoke_df = pl.DataFrame(_spoke_rows).to_pandas()

    _spoke_layer = (
        alt.Chart(_spoke_df)
        .mark_line(opacity=0.2, color="#888", strokeWidth=0.8)
        .encode(
            x="sx:Q",
            y="sy:Q",
            detail="dim:N",
            order="order:O",
        )
    )

    # Score polygon
    _polygon = (
        alt.Chart(_radar_df)
        .mark_area(opacity=0.35, color="#1976d2")
        .encode(
            x="x:Q",
            y="y:Q",
            order="order:O",
        )
    )

    _line = (
        alt.Chart(_radar_df)
        .mark_line(color="#1976d2", strokeWidth=2.5)
        .encode(
            x="x:Q",
            y="y:Q",
            order="order:O",
        )
    )

    _points_df = pl.DataFrame(_radar_rows[:_n]).to_pandas()
    _points = (
        alt.Chart(_points_df)
        .mark_point(size=90, filled=True, color="#1976d2")
        .encode(
            x="x:Q",
            y="y:Q",
            tooltip=["dimension:N", "score:Q"],
        )
    )

    # Axis labels
    _label_rows = []
    for i, dim in enumerate(_dimensions):
        _a = 2 * math.pi * i / _n
        _label_rows.append({
            "lx": 1.20 * math.cos(_a),
            "ly": 1.20 * math.sin(_a),
            "label": f"{dim}\n({_scores[i]:.0f})",
        })
    _labels_df = pl.DataFrame(_label_rows).to_pandas()

    _labels = (
        alt.Chart(_labels_df)
        .mark_text(fontSize=12, fontWeight="bold")
        .encode(
            x="lx:Q",
            y="ly:Q",
            text="label:N",
        )
    )

    radar_chart = (
        (_grid_layer + _spoke_layer + _polygon + _line + _points + _labels)
        .properties(
            title="Chrono Score Radar",
            width=450,
            height=450,
        )
    )

    mo.md("### Score Radar")
    radar_chart
    return (radar_chart,)


# ---------------------------------------------------------------------------
# Cell 18 — Score breakdown table
# ---------------------------------------------------------------------------
@app.cell
def score_breakdown_table_cell(
    fabric_score,
    resilience_score,
    vitality_score,
    connectivity_score,
    chrono_score,
    ch1_gsi,
    ch1_avg_compactness,
    ch1_urban_grain_median,
    ch1_fractal_proxy,
    ch2_land_use_mix,
    ch2_canopy_cover,
    ch2_imperviousness,
    ch3_completeness,
    ch3_social_density,
    ch3_food_access_distance,
    ch4_intersection_density,
    ch4_dead_end_ratio,
    ch4_active_transport_share,
    ch4_orientation_entropy,
    fabric_grade,
    resilience_grade,
    vitality_grade,
    connectivity_grade,
    chrono_grade,
    pl,
    mo,
):
    _rows = [
        # Chapter 1 -- Fabric
        {"Chapter": "1. Fabric", "Component": "Density Balance",
         "Weight": "25%", "Raw Value": f"GSI={ch1_gsi:.3f}",
         "Sub-Score": f"{fabric_score:.1f}", "Grade": fabric_grade},
        {"Chapter": "1. Fabric", "Component": "Grain Quality",
         "Weight": "25%", "Raw Value": f"median={ch1_urban_grain_median:.0f} m2",
         "Sub-Score": "", "Grade": ""},
        {"Chapter": "1. Fabric", "Component": "Compactness",
         "Weight": "25%", "Raw Value": f"{ch1_avg_compactness:.3f}",
         "Sub-Score": "", "Grade": ""},
        {"Chapter": "1. Fabric", "Component": "Complexity",
         "Weight": "25%", "Raw Value": f"{ch1_fractal_proxy:.3f}",
         "Sub-Score": "", "Grade": ""},
        # Chapter 2 -- Resilience
        {"Chapter": "2. Resilience", "Component": "Land Use Mix",
         "Weight": "35%", "Raw Value": f"{ch2_land_use_mix:.3f}",
         "Sub-Score": f"{resilience_score:.1f}", "Grade": resilience_grade},
        {"Chapter": "2. Resilience", "Component": "Canopy Cover",
         "Weight": "35%", "Raw Value": f"{ch2_canopy_cover:.4f}",
         "Sub-Score": "", "Grade": ""},
        {"Chapter": "2. Resilience", "Component": "Permeability",
         "Weight": "30%", "Raw Value": f"{1 - ch2_imperviousness:.3f}",
         "Sub-Score": "", "Grade": ""},
        # Chapter 3 -- Vitality
        {"Chapter": "3. Vitality", "Component": "Completeness",
         "Weight": "40%", "Raw Value": f"{ch3_completeness:.2f}",
         "Sub-Score": f"{vitality_score:.1f}", "Grade": vitality_grade},
        {"Chapter": "3. Vitality", "Component": "Social Density",
         "Weight": "30%", "Raw Value": f"{ch3_social_density:.2f}/ha",
         "Sub-Score": "", "Grade": ""},
        {"Chapter": "3. Vitality", "Component": "Food Proximity",
         "Weight": "30%", "Raw Value": f"{ch3_food_access_distance:.0f}m",
         "Sub-Score": "", "Grade": ""},
        # Chapter 4 -- Connectivity
        {"Chapter": "4. Connectivity", "Component": "Intersection Density",
         "Weight": "40%", "Raw Value": f"{ch4_intersection_density:.1f}/ha",
         "Sub-Score": f"{connectivity_score:.1f}", "Grade": connectivity_grade},
        {"Chapter": "4. Connectivity", "Component": "Dead-End Penalty",
         "Weight": "25%", "Raw Value": f"ratio={ch4_dead_end_ratio:.3f}",
         "Sub-Score": "", "Grade": ""},
        {"Chapter": "4. Connectivity", "Component": "Active Transport",
         "Weight": "20%", "Raw Value": f"{ch4_active_transport_share:.3f}",
         "Sub-Score": "", "Grade": ""},
        {"Chapter": "4. Connectivity", "Component": "Orientation",
         "Weight": "15%", "Raw Value": f"entropy={ch4_orientation_entropy:.3f}",
         "Sub-Score": "", "Grade": ""},
        # Master
        {"Chapter": "CHRONO", "Component": "Master Score",
         "Weight": "100%", "Raw Value": "",
         "Sub-Score": f"{chrono_score:.1f}", "Grade": chrono_grade},
    ]

    breakdown_df = pl.DataFrame(_rows)

    mo.md(f"""
### Full Score Breakdown

{mo.as_html(breakdown_df.to_pandas())}
""")
    return (breakdown_df,)


if __name__ == "__main__":
    app.run()

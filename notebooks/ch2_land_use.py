import marimo

__generated_with = "0.10.0"
app = marimo.App(width="medium")


# ---------------------------------------------------------------------------
# Cell 1 — Imports
# ---------------------------------------------------------------------------
@app.cell
def _():
    import marimo as mo
    import duckdb
    import polars as pl
    import altair as alt
    import math
    import sys
    import os

    # Ensure notebooks/ directory is on the path so we can import utils.overture
    _nb_dir = os.path.dirname(os.path.abspath("__file__"))
    if _nb_dir not in sys.path:
        sys.path.insert(0, _nb_dir)

    from utils.overture import (
        CITIES,
        S3_LAND_USE,
        S3_LAND_COVER,
        S3_BUILDINGS,
        S3_SEGMENTS,
        init_duckdb,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_m2,
        pedshed_area_ha,
        pedshed_area_km2,
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
        CITIES,
        S3_LAND_USE,
        S3_LAND_COVER,
        S3_BUILDINGS,
        S3_SEGMENTS,
        init_duckdb,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_m2,
        pedshed_area_ha,
        pedshed_area_km2,
        normalized_entropy,
        DEFAULT_RADIUS_M,
    )


# ---------------------------------------------------------------------------
# Cell 2 — DuckDB init
# ---------------------------------------------------------------------------
@app.cell
def duckdb_init(init_duckdb, mo):
    conn = init_duckdb()
    mo.md("**DuckDB** initialised with `httpfs` + `spatial` extensions.")
    return (conn,)


# ---------------------------------------------------------------------------
# Cell 3 — City selector & radius slider
# ---------------------------------------------------------------------------
@app.cell
def city_selector_ui(mo, CITIES, DEFAULT_RADIUS_M):
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
    radius_m = mo.ui.slider(
        start=400,
        stop=2000,
        step=100,
        value=DEFAULT_RADIUS_M,
        label="Pedshed radius (m)",
    )
    mo.md(f"""
## Ch 2 -- Land Use & Resilience

Select a city and pedshed radius to compute 5 land-use and resilience
metrics from Overture Maps base data.

{city_dropdown}

{radius_m}
""")
    return (city_dropdown, radius_m)


# ---------------------------------------------------------------------------
# Cell 4 — Compute bbox and pedshed area
# ---------------------------------------------------------------------------
@app.cell
def compute_bbox(
    city_dropdown,
    radius_m,
    CITIES,
    bbox_from_center,
    pedshed_area_m2,
    pedshed_area_ha,
    pedshed_area_km2,
    mo,
):
    _city_key = city_dropdown.value
    _city = CITIES[_city_key]
    _radius = radius_m.value

    study_lat = _city.lat
    study_lng = _city.lng
    study_radius = _radius
    study_bbox = bbox_from_center(study_lat, study_lng, study_radius)
    study_area_m2 = pedshed_area_m2(study_radius)
    study_area_ha = pedshed_area_ha(study_radius)
    study_area_km2 = pedshed_area_km2(study_radius)

    mo.md(f"""
**{_city.name}** -- {_city.description}

| Parameter | Value |
|-----------|-------|
| Center | {study_lat:.4f}, {study_lng:.4f} |
| Radius | {study_radius} m |
| Study area | {study_area_ha:.1f} ha ({study_area_km2:.2f} km2) |
| Bbox S/N | {study_bbox['south']:.4f} / {study_bbox['north']:.4f} |
| Bbox W/E | {study_bbox['west']:.4f} / {study_bbox['east']:.4f} |
""")
    return (
        study_lat,
        study_lng,
        study_radius,
        study_bbox,
        study_area_m2,
        study_area_ha,
        study_area_km2,
    )


# ---------------------------------------------------------------------------
# Cell 5 — Land Use query (Overture base/land_use)
# ---------------------------------------------------------------------------
@app.cell
def land_use_query(
    conn,
    S3_LAND_USE,
    study_lat,
    study_lng,
    study_radius,
    study_bbox,
    bbox_predicate,
    pedshed_filter,
    pl,
    mo,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, study_radius)

    _sql = f"""
    SELECT
        class,
        ST_Area_Spheroid(geometry) AS area_m2
    FROM read_parquet('{S3_LAND_USE}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
    """

    mo.md(f"Querying land_use for **{study_radius}m** pedshed ...")
    land_use_df = conn.execute(_sql).pl()

    _types_found = land_use_df["class"].unique().to_list() if land_use_df.height > 0 else []
    mo.md(f"""
Fetched **{land_use_df.height:,}** land-use polygons.

**Classes found:** {', '.join(str(t) for t in sorted(_types_found)) if _types_found else 'none'}
""")
    return (land_use_df,)


# ---------------------------------------------------------------------------
# Cell 6 — M2.1 Land Use Mix (Shannon Entropy)
# ---------------------------------------------------------------------------
@app.cell
def land_use_mix_entropy(land_use_df, normalized_entropy, pl, mo):
    # Group by class and compute total area per class
    _lu_grouped = (
        land_use_df
        .filter(pl.col("class").is_not_null())
        .group_by("class")
        .agg(pl.col("area_m2").sum().alias("total_area_m2"))
        .sort("total_area_m2", descending=True)
    )

    _total_area = _lu_grouped["total_area_m2"].sum()

    # Compute proportions for each land-use class
    _proportions = []
    if _total_area > 0:
        _proportions = [a / _total_area for a in _lu_grouped["total_area_m2"].to_list()]

    # M2.1 -- Land Use Mix Index (normalised Shannon entropy)
    land_use_mix = normalized_entropy(_proportions) if _proportions else 0.0

    _n_classes = len([p for p in _proportions if p > 0])

    # Interpretation
    if land_use_mix > 0.7:
        _interpretation = "High mix -- diverse, multi-functional neighbourhood"
    elif land_use_mix > 0.4:
        _interpretation = "Moderate mix -- some functional diversity"
    elif land_use_mix > 0.3:
        _interpretation = "Low mix -- tending toward single-use"
    else:
        _interpretation = "Monoculture -- dominated by a single land-use type"

    lu_grouped = _lu_grouped

    mo.md(f"""
### M2.1 Land Use Mix (Normalised Shannon Entropy)

| Metric | Value |
|--------|-------|
| **Land Use Mix Index** | `{land_use_mix:.3f}` |
| Classes with area > 0 | {_n_classes} |
| Total classified area | {_total_area:,.0f} m2 |

**Interpretation:** {_interpretation}

> Thresholds: >0.7 = high mix (diverse), <0.3 = monoculture (single-use dominant).
> Reference: Song et al. (2013) -- "Measuring Urban Form"
""")
    return (land_use_mix, lu_grouped)


# ---------------------------------------------------------------------------
# Cell 7 — Land Cover / Canopy query (Overture base/land)
# ---------------------------------------------------------------------------
@app.cell
def land_cover_query(
    conn,
    S3_LAND_COVER,
    study_lat,
    study_lng,
    study_radius,
    study_bbox,
    bbox_predicate,
    pedshed_filter,
    pl,
    mo,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, study_radius)

    _sql = f"""
    SELECT
        class,
        ST_Area_Spheroid(geometry) AS area_m2
    FROM read_parquet('{S3_LAND_COVER}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
    """

    mo.md(f"Querying land_cover for **{study_radius}m** pedshed ...")
    land_cover_df = conn.execute(_sql).pl()

    _cover_classes = land_cover_df["class"].unique().to_list() if land_cover_df.height > 0 else []
    mo.md(f"""
Fetched **{land_cover_df.height:,}** land-cover polygons.

**Cover classes found:** {', '.join(str(c) for c in sorted(_cover_classes)) if _cover_classes else 'none'}
""")
    return (land_cover_df,)


# ---------------------------------------------------------------------------
# Cell 8 — M2.2 Canopy Cover Ratio
# ---------------------------------------------------------------------------
@app.cell
def canopy_cover_metric(land_cover_df, study_area_m2, pl, mo):
    # Canopy-related classes from Overture land cover
    CANOPY_CLASSES = ("forest", "shrub", "wood", "tree", "scrub")

    _canopy_df = land_cover_df.filter(
        pl.col("class").is_in(list(CANOPY_CLASSES))
    )

    canopy_area_m2 = _canopy_df["area_m2"].sum() if _canopy_df.height > 0 else 0.0
    canopy_ratio = canopy_area_m2 / study_area_m2 if study_area_m2 > 0 else 0.0
    canopy_pct = canopy_ratio * 100.0

    # Compare to 30% threshold (Konijnendijk et al., 2013 -- "Benefits of Urban Parks")
    _threshold_pct = 30.0
    _meets_threshold = canopy_pct >= _threshold_pct

    if _meets_threshold:
        _canopy_interpretation = (
            f"Meets the 30% canopy target ({canopy_pct:.1f}% >= {_threshold_pct:.0f}%). "
            "Good urban tree cover for heat mitigation and biodiversity."
        )
    else:
        _deficit_pct = _threshold_pct - canopy_pct
        _canopy_interpretation = (
            f"Below 30% canopy target ({canopy_pct:.1f}% < {_threshold_pct:.0f}%). "
            f"Deficit of {_deficit_pct:.1f} percentage points. "
            "Consider afforestation to improve heat resilience."
        )

    mo.md(f"""
### M2.2 Canopy Cover Ratio

| Metric | Value |
|--------|-------|
| **Canopy Cover** | `{canopy_pct:.1f}%` of pedshed area |
| Canopy area | {canopy_area_m2:,.0f} m2 |
| Pedshed area | {study_area_m2:,.0f} m2 |
| Meets 30% target? | {'Yes' if _meets_threshold else '**No**'} |

**Interpretation:** {_canopy_interpretation}

> Reference: Konijnendijk et al. -- 30% canopy cover target for urban resilience.
> Canopy classes: {', '.join(CANOPY_CLASSES)}
""")
    return (canopy_area_m2, canopy_ratio, canopy_pct)


# ---------------------------------------------------------------------------
# Cell 9 — M2.3 Park Proximity (distance to nearest park)
# ---------------------------------------------------------------------------
@app.cell
def park_proximity_metric(
    conn,
    S3_LAND_USE,
    study_lat,
    study_lng,
    study_radius,
    study_bbox,
    bbox_predicate,
    pedshed_filter,
    mo,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, study_radius)

    # Query for park features in land_use and compute distance from center
    _sql = f"""
    SELECT
        class,
        ST_Distance_Spheroid(
            ST_Centroid(geometry),
            ST_Point({study_lng:.6f}, {study_lat:.6f})
        ) AS distance_m,
        ST_Area_Spheroid(geometry) AS area_m2
    FROM read_parquet('{S3_LAND_USE}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
        AND class IN ('park', 'recreation', 'cemetery', 'garden', 'playground')
    ORDER BY distance_m ASC
    LIMIT 20
    """

    _park_result = conn.execute(_sql).pl()

    if _park_result.height > 0:
        park_nearest_distance_m = _park_result["distance_m"][0]
        park_count = _park_result.height
        _nearest_class = _park_result["class"][0]
        _nearest_area = _park_result["area_m2"][0]
    else:
        park_nearest_distance_m = float("inf")
        park_count = 0
        _nearest_class = "N/A"
        _nearest_area = 0.0

    # Interpretation: WHO recommends green space within 300m
    if park_nearest_distance_m <= 300:
        _park_interpretation = (
            f"Excellent access -- nearest park/green space is {park_nearest_distance_m:.0f}m away "
            f"(within WHO 300m recommendation)."
        )
    elif park_nearest_distance_m <= 500:
        _park_interpretation = (
            f"Adequate access -- nearest park is {park_nearest_distance_m:.0f}m away "
            f"(within 5-min walk, but above WHO 300m ideal)."
        )
    elif park_nearest_distance_m < float("inf"):
        _park_interpretation = (
            f"Poor access -- nearest park is {park_nearest_distance_m:.0f}m away. "
            f"Exceeds the WHO 300m and typical 500m walkable thresholds."
        )
    else:
        _park_interpretation = "No park features found within the pedshed."

    mo.md(f"""
### M2.3 Park Proximity

| Metric | Value |
|--------|-------|
| **Nearest park distance** | `{park_nearest_distance_m:.0f} m` |
| Parks in pedshed | {park_count} |
| Nearest type | {_nearest_class} |
| Nearest area | {_nearest_area:,.0f} m2 |

**Interpretation:** {_park_interpretation}

> Reference: WHO recommends accessible green space within 300m of every residence.
""")
    return (park_nearest_distance_m, park_count)


# ---------------------------------------------------------------------------
# Cell 10 — M2.4 Imperviousness Ratio
# ---------------------------------------------------------------------------
@app.cell
def imperviousness_metric(
    conn,
    S3_BUILDINGS,
    S3_SEGMENTS,
    study_lat,
    study_lng,
    study_radius,
    study_bbox,
    study_area_m2,
    bbox_predicate,
    pedshed_filter,
    mo,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, study_radius)

    # 1. Building footprint area
    _bldg_sql = f"""
    SELECT
        COALESCE(SUM(ST_Area_Spheroid(geometry)), 0) AS total_footprint_m2
    FROM read_parquet('{S3_BUILDINGS}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
    """
    _bldg_result = conn.execute(_bldg_sql).pl()
    _building_footprint_m2 = _bldg_result["total_footprint_m2"][0] if _bldg_result.height > 0 else 0.0

    # 2. Estimated road area (segment length x estimated width)
    # Use road segments, estimate average carriageway width as 7m
    _road_sql = f"""
    SELECT
        COALESCE(
            SUM(ST_Length_Spheroid(geometry) * 7.0),
            0
        ) AS estimated_road_area_m2
    FROM read_parquet('{S3_SEGMENTS}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
        AND subtype = 'road'
    """
    _road_result = conn.execute(_road_sql).pl()
    _road_area_m2 = _road_result["estimated_road_area_m2"][0] if _road_result.height > 0 else 0.0

    # Imperviousness = (building footprint + estimated road area) / pedshed area
    _sealed_area_m2 = _building_footprint_m2 + _road_area_m2
    imperviousness_ratio = _sealed_area_m2 / study_area_m2 if study_area_m2 > 0 else 0.0
    imperviousness_pct = imperviousness_ratio * 100.0

    # Flood risk interpretation
    if imperviousness_pct > 70:
        _flood_interpretation = (
            "Very high imperviousness (>70%). Significant flood risk and urban heat "
            "island effect. Priority area for permeable surfaces and green infrastructure."
        )
    elif imperviousness_pct > 50:
        _flood_interpretation = (
            "High imperviousness (50-70%). Elevated stormwater runoff risk. "
            "Rain gardens, bioswales, and tree planting recommended."
        )
    elif imperviousness_pct > 30:
        _flood_interpretation = (
            "Moderate imperviousness (30-50%). Acceptable for urban areas with "
            "adequate drainage. Monitor for increasing sealed surfaces."
        )
    else:
        _flood_interpretation = (
            "Low imperviousness (<30%). Good permeability and natural drainage. "
            "Typical of green suburbs or parks."
        )

    mo.md(f"""
### M2.4 Imperviousness Ratio

| Metric | Value |
|--------|-------|
| **Imperviousness** | `{imperviousness_pct:.1f}%` of pedshed area |
| Building footprint | {_building_footprint_m2:,.0f} m2 |
| Estimated road area | {_road_area_m2:,.0f} m2 (length x 7m avg width) |
| Total sealed area | {_sealed_area_m2:,.0f} m2 |
| Pedshed area | {study_area_m2:,.0f} m2 |

**Flood risk interpretation:** {_flood_interpretation}

> Imperviousness = (building footprint + estimated road area) / pedshed area.
> Road width estimated at 7m average carriageway. Real values vary by road class.
""")
    return (imperviousness_ratio, imperviousness_pct)


# ---------------------------------------------------------------------------
# Cell 11 — Summary table (all 5 metrics)
# ---------------------------------------------------------------------------
@app.cell
def summary_table(
    land_use_mix,
    canopy_pct,
    canopy_ratio,
    park_nearest_distance_m,
    park_count,
    imperviousness_pct,
    imperviousness_ratio,
    compute_green_access,
    interpret_green_access,
    city_dropdown,
    radius_m,
    CITIES,
    pl,
    mo,
):
    _city = CITIES[city_dropdown.value]
    _radius = radius_m.value

    # Build summary dataframe
    _rows = [
        {
            "Metric": "M2.1 Land Use Mix",
            "Value": f"{land_use_mix:.3f}",
            "Unit": "index (0-1)",
            "Threshold": ">0.7 high mix, <0.3 monoculture",
            "Interpretation": "High" if land_use_mix > 0.7 else ("Moderate" if land_use_mix > 0.4 else "Low"),
        },
        {
            "Metric": "M2.2 Canopy Cover",
            "Value": f"{canopy_pct:.1f}",
            "Unit": "% of pedshed",
            "Threshold": ">=30% (Konijnendijk)",
            "Interpretation": "Meets target" if canopy_pct >= 30 else f"Below target by {30 - canopy_pct:.1f}pp",
        },
        {
            "Metric": "M2.3 Park Proximity",
            "Value": f"{park_nearest_distance_m:.0f}" if park_nearest_distance_m < float("inf") else "N/A",
            "Unit": "metres",
            "Threshold": "<=300m (WHO)",
            "Interpretation": (
                "Excellent" if park_nearest_distance_m <= 300
                else ("Adequate" if park_nearest_distance_m <= 500 else "Poor")
            ),
        },
        {
            "Metric": "M2.4 Imperviousness",
            "Value": f"{imperviousness_pct:.1f}",
            "Unit": "% of pedshed",
            "Threshold": "<50% low flood risk",
            "Interpretation": (
                "Very high" if imperviousness_pct > 70
                else ("High" if imperviousness_pct > 50
                      else ("Moderate" if imperviousness_pct > 30 else "Low"))
            ),
        },
        {
            "Metric": "M2.5 Green Access Score",
            "Value": f"{compute_green_access(canopy_ratio, park_nearest_distance_m, park_count):.2f}",
            "Unit": "composite (0-1)",
            "Threshold": ">0.6 good, <0.3 poor",
            "Interpretation": interpret_green_access(
                compute_green_access(canopy_ratio, park_nearest_distance_m, park_count)
            ),
        },
    ]

    summary_df = pl.DataFrame(_rows)

    mo.md(f"""
---

## Chapter 2 -- Land Use & Resilience Summary

**City:** {_city.name} | **Radius:** {_radius} m

{mo.as_html(summary_df.to_pandas())}

*5 metrics from Overture Maps base data (land_use, land, buildings, segments),
computed via DuckDB + S3 predicate pushdown.*
""")
    return (summary_df,)


@app.cell
def green_access_helpers():
    """Helper functions for the composite Green Access Score (M2.5)."""

    def compute_green_access(canopy_ratio, park_distance_m, park_count):
        """Composite green access score combining canopy, proximity, and count.

        Weighted average:
        - 40% canopy coverage (normalised to 30% target)
        - 40% park proximity (inverse distance, normalised to 500m)
        - 20% park count (normalised to 5 parks)
        """
        # Canopy component: ratio of actual canopy to 30% target, capped at 1.0
        canopy_score = min(canopy_ratio / 0.30, 1.0)

        # Proximity component: inverse distance normalised to 500m threshold
        if park_distance_m <= 0 or park_distance_m == float("inf"):
            proximity_score = 0.0
        else:
            proximity_score = max(0.0, min(1.0, 1.0 - (park_distance_m / 500.0)))

        # Count component: normalised to 5 parks benchmark
        count_score = min(park_count / 5.0, 1.0)

        return 0.4 * canopy_score + 0.4 * proximity_score + 0.2 * count_score

    def interpret_green_access(score):
        if score > 0.6:
            return "Good"
        elif score > 0.3:
            return "Moderate"
        else:
            return "Poor"

    return (compute_green_access, interpret_green_access)


# ---------------------------------------------------------------------------
# Cell 12 — Visualisations
# ---------------------------------------------------------------------------
@app.cell
def visualisations(
    lu_grouped,
    land_cover_df,
    canopy_area_m2,
    study_area_m2,
    land_use_mix,
    pl,
    alt,
    math,
    mo,
):
    # -----------------------------------------------------------------------
    # Chart 1: Land use composition (horizontal bar chart by class)
    # -----------------------------------------------------------------------
    _lu_chart_data = lu_grouped.to_pandas()

    land_use_bar_chart = (
        alt.Chart(_lu_chart_data)
        .mark_bar()
        .encode(
            x=alt.X("total_area_m2:Q", title="Area (m\u00b2)"),
            y=alt.Y("class:N", sort="-x", title="Land Use Class"),
            color=alt.Color(
                "class:N",
                legend=None,
                scale=alt.Scale(scheme="tableau20"),
            ),
            tooltip=[
                alt.Tooltip("class:N", title="Class"),
                alt.Tooltip("total_area_m2:Q", title="Area m\u00b2", format=",.0f"),
            ],
        )
        .properties(
            title="Land Use Composition by Area",
            width=550,
            height=350,
        )
    )

    # -----------------------------------------------------------------------
    # Chart 2: Green vs sealed area donut chart
    # -----------------------------------------------------------------------
    GREEN_CLASSES = ("forest", "shrub", "wood", "tree", "scrub", "grass", "wetland", "moss")

    _cover_grouped = (
        land_cover_df
        .filter(pl.col("class").is_not_null())
        .group_by("class")
        .agg(pl.col("area_m2").sum().alias("total_area_m2"))
    )

    _cover_dict = dict(
        zip(
            _cover_grouped["class"].to_list(),
            _cover_grouped["total_area_m2"].to_list(),
        )
    ) if _cover_grouped.height > 0 else {}

    _green_total = sum(_cover_dict.get(c, 0.0) for c in GREEN_CLASSES)
    _other_cover = sum(v for k, v in _cover_dict.items() if k not in GREEN_CLASSES)
    _unclassified = max(0.0, study_area_m2 - _green_total - _other_cover)

    _donut_data = pl.DataFrame({
        "category": ["Green / Canopy", "Built / Other Cover", "Unclassified"],
        "area_m2": [_green_total, _other_cover, _unclassified],
    }).to_pandas()

    donut_chart = (
        alt.Chart(_donut_data)
        .mark_arc(innerRadius=80)
        .encode(
            theta=alt.Theta("area_m2:Q", title="Area (m\u00b2)"),
            color=alt.Color(
                "category:N",
                title="Category",
                scale=alt.Scale(
                    domain=["Green / Canopy", "Built / Other Cover", "Unclassified"],
                    range=["#4caf50", "#795548", "#bdbdbd"],
                ),
            ),
            tooltip=[
                alt.Tooltip("category:N", title="Category"),
                alt.Tooltip("area_m2:Q", title="Area m\u00b2", format=",.0f"),
            ],
        )
        .properties(
            title="Green vs Sealed Area",
            width=380,
            height=380,
        )
    )

    # -----------------------------------------------------------------------
    # Chart 3: Land Use Diversity gauge (entropy value as arc)
    # -----------------------------------------------------------------------
    # Build a simple gauge-like arc chart showing the entropy value
    _gauge_bg = pl.DataFrame({
        "label": ["Remaining"],
        "value": [1.0 - land_use_mix],
    }).to_pandas()

    _gauge_fg = pl.DataFrame({
        "label": ["Land Use Mix"],
        "value": [land_use_mix],
    }).to_pandas()

    _gauge_all = pl.DataFrame({
        "label": ["Land Use Mix", "Remaining"],
        "value": [land_use_mix, 1.0 - land_use_mix],
        "color_key": ["mix", "bg"],
    }).to_pandas()

    gauge_chart = (
        alt.Chart(_gauge_all)
        .mark_arc(innerRadius=60, outerRadius=100)
        .encode(
            theta=alt.Theta("value:Q", stack=True),
            color=alt.Color(
                "color_key:N",
                scale=alt.Scale(
                    domain=["mix", "bg"],
                    range=["#1976d2", "#e0e0e0"],
                ),
                legend=None,
            ),
            tooltip=[
                alt.Tooltip("label:N", title=""),
                alt.Tooltip("value:Q", title="Value", format=".3f"),
            ],
        )
        .properties(
            title=f"Land Use Diversity: {land_use_mix:.3f}",
            width=250,
            height=250,
        )
    )

    # Compose layout: bar chart on top, donut and gauge side by side below
    _bottom_row = alt.hconcat(donut_chart, gauge_chart).resolve_scale(color="independent")
    combined_chart = alt.vconcat(land_use_bar_chart, _bottom_row)

    mo.md("### Visualisations")
    combined_chart
    return (land_use_bar_chart, donut_chart, gauge_chart, combined_chart)


if __name__ == "__main__":
    app.run()

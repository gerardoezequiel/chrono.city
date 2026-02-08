import marimo

__generated_with = "0.10.0"
app = marimo.App(width="medium")


# ---------------------------------------------------------------------------
# Cell 1 — Imports
# ---------------------------------------------------------------------------
@app.cell
def _():
    import marimo as mo
    import sys
    import os
    import math
    import json
    import numpy as np
    import polars as pl
    import altair as alt

    # Ensure the notebooks/ directory is on the path so we can import utils
    _nb_dir = os.path.dirname(os.path.abspath("__file__"))
    if _nb_dir not in sys.path:
        sys.path.insert(0, _nb_dir)

    from utils.overture import (
        init_duckdb,
        CITIES,
        S3_SEGMENTS,
        S3_CONNECTORS,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_km2,
        pedshed_area_m2,
        DEFAULT_RADIUS_M,
    )

    return (
        mo,
        sys,
        os,
        math,
        json,
        np,
        pl,
        alt,
        init_duckdb,
        CITIES,
        S3_SEGMENTS,
        S3_CONNECTORS,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_km2,
        pedshed_area_m2,
        DEFAULT_RADIUS_M,
    )


# ---------------------------------------------------------------------------
# Cell 2 — DuckDB init
# ---------------------------------------------------------------------------
@app.cell
def _(init_duckdb):
    conn = init_duckdb()
    return (conn,)


# ---------------------------------------------------------------------------
# Cell 3 — City selector & radius slider
# ---------------------------------------------------------------------------
@app.cell
def _(mo, CITIES, DEFAULT_RADIUS_M):
    city_options = {
        f"{preset.name} — {preset.description}": key
        for key, preset in CITIES.items()
    }
    _default = CITIES["london_piccadilly"]
    city_dropdown = mo.ui.dropdown(
        options=city_options,
        value=f"{_default.name} — {_default.description}",
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
## Ch 4 — Street Network (Connectivity)

Compute street network connectivity metrics from Overture Maps transportation data.

{city_dropdown}

{radius_slider}
""")
    return (city_dropdown, radius_slider)


# ---------------------------------------------------------------------------
# Cell 4 — Compute bbox & pedshed areas
# ---------------------------------------------------------------------------
@app.cell
def _(
    city_dropdown,
    radius_slider,
    CITIES,
    bbox_from_center,
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
    study_area_km2 = pedshed_area_km2(study_radius)
    study_area_m2 = pedshed_area_m2(study_radius)

    mo.md(f"""
**{_city.name}** — {_city.description}

| Parameter | Value |
|-----------|-------|
| Center | {study_lat:.4f}, {study_lng:.4f} |
| Radius | {study_radius} m |
| Study area | {study_area_km2:.2f} km2 ({study_area_m2:,.0f} m2) |
| Bbox S/N | {study_bbox['south']:.4f} / {study_bbox['north']:.4f} |
| Bbox W/E | {study_bbox['west']:.4f} / {study_bbox['east']:.4f} |
""")
    return (
        study_lat,
        study_lng,
        study_radius,
        study_bbox,
        study_area_km2,
        study_area_m2,
    )


# ---------------------------------------------------------------------------
# Cell 5 — Query segments from Overture transportation
# ---------------------------------------------------------------------------
@app.cell
def _(
    conn,
    S3_SEGMENTS,
    study_lat,
    study_lng,
    study_radius,
    study_bbox,
    bbox_predicate,
    pedshed_filter,
    mo,
    pl,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, study_radius)

    _sql = f"""
    SELECT
        id,
        class,
        subtype,
        connectors,
        ST_Length_Spheroid(geometry) AS length_m,
        ST_AsGeoJSON(geometry) AS geom_json
    FROM read_parquet('{S3_SEGMENTS}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
        AND subtype = 'road'
    """

    mo.md(f"Querying road segments for **{study_radius}m** pedshed ...")
    segments_df = conn.execute(_sql).pl()
    segment_count = len(segments_df)
    mo.md(f"Fetched **{segment_count:,}** road segments.")
    return (segments_df, segment_count)


# ---------------------------------------------------------------------------
# Cell 6 — Query connectors from Overture transportation
# ---------------------------------------------------------------------------
@app.cell
def _(
    conn,
    S3_CONNECTORS,
    study_lat,
    study_lng,
    study_radius,
    study_bbox,
    bbox_predicate,
    pedshed_filter,
    mo,
    pl,
):
    _bbox_pred_c = bbox_predicate(study_bbox)
    _circle_pred_c = pedshed_filter(study_lat, study_lng, study_radius)

    _sql_c = f"""
    SELECT
        id,
        ST_X(geometry) AS lng,
        ST_Y(geometry) AS lat
    FROM read_parquet('{S3_CONNECTORS}', hive_partitioning=1)
    WHERE {_bbox_pred_c}
        AND {_circle_pred_c}
    """

    mo.md(f"Querying connectors for **{study_radius}m** pedshed ...")
    connectors_df = conn.execute(_sql_c).pl()
    connector_count = len(connectors_df)
    mo.md(f"Fetched **{connector_count:,}** connectors (network nodes).")
    return (connectors_df, connector_count)


# ---------------------------------------------------------------------------
# Cell 7 — Build graph: node degree map from segments & connectors
# ---------------------------------------------------------------------------
@app.cell
def _(segments_df, connectors_df, connector_count, mo):
    # Build a set of valid connector IDs within the pedshed
    _valid_ids = set(connectors_df["id"].to_list())

    # Count how many segments reference each connector (node degree)
    _degree_map: dict[str, int] = {}
    _connectors_col = segments_df["connectors"].to_list()

    for _seg_connectors in _connectors_col:
        if _seg_connectors is None:
            continue
        # Each segment's connectors is a list of dicts with 'connector_id' key,
        # or a list of strings — handle both formats
        for _item in _seg_connectors:
            if isinstance(_item, dict):
                _cid = _item.get("connector_id", _item.get("id", ""))
            elif isinstance(_item, str):
                _cid = _item
            else:
                continue
            if _cid in _valid_ids:
                _degree_map[_cid] = _degree_map.get(_cid, 0) + 1

    # Classify nodes by degree
    dead_ends = sum(1 for d in _degree_map.values() if d == 1)
    pass_through = sum(1 for d in _degree_map.values() if d == 2)
    intersections_3way = sum(1 for d in _degree_map.values() if d >= 3)
    intersections_4way = sum(1 for d in _degree_map.values() if d >= 4)
    total_graph_nodes = len(_degree_map)
    total_graph_edges = len(_connectors_col)

    # Build a list of (degree, count) for distribution chart
    _degree_counts: dict[int, int] = {}
    for _d in _degree_map.values():
        _degree_counts[_d] = _degree_counts.get(_d, 0) + 1
    degree_distribution = sorted(_degree_counts.items())

    mo.md(f"""
### Network Graph Summary

| Node Type | Count |
|-----------|-------|
| Dead ends (degree=1) | {dead_ends:,} |
| Pass-through (degree=2) | {pass_through:,} |
| Intersections (degree>=3) | {intersections_3way:,} |
| 4-way+ intersections (degree>=4) | {intersections_4way:,} |
| **Total graph nodes** | {total_graph_nodes:,} |
| **Total segments (edges)** | {total_graph_edges:,} |
| Connectors in pedshed | {connector_count:,} |
""")
    return (
        dead_ends,
        pass_through,
        intersections_3way,
        intersections_4way,
        total_graph_nodes,
        total_graph_edges,
        degree_distribution,
    )


# ---------------------------------------------------------------------------
# Cell 8 — Metric 1: Intersection Density
# ---------------------------------------------------------------------------
@app.cell
def _(intersections_3way, study_area_km2, mo):
    intersection_density = intersections_3way / study_area_km2 if study_area_km2 > 0 else 0.0

    if intersection_density > 100:
        _int_label = "Walkable grid (>100/km2)"
    elif intersection_density > 50:
        _int_label = "Moderate connectivity (50-100/km2)"
    else:
        _int_label = "Car-dependent / sparse (<50/km2)"

    mo.md(f"""
### 4.1 Intersection Density

**{intersection_density:.1f} intersections/km2** — {_int_label}

Intersections (nodes with degree >= 3) divided by the pedshed area.

| Threshold | Interpretation |
|-----------|---------------|
| > 100/km2 | Walkable grid pattern |
| 50-100/km2 | Moderate connectivity |
| < 50/km2 | Car-dependent, sparse network |
""")
    return (intersection_density,)


# ---------------------------------------------------------------------------
# Cell 9 — Metric 2: Alpha Index (Connectivity)
# ---------------------------------------------------------------------------
@app.cell
def _(total_graph_nodes, total_graph_edges, mo):
    # Alpha index: ratio of actual circuits to maximum possible circuits
    # Formula: alpha = (e - n + 1) / (2n - 5)
    # where e = edges, n = nodes
    _e = total_graph_edges
    _n = total_graph_nodes

    _denom = 2 * _n - 5
    if _denom > 0 and _n >= 3:
        alpha_index = (_e - _n + 1) / _denom
    else:
        alpha_index = 0.0

    # Clamp to [0, 1] range
    alpha_index = max(0.0, min(1.0, alpha_index))

    if alpha_index > 0.5:
        _alpha_label = "Highly connected network (>0.5)"
    elif alpha_index > 0.25:
        _alpha_label = "Moderately connected (0.25-0.5)"
    else:
        _alpha_label = "Tree-like / poorly connected (<0.25)"

    mo.md(f"""
### 4.2 Alpha Index (Circuit Connectivity)

**{alpha_index:.3f}** — {_alpha_label}

The alpha index measures the ratio of actual circuits (loops) to the maximum
possible number of circuits in a planar graph.

Formula: alpha = (e - n + 1) / (2n - 5), where e = edges, n = nodes.

A value of 0 means a tree (no circuits), and 1 means the maximum number of
independent circuits for a planar graph.

| Threshold | Interpretation |
|-----------|---------------|
| > 0.5 | Highly connected, many alternative routes |
| 0.25-0.5 | Moderately connected |
| < 0.25 | Tree-like, few alternative routes |
""")
    return (alpha_index,)


# ---------------------------------------------------------------------------
# Cell 10 — Metric 3: Orientation Entropy
# ---------------------------------------------------------------------------
@app.cell
def _(segments_df, np, json, math, mo, pl):
    # Parse geom_json to extract start/end coordinates and compute bearings
    _geom_jsons = segments_df["geom_json"].to_list()

    _bearings = []
    for _gj in _geom_jsons:
        if _gj is None:
            continue
        _parsed = json.loads(_gj)
        _coords = _parsed.get("coordinates", [])
        if len(_coords) < 2:
            continue
        # Use start and end points of the segment
        _x0, _y0 = _coords[0][0], _coords[0][1]
        _x1, _y1 = _coords[-1][0], _coords[-1][1]

        _dx = _x1 - _x0
        _dy = _y1 - _y0
        if _dx == 0 and _dy == 0:
            continue

        # Compute bearing in degrees (0 = East, counter-clockwise)
        _bearing = np.degrees(np.arctan2(_dy, _dx))
        # Convert to compass bearing (0 = North, clockwise)
        _compass = (90 - _bearing) % 360
        # Fold to 0-180 range (undirected: north = south)
        _folded = _compass % 180
        _bearings.append(_folded)

    _bearings_arr = np.array(_bearings)

    # Bin into 36 bins of 5 degrees each (0-180)
    _n_bins = 36
    _bin_width = 180.0 / _n_bins
    _bin_edges_arr = np.linspace(0, 180, _n_bins + 1)
    _bin_counts_arr, _ = np.histogram(_bearings_arr, bins=_bin_edges_arr)
    _bin_centers = (_bin_edges_arr[:-1] + _bin_edges_arr[1:]) / 2.0

    # Compute Shannon entropy
    _total_segments_bearing = _bin_counts_arr.sum()
    if _total_segments_bearing > 0:
        _proportions = _bin_counts_arr / _total_segments_bearing
    else:
        _proportions = np.zeros(_n_bins)

    _h_max = math.log2(_n_bins)
    _h_raw = -sum(
        float(p) * math.log2(float(p)) for p in _proportions if p > 0
    )
    orientation_entropy = _h_raw / _h_max if _h_max > 0 else 0.0

    # Grid order: sum of top 4 bin weights
    _sorted_props = sorted(_proportions, reverse=True)
    grid_order = sum(_sorted_props[:4])

    # Prepare data for rose / bar chart
    bearing_bin_centers = _bin_centers.tolist()
    bearing_bin_counts = _bin_counts_arr.tolist()
    bearing_proportions = _proportions.tolist()

    if orientation_entropy > 0.9:
        _entropy_label = "Organic / irregular layout (high entropy > 0.9)"
    elif orientation_entropy > 0.7:
        _entropy_label = "Moderate grid order (entropy 0.7-0.9)"
    else:
        _entropy_label = "Strong grid pattern (low entropy < 0.7)"

    if grid_order > 0.3:
        _grid_label = "Strong dominant axes"
    elif grid_order > 0.2:
        _grid_label = "Moderate grid tendency"
    else:
        _grid_label = "No dominant axis"

    mo.md(f"""
### 4.3 Orientation Entropy

**Normalized entropy: {orientation_entropy:.3f}** — {_entropy_label}

**Grid order (top-4 bin weight): {grid_order:.3f}** — {_grid_label}

Bearings are folded to 0-180 degrees (undirected) and binned into {_n_bins} bins
of {_bin_width:.0f} degrees each. Shannon entropy is normalized by log2({_n_bins}).

A perfectly uniform distribution (all directions equally likely) yields entropy = 1.0.
A perfect grid (all segments aligned to one axis) yields entropy near 0.

| Metric | Value | Interpretation |
|--------|-------|---------------|
| Orientation entropy | {orientation_entropy:.3f} | 0 = perfect grid, 1 = uniform |
| Grid order | {grid_order:.3f} | Sum of top-4 bin weights |
| Total bearings | {len(_bearings):,} | Segments with valid geometry |
""")
    return (
        orientation_entropy,
        grid_order,
        bearing_bin_centers,
        bearing_bin_counts,
        bearing_proportions,
    )


# ---------------------------------------------------------------------------
# Cell 11 — Metric 4: Dead-End Ratio (SNDi)
# ---------------------------------------------------------------------------
@app.cell
def _(dead_ends, total_graph_nodes, mo):
    dead_end_ratio = dead_ends / total_graph_nodes if total_graph_nodes > 0 else 0.0

    if dead_end_ratio > 0.3:
        _de_label = "Suburban sprawl / cul-de-sac pattern (>0.3)"
    elif dead_end_ratio > 0.1:
        _de_label = "Mixed network (0.1-0.3)"
    else:
        _de_label = "Well-connected grid (<0.1)"

    mo.md(f"""
### 4.4 Dead-End Ratio (SNDi)

**{dead_end_ratio:.3f}** — {_de_label}

Ratio of dead-end nodes (degree = 1) to total network nodes. A high ratio
indicates a dendritic, cul-de-sac-heavy network typical of suburban sprawl.

| Threshold | Interpretation |
|-----------|---------------|
| > 0.3 | Suburban sprawl, many cul-de-sacs |
| 0.1-0.3 | Mixed connectivity |
| < 0.1 | Well-connected grid |
""")
    return (dead_end_ratio,)


# ---------------------------------------------------------------------------
# Cell 12 — Metric 5: Active Transport Share
# ---------------------------------------------------------------------------
@app.cell
def _(segments_df, pl, mo):
    # Active transport classes: footway, pedestrian, cycleway, path, steps
    _active_classes = ["footway", "pedestrian", "cycleway", "path", "steps"]

    _total_length = segments_df["length_m"].sum()
    _active_length = segments_df.filter(
        pl.col("class").is_in(_active_classes)
    )["length_m"].sum()

    active_transport_share = _active_length / _total_length if _total_length > 0 else 0.0

    # Per-class breakdown
    _class_lengths = (
        segments_df.group_by("class")
        .agg(
            pl.col("length_m").sum().alias("total_length_m"),
            pl.len().alias("segment_count"),
        )
        .sort("total_length_m", descending=True)
    )
    class_breakdown_df = _class_lengths.with_columns(
        (pl.col("total_length_m") / _total_length * 100).alias("pct")
    )

    if active_transport_share > 0.3:
        _at_label = "Excellent active transport infrastructure (>30%)"
    elif active_transport_share > 0.15:
        _at_label = "Moderate active transport share (15-30%)"
    else:
        _at_label = "Car-dominated network (<15%)"

    mo.md(f"""
### 4.5 Active Transport Share

**{active_transport_share:.1%}** of network length — {_at_label}

Active transport length: {_active_length:,.0f} m out of {_total_length:,.0f} m total.

Active classes: {', '.join(_active_classes)}

| Threshold | Interpretation |
|-----------|---------------|
| > 30% | Excellent pedestrian/cycling infrastructure |
| 15-30% | Moderate active transport |
| < 15% | Car-dominated network |
""")
    return (active_transport_share, class_breakdown_df)


# ---------------------------------------------------------------------------
# Cell 13 — Summary table: all 5 metrics
# ---------------------------------------------------------------------------
@app.cell
def _(
    mo,
    city_dropdown,
    radius_slider,
    CITIES,
    study_area_km2,
    intersection_density,
    alpha_index,
    orientation_entropy,
    grid_order,
    dead_end_ratio,
    active_transport_share,
    segment_count,
    connector_count,
    total_graph_nodes,
    total_graph_edges,
):
    _city = CITIES[city_dropdown.value]

    mo.md(f"""
---

## Summary — {_city.name} ({radius_slider.value}m pedshed)

| # | Metric | Value | Category |
|---|--------|-------|----------|
| 1 | **Intersection Density** | {intersection_density:.1f} /km2 | Connectivity |
| 2 | **Alpha Index** | {alpha_index:.3f} | Connectivity |
| 3 | **Orientation Entropy** | {orientation_entropy:.3f} | Network form |
| 4 | **Grid Order** (top-4 bins) | {grid_order:.3f} | Network form |
| 5 | **Dead-End Ratio** (SNDi) | {dead_end_ratio:.3f} | Connectivity |
| 6 | **Active Transport Share** | {active_transport_share:.1%} | Modal infrastructure |

| Overview | Value |
|----------|-------|
| Study area | {study_area_km2:.2f} km2 |
| Road segments | {segment_count:,} |
| Connectors (raw) | {connector_count:,} |
| Graph nodes | {total_graph_nodes:,} |
| Graph edges | {total_graph_edges:,} |

*5 street network metrics from Overture Maps transportation data, computed via DuckDB + S3 predicate pushdown.*
""")
    return ()


# ---------------------------------------------------------------------------
# Cell 14 — Visualization: Orientation bearing bar chart
# ---------------------------------------------------------------------------
@app.cell
def _(bearing_bin_centers, bearing_bin_counts, bearing_proportions, pl, alt, mo):
    _bearing_df = pl.DataFrame({
        "bearing_deg": bearing_bin_centers,
        "count": bearing_bin_counts,
        "proportion": bearing_proportions,
    })

    orientation_chart = (
        alt.Chart(_bearing_df.to_pandas())
        .mark_bar(opacity=0.8, color="#4ecdc4")
        .encode(
            x=alt.X(
                "bearing_deg:Q",
                title="Bearing (0-180 degrees, folded)",
                scale=alt.Scale(domain=[0, 180]),
                bin=alt.Bin(step=5),
            ),
            y=alt.Y("proportion:Q", title="Proportion of segments"),
            tooltip=[
                alt.Tooltip("bearing_deg:Q", title="Bearing", format=".0f"),
                alt.Tooltip("count:Q", title="Count"),
                alt.Tooltip("proportion:Q", title="Proportion", format=".3f"),
            ],
        )
        .properties(
            width=550,
            height=300,
            title="Street Orientation Distribution (0-180 degrees, undirected)",
        )
    )

    mo.md("### Orientation Rose (Bar Chart)")
    orientation_chart
    return (orientation_chart,)


# ---------------------------------------------------------------------------
# Cell 15 — Visualization: Road class distribution (horizontal bar)
# ---------------------------------------------------------------------------
@app.cell
def _(class_breakdown_df, alt, mo):
    road_class_chart = (
        alt.Chart(class_breakdown_df.to_pandas())
        .mark_bar(opacity=0.8)
        .encode(
            y=alt.Y("class:N", sort="-x", title="Road class"),
            x=alt.X("total_length_m:Q", title="Total length (m)"),
            color=alt.Color(
                "class:N",
                legend=None,
                scale=alt.Scale(scheme="tableau20"),
            ),
            tooltip=[
                alt.Tooltip("class:N", title="Class"),
                alt.Tooltip("total_length_m:Q", title="Length (m)", format=",.0f"),
                alt.Tooltip("segment_count:Q", title="Segments"),
                alt.Tooltip("pct:Q", title="% of network", format=".1f"),
            ],
        )
        .properties(
            width=500,
            height=350,
            title="Road Class Distribution by Length",
        )
    )

    mo.md("### Road Class Distribution")
    road_class_chart
    return (road_class_chart,)


# ---------------------------------------------------------------------------
# Cell 16 — Visualization: Node degree distribution (bar chart)
# ---------------------------------------------------------------------------
@app.cell
def _(degree_distribution, pl, alt, mo):
    _deg_df = pl.DataFrame({
        "degree": [d for d, _ in degree_distribution],
        "count": [c for _, c in degree_distribution],
    })

    degree_chart = (
        alt.Chart(_deg_df.to_pandas())
        .mark_bar(opacity=0.8, color="#e45756")
        .encode(
            x=alt.X("degree:O", title="Node Degree"),
            y=alt.Y("count:Q", title="Number of Nodes"),
            tooltip=[
                alt.Tooltip("degree:O", title="Degree"),
                alt.Tooltip("count:Q", title="Count"),
            ],
        )
        .properties(
            width=400,
            height=300,
            title="Node Degree Distribution",
        )
    )

    mo.md("### Node Degree Distribution")
    degree_chart
    return (degree_chart,)


if __name__ == "__main__":
    app.run()

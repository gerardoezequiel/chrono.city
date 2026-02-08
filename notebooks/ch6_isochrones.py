import marimo

__generated_with = "0.10.0"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import sys
    import os
    import math
    import json
    import heapq
    import numpy as np
    import polars as pl
    import altair as alt
    from collections import defaultdict

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
        mo, sys, os, math, json, heapq, np, pl, alt, defaultdict,
        init_duckdb, CITIES, S3_SEGMENTS, S3_CONNECTORS,
        bbox_from_center, bbox_predicate, pedshed_filter,
        pedshed_area_km2, pedshed_area_m2, DEFAULT_RADIUS_M,
    )


@app.cell
def _(init_duckdb):
    conn = init_duckdb()
    return (conn,)


@app.cell
def _(mo, CITIES):
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
    walk_minutes_slider = mo.ui.slider(
        start=5, stop=20, step=1, value=15,
        label="Walk time (minutes)",
    )
    walk_speed_slider = mo.ui.slider(
        start=3.0, stop=6.0, step=0.1, value=4.5,
        label="Walk speed (km/h)",
    )
    mo.md(f"""
## Ch 6 — Walking Isochrones from Overture Maps

Compute **network-based walking isochrones** using Dijkstra's algorithm
on the Overture transportation graph. No external routing API — pure
graph traversal on segments and connectors queried from S3.

{city_dropdown}

{walk_minutes_slider}

{walk_speed_slider}
""")
    return (city_dropdown, walk_minutes_slider, walk_speed_slider)


@app.cell
def _(city_dropdown, walk_minutes_slider, walk_speed_slider, CITIES, bbox_from_center, pedshed_area_km2, mo):
    _city_key = city_dropdown.value
    _city = CITIES[_city_key]

    study_lat = _city.lat
    study_lng = _city.lng
    walk_minutes = walk_minutes_slider.value
    walk_speed_kmh = walk_speed_slider.value
    walk_speed_ms = walk_speed_kmh / 3.6
    walk_budget_s = walk_minutes * 60
    walk_range_m = walk_speed_ms * walk_budget_s
    query_radius_m = walk_range_m * 1.5
    study_bbox = bbox_from_center(study_lat, study_lng, query_radius_m)
    circle_area_km2 = pedshed_area_km2(walk_range_m)

    mo.md(f"""
**{_city.name}** — Walking isochrone parameters

| Parameter | Value |
|-----------|-------|
| Centre | {study_lat:.4f}, {study_lng:.4f} |
| Walk time | {walk_minutes} min |
| Walk speed | {walk_speed_kmh} km/h ({walk_speed_ms:.2f} m/s) |
| Walk budget | {walk_budget_s} s |
| Max range | {walk_range_m:.0f} m |
| Query radius | {query_radius_m:.0f} m (1.5× buffer) |
| Circle area | {circle_area_km2:.3f} km² |
""")
    return (
        study_lat, study_lng, walk_minutes, walk_speed_kmh, walk_speed_ms,
        walk_budget_s, walk_range_m, query_radius_m, study_bbox, circle_area_km2,
    )


@app.cell
def _(conn, S3_SEGMENTS, study_lat, study_lng, query_radius_m, study_bbox, bbox_predicate, pedshed_filter, mo, pl):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, query_radius_m)
    _walkable_classes = [
        "residential", "tertiary", "secondary", "primary",
        "living_street", "pedestrian", "footway", "path",
        "cycleway", "unclassified", "service", "steps", "track",
    ]
    _class_list = ", ".join(f"'{c}'" for c in _walkable_classes)

    _sql = f"""
    SELECT
        id, class, subtype, connectors,
        ST_Length_Spheroid(geometry) AS length_m,
        ST_AsGeoJSON(geometry) AS geom_json
    FROM read_parquet('{S3_SEGMENTS}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
        AND subtype = 'road'
        AND class IN ({_class_list})
    """

    segments_df = conn.execute(_sql).pl()
    segment_count = len(segments_df)

    _class_summary = (
        segments_df.group_by("class")
        .agg(pl.len().alias("count"), pl.col("length_m").sum().alias("total_m"))
        .sort("total_m", descending=True)
    )

    mo.md(f"Fetched **{segment_count:,}** walkable segments within {query_radius_m:.0f} m.")
    return (segments_df, segment_count)


@app.cell
def _(conn, S3_CONNECTORS, study_lat, study_lng, query_radius_m, study_bbox, bbox_predicate, pedshed_filter, mo):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, query_radius_m)

    _sql = f"""
    SELECT id, ST_X(geometry) AS lng, ST_Y(geometry) AS lat
    FROM read_parquet('{S3_CONNECTORS}', hive_partitioning=1)
    WHERE {_bbox_pred} AND {_circle_pred}
    """

    _connectors_df = conn.execute(_sql).pl()
    connector_count = len(_connectors_df)

    connector_coords: dict[str, tuple[float, float]] = {}
    for _r in _connectors_df.iter_rows(named=True):
        connector_coords[_r["id"]] = (_r["lat"], _r["lng"])

    mo.md(f"Fetched **{connector_count:,}** connectors (graph nodes).")
    return (connector_coords, connector_count)


@app.cell
def _build_graph(segments_df, connector_coords, walk_speed_ms, defaultdict, mo):
    """Build walking graph: split segments at connectors into sub-edges."""

    graph: dict[str, list[tuple[str, float, float]]] = defaultdict(list)
    edge_count = 0
    skipped_segments = 0

    for _r in segments_df.iter_rows(named=True):
        _connectors = _r["connectors"]
        _length = _r["length_m"]

        if _connectors is None or len(_connectors) < 2:
            skipped_segments += 1
            continue

        _cids = []
        _lrs = []
        for _item in _connectors:
            if isinstance(_item, dict):
                _c = _item.get("connector_id", _item.get("id", ""))
                _l = _item.get("at", 0.0)
                if _c in connector_coords:
                    _cids.append(_c)
                    _lrs.append(float(_l))

        if len(_cids) < 2:
            skipped_segments += 1
            continue

        _pairs = sorted(zip(_lrs, _cids))
        _lrs = [_p[0] for _p in _pairs]
        _cids = [_p[1] for _p in _pairs]

        for _i in range(len(_cids) - 1):
            _span = _lrs[_i + 1] - _lrs[_i]
            if _span <= 0:
                continue
            _sub_m = _length * _span
            _cost = _sub_m / walk_speed_ms
            graph[_cids[_i]].append((_cids[_i + 1], _cost, _sub_m))
            graph[_cids[_i + 1]].append((_cids[_i], _cost, _sub_m))
            edge_count += 1

    graph_node_count = len(graph)

    mo.md(f"""
### Walking graph constructed

| Property | Value |
|----------|-------|
| Graph nodes (connectors with edges) | {graph_node_count:,} |
| Graph edges (bidirectional sub-edges) | {edge_count:,} |
| Skipped segments | {skipped_segments:,} |
| Walk speed | {walk_speed_ms:.2f} m/s |
""")
    return (graph, graph_node_count, edge_count)


@app.cell
def _find_origin(study_lat, study_lng, connector_coords, math, mo):
    """Find nearest connector to study centre."""

    def _haversine_m(_lat1, _lng1, _lat2, _lng2):
        _R = 6_371_000
        _dlat = math.radians(_lat2 - _lat1)
        _dlng = math.radians(_lng2 - _lng1)
        _a = (
            math.sin(_dlat / 2) ** 2
            + math.cos(math.radians(_lat1))
            * math.cos(math.radians(_lat2))
            * math.sin(_dlng / 2) ** 2
        )
        return _R * 2 * math.atan2(math.sqrt(_a), math.sqrt(1 - _a))

    origin_id = None
    origin_dist = float("inf")
    for _c, (_la, _lo) in connector_coords.items():
        _d = _haversine_m(study_lat, study_lng, _la, _lo)
        if _d < origin_dist:
            origin_dist = _d
            origin_id = _c

    origin_lat, origin_lng = connector_coords[origin_id]

    mo.md(f"""
### Origin node

Nearest connector to study centre: `{origin_id[:40]}...`
Snap distance: **{origin_dist:.1f} m** | Coords: {origin_lat:.5f}, {origin_lng:.5f}
""")
    return (origin_id, origin_lat, origin_lng, origin_dist)


@app.cell
def _run_dijkstra(graph, origin_id, walk_budget_s, connector_coords, heapq, mo):
    """Dijkstra's algorithm: single-source shortest path with time cutoff."""
    import time as _time

    _t0 = _time.perf_counter()

    _pq: list[tuple[float, str]] = [(0.0, origin_id)]
    reachable: dict[str, float] = {}
    _visited: set[str] = set()

    while _pq:
        _cost, _node = heapq.heappop(_pq)
        if _node in _visited:
            continue
        _visited.add(_node)
        if _cost > walk_budget_s:
            continue
        reachable[_node] = _cost
        for _nb, _ec, _el in graph.get(_node, []):
            if _nb not in _visited:
                _nc = _cost + _ec
                if _nc <= walk_budget_s:
                    heapq.heappush(_pq, (_nc, _nb))

    _elapsed_ms = (_time.perf_counter() - _t0) * 1000

    reachable_points: list[dict] = []
    for _k, _v in reachable.items():
        if _k in connector_coords:
            _la, _lo = connector_coords[_k]
            reachable_points.append({
                "id": _k, "lat": _la, "lng": _lo,
                "cost_s": _v, "cost_min": _v / 60.0,
            })

    reachable_count = len(reachable)
    dijkstra_ms = _elapsed_ms
    nodes_explored = len(_visited)

    mo.md(f"""
### Dijkstra complete

| Property | Value |
|----------|-------|
| Reachable nodes | {reachable_count:,} |
| Nodes explored | {nodes_explored:,} |
| Computation time | {dijkstra_ms:.1f} ms |
| Walk budget | {walk_budget_s} s ({walk_budget_s/60:.0f} min) |
""")
    return (reachable, reachable_points, reachable_count, dijkstra_ms, nodes_explored)


@app.cell
def _compute_isochrone(conn, reachable_points, walk_budget_s, mo, json):
    """Generate isochrone contour polygons from reachable nodes."""

    _band_minutes = [5, 10, 15, 20]
    _bands = sorted(set(b for b in _band_minutes if b * 60 <= walk_budget_s))
    _budget_min = int(walk_budget_s / 60)
    if _budget_min not in _bands:
        _bands.append(_budget_min)
        _bands.sort()

    isochrone_bands: list[dict] = []

    for _bm in _bands:
        _bs = _bm * 60
        _pts = [p for p in reachable_points if p["cost_s"] <= _bs]
        if len(_pts) < 3:
            continue

        _wkt_points = ", ".join(f"{p['lng']:.6f} {p['lat']:.6f}" for p in _pts)
        _wkt = f"MULTIPOINT ({_wkt_points})"

        try:
            _res = conn.execute(f"""
                SELECT
                    ST_AsGeoJSON(ST_ConvexHull(ST_GeomFromText('{_wkt}'))) AS geojson,
                    ST_Area_Spheroid(ST_ConvexHull(ST_GeomFromText('{_wkt}'))) AS area_m2
            """).fetchone()
            _gj = _res[0]
            _am = _res[1]
        except Exception:
            _gj = None
            _am = 0.0

        isochrone_bands.append({
            "band_min": _bm, "band_s": _bs, "node_count": len(_pts),
            "area_m2": _am, "area_km2": _am / 1_000_000, "area_ha": _am / 10_000,
            "geojson": _gj,
        })

    if isochrone_bands:
        isochrone_area_km2 = isochrone_bands[-1]["area_km2"]
    else:
        isochrone_area_km2 = 0.0

    _tbl = "\n".join(
        f"| {b['band_min']} min | {b['node_count']:,} | {b['area_ha']:.2f} ha | {b['area_km2']:.3f} km² |"
        for b in isochrone_bands
    )

    mo.md(f"""
### Isochrone contours

| Band | Nodes | Area (ha) | Area (km²) |
|------|-------|-----------|------------|
{_tbl}

Polygons computed as convex hulls of reachable nodes per time band.
""")
    return (isochrone_bands, isochrone_area_km2)


@app.cell
def _pedshed(isochrone_area_km2, circle_area_km2, walk_range_m, mo):
    """Pedshed ratio = isochrone area / circle area."""

    pedshed_ratio = isochrone_area_km2 / circle_area_km2 if circle_area_km2 > 0 else 0.0

    if pedshed_ratio > 0.65:
        _label, _emoji = "Excellent — dense, well-connected grid", "🟢"
    elif pedshed_ratio > 0.45:
        _label, _emoji = "Good — moderate connectivity with some barriers", "🟡"
    elif pedshed_ratio > 0.25:
        _label, _emoji = "Fair — suburban mixed pattern", "🟠"
    else:
        _label, _emoji = "Poor — disconnected, cul-de-sac dominated", "🔴"

    mo.md(f"""
### Pedshed Ratio

## {_emoji} **{pedshed_ratio:.3f}** — {_label}

| Metric | Value |
|--------|-------|
| Isochrone area (convex hull) | {isochrone_area_km2:.3f} km² |
| Circle area (theoretical max) | {circle_area_km2:.3f} km² |
| Walk range | {walk_range_m:.0f} m |
| **Pedshed ratio** | **{pedshed_ratio:.3f}** |

| Threshold | Interpretation |
|-----------|---------------|
| > 0.65 | Dense connected grid (Manhattan, Eixample) |
| 0.45-0.65 | Moderate connectivity |
| 0.25-0.45 | Suburban mixed pattern |
| < 0.25 | Disconnected, cul-de-sac dominated |

**Note:** Convex hull overestimates area. Alpha shapes would give a tighter ratio.
""")
    return (pedshed_ratio,)


@app.cell
def _viz_scatter(reachable_points, origin_lat, origin_lng, walk_minutes, pl, alt, mo):
    """Reachable nodes scatter plot coloured by travel time."""

    _pts_df = pl.DataFrame(reachable_points)

    _scatter = (
        alt.Chart(_pts_df.to_pandas())
        .mark_circle(opacity=0.6)
        .encode(
            x=alt.X("lng:Q", title="Longitude", scale=alt.Scale(zero=False)),
            y=alt.Y("lat:Q", title="Latitude", scale=alt.Scale(zero=False)),
            color=alt.Color("cost_min:Q", title="Travel time (min)",
                            scale=alt.Scale(scheme="turbo", domain=[0, walk_minutes])),
            size=alt.value(12),
            tooltip=[
                alt.Tooltip("lat:Q", format=".5f"),
                alt.Tooltip("lng:Q", format=".5f"),
                alt.Tooltip("cost_min:Q", title="Minutes", format=".1f"),
            ],
        )
    )

    _origin_df = pl.DataFrame({"lat": [origin_lat], "lng": [origin_lng]})
    _origin_dot = (
        alt.Chart(_origin_df.to_pandas())
        .mark_point(shape="diamond", size=200, color="red", filled=True, stroke="white", strokeWidth=2)
        .encode(x="lng:Q", y="lat:Q")
    )

    isochrone_scatter = (
        (_scatter + _origin_dot)
        .properties(width=600, height=500, title=f"Walking Isochrone — {walk_minutes}-min reachable nodes")
        .configure_axis(grid=True, gridOpacity=0.2)
    )

    mo.md("### Reachable nodes by travel time")
    isochrone_scatter
    return (isochrone_scatter,)


@app.cell
def _viz_histogram(reachable_points, walk_minutes, pl, alt, mo):
    """Travel time histogram."""

    _df = pl.DataFrame(reachable_points)

    time_histogram = (
        alt.Chart(_df.to_pandas())
        .mark_bar(opacity=0.8, color="#4ecdc4")
        .encode(
            x=alt.X("cost_min:Q", title="Travel time (minutes)", bin=alt.Bin(step=1)),
            y=alt.Y("count()", title="Number of reachable nodes"),
        )
        .properties(width=550, height=300, title=f"Distribution of travel times (0–{walk_minutes} min)")
    )

    mo.md("### Travel time distribution")
    time_histogram
    return (time_histogram,)


@app.cell
def _viz_area_growth(isochrone_bands, pl, alt, mo):
    """Cumulative reachable area by time."""

    if isochrone_bands:
        _rows = [{"minutes": 0, "area_ha": 0.0, "nodes": 1}] + [
            {"minutes": b["band_min"], "area_ha": b["area_ha"], "nodes": b["node_count"]}
            for b in isochrone_bands
        ]
        _df = pl.DataFrame(_rows)

        area_growth_chart = (
            alt.Chart(_df.to_pandas())
            .mark_area(opacity=0.4, color="#e45756", line=True)
            .encode(
                x=alt.X("minutes:Q", title="Walk time (minutes)"),
                y=alt.Y("area_ha:Q", title="Reachable area (hectares)"),
                tooltip=[
                    alt.Tooltip("minutes:Q", title="Minutes"),
                    alt.Tooltip("area_ha:Q", title="Area (ha)", format=".1f"),
                ],
            )
            .properties(width=550, height=300, title="Cumulative reachable area by walk time")
        )

        mo.md("### Area growth curve")
        area_growth_chart
    else:
        area_growth_chart = None
        mo.md("*No isochrone bands computed.*")
    return (area_growth_chart,)


@app.cell
def _export_geojson(isochrone_bands, reachable_points, origin_lat, origin_lng, json, mo):
    """Export isochrone as GeoJSON FeatureCollection."""

    _features = []
    _features.append({
        "type": "Feature",
        "properties": {"type": "origin", "cost_min": 0},
        "geometry": {"type": "Point", "coordinates": [origin_lng, origin_lat]},
    })

    for _band in isochrone_bands:
        if _band["geojson"]:
            _features.append({
                "type": "Feature",
                "properties": {
                    "type": "isochrone", "band_min": _band["band_min"],
                    "area_ha": round(_band["area_ha"], 2), "node_count": _band["node_count"],
                },
                "geometry": json.loads(_band["geojson"]),
            })

    for _pt in reachable_points:
        _features.append({
            "type": "Feature",
            "properties": {"type": "reachable_node", "cost_min": round(_pt["cost_min"], 2)},
            "geometry": {"type": "Point", "coordinates": [_pt["lng"], _pt["lat"]]},
        })

    isochrone_geojson = {"type": "FeatureCollection", "features": _features}

    _pc = sum(1 for _f in _features if _f["properties"]["type"] == "isochrone")
    _nc = sum(1 for _f in _features if _f["properties"]["type"] == "reachable_node")

    mo.md(f"""
### GeoJSON export

FeatureCollection with **{len(_features)}** features:
1 origin + {_pc} isochrone bands + {_nc} reachable nodes.
Ready for MapLibre `FillLayer` + `CircleLayer`.
""")
    return (isochrone_geojson,)


@app.cell
def _summary(
    mo, city_dropdown, CITIES, walk_minutes, walk_speed_kmh, walk_range_m,
    reachable_count, graph_node_count, edge_count, segment_count,
    connector_count, isochrone_area_km2, circle_area_km2, pedshed_ratio,
    isochrone_bands, dijkstra_ms,
):
    _city = CITIES[city_dropdown.value]
    _bands_str = " → ".join(f"{b['band_min']}min: {b['area_ha']:.1f}ha" for b in isochrone_bands)

    mo.md(f"""
---

## Summary — {_city.name}

| Category | Metric | Value |
|----------|--------|-------|
| Walking | Time budget | {walk_minutes} min |
| Walking | Speed | {walk_speed_kmh} km/h |
| Walking | Max range | {walk_range_m:.0f} m |
| Network | Segments queried | {segment_count:,} |
| Network | Connectors queried | {connector_count:,} |
| Network | Graph nodes | {graph_node_count:,} |
| Network | Graph edges | {edge_count:,} |
| Isochrone | Reachable nodes | {reachable_count:,} |
| Isochrone | Area (convex hull) | {isochrone_area_km2:.3f} km² |
| Isochrone | Circle area | {circle_area_km2:.3f} km² |
| Isochrone | **Pedshed ratio** | **{pedshed_ratio:.3f}** |
| Isochrone | Dijkstra time | {dijkstra_ms:.1f} ms |
| Isochrone | Contour bands | {_bands_str} |

### Pipeline → TypeScript

1. **DuckDB-WASM** queries Overture GeoParquet (same SQL as above)
2. **Graph builder** splits segments at connectors (same logic)
3. **Dijkstra** expands from click point (~40 lines TS)
4. **Turf.js concave hull** generates isochrone polygon
5. **MapLibre** renders bands as fill layers

*No routing API. No server. No cost. Runs in any modern browser.*
""")
    return ()


if __name__ == "__main__":
    app.run()

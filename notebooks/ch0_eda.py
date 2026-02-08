import marimo

__generated_with = "0.19.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import duckdb
    import polars as pl
    import altair as alt
    import json
    import math
    import sys
    import os
    import requests

    sys.path.insert(0, os.path.dirname(__file__))

    from utils.overture import (
        OVERTURE_RELEASE,
        OVERTURE_S3_BASE,
        CITIES,
        OVERTURE_THEMES,
        PMTILES_URLS,
        STAC_CATALOG_URL,
        METRIC_COLUMN_MAP,
        init_duckdb,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        s3_path,
        latlng_to_tile,
    )

    return (
        CITIES,
        METRIC_COLUMN_MAP,
        OVERTURE_THEMES,
        PMTILES_URLS,
        alt,
        bbox_from_center,
        bbox_predicate,
        init_duckdb,
        json,
        latlng_to_tile,
        math,
        mo,
        pl,
        requests,
        s3_path,
    )


@app.cell
def init_db(init_duckdb):
    conn = init_duckdb()
    return (conn,)


@app.cell
def city_selector(CITIES, mo):
    _default_preset = CITIES["london_piccadilly"]
    city_dropdown = mo.ui.dropdown(
        options={v.name: k for k, v in CITIES.items()},
        value=_default_preset.name,
        label="City preset",
    )
    radius_m = mo.ui.slider(
        start=500, stop=2000, step=100, value=1200, label="Radius (m)"
    )
    mo.md(
        f"""
        # Chapter 0 — Overture Maps EDA

        Explore the raw Overture Maps data across GeoParquet (S3) and PMTiles.
        Pick a location and theme/type to inspect schemas, sample data,
        value distributions, null coverage, and cross-format differences.

        {city_dropdown} {radius_m}
        """
    )
    return city_dropdown, radius_m


@app.cell
def theme_type_selector(OVERTURE_THEMES, mo):
    theme_dropdown = mo.ui.dropdown(
        options={t: t for t in OVERTURE_THEMES.keys()},
        value="buildings",
        label="Theme",
    )
    mo.md(f"## Theme / Type selector\n\n{theme_dropdown}")
    return (theme_dropdown,)


@app.cell
def type_selector(OVERTURE_THEMES, mo, theme_dropdown):
    _types = OVERTURE_THEMES.get(theme_dropdown.value, ["building"])
    type_dropdown = mo.ui.dropdown(
        options={t: t for t in _types},
        value=_types[0],
        label="Type",
    )
    mo.md(f"{type_dropdown}")
    return (type_dropdown,)


@app.cell
def bbox_setup(CITIES, bbox_from_center, city_dropdown, math, mo, radius_m):
    _preset = CITIES[city_dropdown.value]
    bbox = bbox_from_center(_preset.lat, _preset.lng, radius_m.value)
    _area_km2 = (
        (bbox["north"] - bbox["south"])
        * (bbox["east"] - bbox["west"])
        * 111.32
        * 111.32
        * math.cos(math.radians(_preset.lat))
    )
    mo.md(
        f"""
        ### Study area

        **{_preset.name}** — {_preset.description}

        | | Value |
        |---|---|
        | Center | {_preset.lat:.4f}, {_preset.lng:.4f} |
        | Radius | {radius_m.value} m |
        | BBox S | {bbox['south']:.6f} |
        | BBox N | {bbox['north']:.6f} |
        | BBox W | {bbox['west']:.6f} |
        | BBox E | {bbox['east']:.6f} |
        """
    )
    return (bbox,)


@app.cell
def geoparquet_schema(
    bbox, bbox_predicate, conn, mo, pl, s3_path, theme_dropdown, type_dropdown
):
    _s3 = s3_path(theme_dropdown.value, type_dropdown.value)
    _bp = bbox_predicate(bbox)
    _sql = f"""
        SELECT column_name, column_type, "null" AS nullable
        FROM (DESCRIBE
            SELECT * FROM read_parquet('{_s3}', hive_partitioning=1)
            WHERE {_bp}
            LIMIT 1
        )
    """
    schema_df = pl.from_pandas(conn.execute(_sql).fetchdf()).fill_nan(None)
    mo.md(
        f"""
        ## GeoParquet Schema

        **Theme:** `{theme_dropdown.value}` | **Type:** `{type_dropdown.value}`

        **S3 path:** `{_s3}`

        {mo.ui.table(schema_df)}
        """
    )
    return (schema_df,)


@app.cell
def geoparquet_sample(
    bbox, bbox_predicate, conn, mo, pl, s3_path, theme_dropdown, type_dropdown
):
    _s3 = s3_path(theme_dropdown.value, type_dropdown.value)
    _bp = bbox_predicate(bbox)
    _sql = f"""
        SELECT * EXCLUDE (geometry)
        FROM read_parquet('{_s3}', hive_partitioning=1)
        WHERE {_bp}
        LIMIT 50
    """
    sample_df = pl.from_pandas(conn.execute(_sql).fetchdf()).fill_nan(None)
    mo.md(
        f"""
        ## Sample Data (50 rows, geometry excluded)

        {mo.ui.table(sample_df)}
        """
    )
    return (sample_df,)


@app.cell
def column_profiler(mo, pl, sample_df):
    _profiles = []
    for _col in sample_df.columns:
        _s = sample_df[_col]
        _profile = {
            "column": _col,
            "dtype": str(_s.dtype),
            "null_count": _s.null_count(),
            "null_pct": round(_s.null_count() / max(len(_s), 1) * 100, 1),
            "n_unique": _s.n_unique(),
        }
        if _s.dtype.is_numeric():
            _non_null = _s.drop_nulls()
            if len(_non_null) > 0:
                _min_val = _non_null.min()
                _max_val = _non_null.max()
                _mean_val = _non_null.mean()
                _profile["min"] = None if _min_val != _min_val else _min_val
                _profile["max"] = None if _max_val != _max_val else _max_val
                _profile["mean"] = None if _mean_val != _mean_val else round(float(_mean_val), 2)
            else:
                _profile["min"] = None
                _profile["max"] = None
                _profile["mean"] = None
        else:
            _profile["min"] = None
            _profile["max"] = None
            _profile["mean"] = None
        _profiles.append(_profile)

    import polars as _pl

    profile_df = _pl.DataFrame(_profiles).fill_nan(None)
    mo.md(
        f"""
        ## Column Profile

        {mo.ui.table(profile_df)}
        """
    )
    return


@app.cell
def value_distributions_selector(
    bbox, bbox_predicate, conn, mo, s3_path, theme_dropdown, type_dropdown
):
    _s3 = s3_path(theme_dropdown.value, type_dropdown.value)
    _bp = bbox_predicate(bbox)

    _desc_sql = f"""
        SELECT column_name, column_type
        FROM (DESCRIBE
            SELECT * FROM read_parquet('{_s3}', hive_partitioning=1)
            WHERE {_bp} LIMIT 1
        )
        WHERE column_type IN ('VARCHAR', 'BOOLEAN')
          AND column_name NOT IN ('id', 'geometry', 'names', 'sources', 'source_tags')
    """
    _cat_cols = conn.execute(_desc_sql).fetchall()
    dist_col_names = [r[0] for r in _cat_cols]

    if len(dist_col_names) == 0:
        dist_col_dropdown = None
        mo.md("## Value Distributions\n\nNo categorical columns found.")
    else:
        dist_col_dropdown = mo.ui.dropdown(
            options={c: c for c in dist_col_names},
            value=dist_col_names[0],
            label="Column",
        )
        mo.md(f"## Value Distributions\n\n{dist_col_dropdown}")
    return (dist_col_dropdown,)


@app.cell
def value_distributions_chart(
    alt, bbox, bbox_predicate, conn, dist_col_dropdown, mo, pl,
    s3_path, theme_dropdown, type_dropdown
):
    mo.stop(dist_col_dropdown is None, mo.md(""))

    _s3 = s3_path(theme_dropdown.value, type_dropdown.value)
    _bp = bbox_predicate(bbox)
    _col = dist_col_dropdown.value

    _val_sql = f"""
        SELECT CAST({_col} AS VARCHAR) AS val, COUNT(*) AS cnt
        FROM read_parquet('{_s3}', hive_partitioning=1)
        WHERE {_bp}
        GROUP BY val
        ORDER BY cnt DESC
        LIMIT 30
    """
    _val_df = pl.from_pandas(conn.execute(_val_sql).fetchdf())
    _chart = alt.Chart(_val_df.to_pandas()).mark_bar().encode(
        x=alt.X("cnt:Q", title="Count"),
        y=alt.Y("val:N", sort="-x", title=_col),
    ).properties(width=500, height=min(400, len(_val_df) * 22))

    mo.md(f"{mo.as_html(_chart)}")
    return


@app.cell
def geometry_stats(
    bbox, bbox_predicate, conn, mo, pl, s3_path, theme_dropdown, type_dropdown
):
    _s3 = s3_path(theme_dropdown.value, type_dropdown.value)
    _bp = bbox_predicate(bbox)
    _sql = f"""
        SELECT
            ST_GeometryType(geometry) AS geom_type,
            COUNT(*) AS count,
            COALESCE(ROUND(AVG(CASE WHEN ST_Area(geometry) > 0 THEN ST_Area(geometry) * 111320 * 111320 END), 1), 0) AS avg_area_m2,
            COALESCE(ROUND(AVG(CASE WHEN ST_Length(geometry) > 0 THEN ST_Length(geometry) * 111320 END), 1), 0) AS avg_length_m
        FROM read_parquet('{_s3}', hive_partitioning=1)
        WHERE {_bp}
        GROUP BY geom_type
        ORDER BY count DESC
    """
    geom_stats_df = pl.from_pandas(conn.execute(_sql).fetchdf()).fill_nan(0)
    mo.md(
        f"""
        ## Geometry Statistics

        {mo.ui.table(geom_stats_df)}
        """
    )
    return


@app.cell
def null_analysis(
    alt, bbox, bbox_predicate, conn, mo, pl, s3_path, schema_df,
    theme_dropdown, type_dropdown
):
    _s3 = s3_path(theme_dropdown.value, type_dropdown.value)
    _bp = bbox_predicate(bbox)

    _cols = [
        r for r in schema_df["column_name"].to_list()
        if r not in ("geometry",)
    ]

    _count_exprs = ", ".join(
        f"COUNT({c}) AS {c}_nonnull" for c in _cols
    )
    _total_sql = f"""
        SELECT COUNT(*) AS total, {_count_exprs}
        FROM read_parquet('{_s3}', hive_partitioning=1)
        WHERE {_bp}
    """
    _row = conn.execute(_total_sql).fetchone()
    _total = _row[0]

    _null_data = []
    for _idx, _col in enumerate(_cols):
        _nonnull = _row[_idx + 1]
        _null_count = _total - _nonnull
        _null_data.append({
            "column": _col,
            "total": _total,
            "non_null": _nonnull,
            "null_count": _null_count,
            "null_pct": round(_null_count / max(_total, 1) * 100, 1),
        })

    null_df = pl.DataFrame(_null_data).sort("null_pct", descending=True).fill_nan(None)

    _chart = (
        alt.Chart(null_df.to_pandas())
        .mark_bar()
        .encode(
            x=alt.X("null_pct:Q", title="Null %", scale=alt.Scale(domain=[0, 100])),
            y=alt.Y("column:N", sort="-x", title="Column"),
            color=alt.condition(
                alt.datum.null_pct > 50,
                alt.value("#e45756"),
                alt.value("#4c78a8"),
            ),
        )
        .properties(width=500, height=max(200, len(null_df) * 22))
    )

    mo.md(
        f"""
        ## Null Coverage Analysis

        Total rows in bbox: **{_total:,}**

        {mo.as_html(_chart)}

        {mo.ui.table(null_df)}
        """
    )
    return


@app.cell
def pmtiles_metadata(PMTILES_URLS, json, mo, requests, theme_dropdown):
    _url = PMTILES_URLS.get(theme_dropdown.value)
    if _url is None:
        pmtiles_meta = None
        mo.md(f"## PMTiles Metadata\n\nNo PMTiles URL for theme `{theme_dropdown.value}`.")
    else:
        try:
            _resp = requests.get(_url, headers={"Range": "bytes=0-524287"})
            _data = _resp.content

            _magic = _data[:7]
            if _magic == b"PMTiles":
                _version = _data[7]
                _meta_offset = int.from_bytes(_data[38:46], "little")
                _meta_length = int.from_bytes(_data[46:54], "little")
                _min_zoom = _data[70]
                _max_zoom = _data[71]

                _info = {
                    "version": _version,
                    "min_zoom": _min_zoom,
                    "max_zoom": _max_zoom,
                    "url": _url,
                    "header_bytes": len(_data),
                }

                if _meta_offset + _meta_length <= len(_data) and _meta_length > 0:
                    import gzip as _gzip
                    try:
                        _meta_raw = _gzip.decompress(
                            _data[_meta_offset : _meta_offset + _meta_length]
                        )
                        _meta_json = json.loads(_meta_raw)
                        _info["metadata"] = _meta_json
                    except Exception:
                        _info["metadata_note"] = "Could not decompress metadata in first 512KB"
                else:
                    _info["metadata_note"] = f"Metadata at offset {_meta_offset} (len {_meta_length}), beyond fetched range"

                pmtiles_meta = _info
            else:
                pmtiles_meta = {"error": "Not a PMTiles v3 file", "magic": str(_magic)}
        except Exception as _e:
            pmtiles_meta = {"error": str(_e)}

        _display = json.dumps(pmtiles_meta, indent=2, default=str)
        _layers_md = ""
        if pmtiles_meta and "metadata" in pmtiles_meta:
            _m = pmtiles_meta["metadata"]
            if "vector_layers" in _m:
                _layers_md = "\n### Vector Layers\n\n| Layer | Fields |\n|---|---|\n"
                for _vl in _m["vector_layers"]:
                    _fields = ", ".join(_vl.get("fields", {}).keys())
                    _layers_md += f"| `{_vl.get('id', '?')}` | {_fields} |\n"

        mo.md(
            f"""
            ## PMTiles Metadata — `{theme_dropdown.value}`

            {_layers_md}

            ```json
            {_display}
            ```
            """
        )
    return (pmtiles_meta,)


@app.cell
def pmtiles_tile_sample(
    CITIES, PMTILES_URLS, city_dropdown, json, latlng_to_tile, mo,
    requests, theme_dropdown
):
    _url = PMTILES_URLS.get(theme_dropdown.value)
    _preset = CITIES[city_dropdown.value]
    _x, _y, _z = latlng_to_tile(_preset.lat, _preset.lng, 14)

    if _url is None:
        mo.md("## PMTiles Tile Sample\n\nNo PMTiles URL for this theme.")
    else:
        try:
            import mapbox_vector_tile as _mvt
            from pmtiles.reader import Reader as _Reader

            class _HttpSource:
                def __init__(self, url):
                    self.url = url

                def get(self, offset, length):
                    _headers = {"Range": f"bytes={offset}-{offset + length - 1}"}
                    _r = requests.get(self.url, headers=_headers)
                    return _r.content

            _source = _HttpSource(_url)
            _reader = _Reader(_source)
            _tile_data = _reader.get(_z, _x, _y)

            if _tile_data is None:
                mo.md(
                    f"## PMTiles Tile Sample\n\nNo tile at z={_z} x={_x} y={_y} for `{theme_dropdown.value}`."
                )
            else:
                _decoded = _mvt.decode(_tile_data)
                _summary_strs = []
                for _layer_name, _layer_data in _decoded.items():
                    _feats = _layer_data.get("features", [])
                    _props = list(_feats[0]["properties"].keys()) if _feats else []
                    _summary_strs.append({
                        "layer": _layer_name,
                        "feature_count": len(_feats),
                        "properties": ", ".join(_props),
                    })

                import polars as _pl
                _summary_df = _pl.DataFrame(_summary_strs)

                _first_layer = list(_decoded.keys())[0] if _decoded else None
                _sample_props_md = ""
                if _first_layer:
                    _first_feats = _decoded[_first_layer].get("features", [])
                    if _first_feats:
                        _sample = _first_feats[:3]
                        _sample_props_md = f"\n### Sample properties from `{_first_layer}` (first 3 features)\n\n```json\n{json.dumps([f['properties'] for f in _sample], indent=2, default=str)}\n```"

                mo.md(
                    f"""
                    ## PMTiles Tile Sample

                    **Tile:** z={_z} x={_x} y={_y} | **Location:** {_preset.name}

                    {mo.ui.table(_summary_df)}

                    {_sample_props_md}
                    """
                )
        except Exception as _e:
            mo.md(f"## PMTiles Tile Sample\n\nError: {_e}")
    return


@app.cell
def format_comparison(mo, pmtiles_meta, schema_df):
    _gp_cols = set(schema_df["column_name"].to_list())

    _pm_cols = set()
    if pmtiles_meta and "metadata" in pmtiles_meta:
        _m = pmtiles_meta["metadata"]
        if "vector_layers" in _m:
            for _vl in _m["vector_layers"]:
                _pm_cols.update(_vl.get("fields", {}).keys())

    _all_cols = sorted(_gp_cols | _pm_cols)
    _comparison = []
    for _col in _all_cols:
        _comparison.append({
            "column": _col,
            "in_geoparquet": "yes" if _col in _gp_cols else "",
            "in_pmtiles": "yes" if _col in _pm_cols else "",
            "only_in": (
                "GeoParquet" if _col in _gp_cols and _col not in _pm_cols
                else ("PMTiles" if _col in _pm_cols and _col not in _gp_cols else "Both")
            ),
        })

    import polars as _pl
    _comp_df = _pl.DataFrame(_comparison)

    mo.md(
        f"""
        ## Format Comparison: GeoParquet vs PMTiles

        | | GeoParquet | PMTiles |
        |---|---|---|
        | Columns | {len(_gp_cols)} | {len(_pm_cols)} |
        | GeoParquet-only | {len(_gp_cols - _pm_cols)} | — |
        | PMTiles-only | — | {len(_pm_cols - _gp_cols)} |
        | Shared | {len(_gp_cols & _pm_cols)} | {len(_gp_cols & _pm_cols)} |

        {mo.ui.table(_comp_df)}
        """
    )
    return


@app.cell
def metric_column_mapping(METRIC_COLUMN_MAP, mo, pl):
    _rows = []
    for _metric, _info in METRIC_COLUMN_MAP.items():
        _theme = _info["theme"]
        _type = _info["type"]
        _cols = _info["columns"]
        _notes = _info.get("notes", "")

        _rows.append({
            "metric": _metric,
            "theme": _theme,
            "type": ", ".join(_type) if isinstance(_type, list) else _type,
            "columns": ", ".join(_cols),
            "notes": _notes,
        })

    metric_df = pl.DataFrame(_rows)
    mo.md(
        f"""
        ## Metric → Overture Column Mapping

        Which Overture columns does each chrono.city metric need?

        {mo.ui.table(metric_df)}
        """
    )
    return


@app.cell
def stac_catalog_browser(json, mo, requests):
    try:
        _catalog = requests.get(
            "https://labs.overturemaps.org/stac/catalog.json", timeout=15
        ).json()

        _collections = []

        _links = [
            _l for _l in _catalog.get("links", []) if _l.get("rel") == "child"
        ]
        for _link in _links:
            _href = _link.get("href", "")
            if not _href.startswith("http"):
                _href = "https://labs.overturemaps.org/stac/" + _href
            try:
                _child = requests.get(_href, timeout=15).json()
                _child_title = _child.get("title", _child.get("id", "unknown"))

                _sub_links = [
                    _sl for _sl in _child.get("links", [])
                    if _sl.get("rel") == "child"
                ]
                if _sub_links:
                    for _sl in _sub_links:
                        _sub_href = _sl.get("href", "")
                        if not _sub_href.startswith("http"):
                            _base = _href.rsplit("/", 1)[0]
                            _sub_href = _base + "/" + _sub_href
                        try:
                            _sub = requests.get(_sub_href, timeout=15).json()
                            _extent = _sub.get("extent", {})
                            _spatial = _extent.get("spatial", {}).get("bbox", [])
                            _temporal = _extent.get("temporal", {}).get("interval", [])
                            _collections.append({
                                "theme": _child_title,
                                "collection": _sub.get("title", _sub.get("id", "?")),
                                "id": _sub.get("id", "?"),
                                "description": (_sub.get("description", "")[:120]),
                                "bbox": str(_spatial[0]) if _spatial else "—",
                                "temporal": str(_temporal[0]) if _temporal else "—",
                            })
                        except Exception:
                            _collections.append({
                                "theme": _child_title,
                                "collection": _sl.get("title", "?"),
                                "id": "?",
                                "description": f"Failed to fetch: {_sub_href}",
                                "bbox": "—",
                                "temporal": "—",
                            })
                else:
                    _extent = _child.get("extent", {})
                    _spatial = _extent.get("spatial", {}).get("bbox", [])
                    _temporal = _extent.get("temporal", {}).get("interval", [])
                    _collections.append({
                        "theme": "—",
                        "collection": _child_title,
                        "id": _child.get("id", "?"),
                        "description": (_child.get("description", "")[:120]),
                        "bbox": str(_spatial[0]) if _spatial else "—",
                        "temporal": str(_temporal[0]) if _temporal else "—",
                    })
            except Exception:
                _collections.append({
                    "theme": "—",
                    "collection": _link.get("title", "?"),
                    "id": "?",
                    "description": f"Failed to fetch: {_href}",
                    "bbox": "—",
                    "temporal": "—",
                })

        import polars as _pl
        stac_df = _pl.DataFrame(_collections)

        mo.md(
            f"""
            ## STAC Catalog Browser

            **Catalog:** `labs.overturemaps.org/stac/catalog.json`

            [Open in STAC Browser](https://radiantearth.github.io/stac-browser/#/external/labs.overturemaps.org/stac/catalog.json?.language=en)

            Found **{len(_collections)}** collections:

            {mo.ui.table(stac_df)}

            ### Raw catalog metadata

            ```json
            {json.dumps({k: v for k, v in _catalog.items() if k != 'links'}, indent=2)}
            ```
            """
        )
    except Exception as _e:
        stac_df = None
        mo.md(f"## STAC Catalog Browser\n\nFailed to fetch catalog: {_e}")
    return (stac_df,)


@app.cell
def stac_collection_selector(mo, stac_df):
    if stac_df is None or len(stac_df) == 0:
        stac_collection_dd = None
        mo.md("## STAC Collection Detail\n\nNo collections loaded.")
    else:
        _options = {
            f"{r['theme']} / {r['collection']}": r["id"]
            for r in stac_df.to_dicts()
            if r["id"] != "?"
        }
        if not _options:
            stac_collection_dd = None
            mo.md("## STAC Collection Detail\n\nNo valid collections.")
        else:
            _first_label = list(_options.keys())[0]
            stac_collection_dd = mo.ui.dropdown(
                options=_options,
                value=_first_label,
                label="Collection",
            )
            mo.md(f"## STAC Collection Detail\n\n{stac_collection_dd}")
    return (stac_collection_dd,)


@app.cell
def stac_collection_detail(json, mo, requests, stac_collection_dd):
    mo.stop(stac_collection_dd is None, mo.md(""))

    _collection_id = stac_collection_dd.value
    _detail_md = ""

    if _collection_id:
        try:
            _base = "https://labs.overturemaps.org/stac"
            _url = f"{_base}/{_collection_id}/collection.json"
            _resp = requests.get(_url, timeout=15)
            _detail = _resp.json() if _resp.status_code == 200 else None

            if _detail:
                _providers = _detail.get("providers", [])
                _license = _detail.get("license", "—")
                _assets = _detail.get("assets", {})
                _detail_md = f"""
**License:** {_license}

**Providers:** {', '.join(p.get('name', '?') for p in _providers) if _providers else '—'}

**Assets:** {len(_assets)}

| Asset Key | Type | Href |
|---|---|---|
"""
                for _ak, _av in list(_assets.items())[:10]:
                    _detail_md += f"| `{_ak}` | {_av.get('type', '?')} | `{_av.get('href', '?')[:80]}` |\n"

                _detail_md += f"\n```json\n{json.dumps(_detail, indent=2, default=str)[:3000]}\n```"
        except Exception as _e:
            _detail_md = f"Error fetching collection detail: {_e}"

    mo.md(_detail_md)
    return


@app.cell
def custom_sql(mo):
    sql_input = mo.ui.text_area(
        value="-- Custom SQL query against Overture data\n-- Example: count buildings near Piccadilly Circus\nSELECT COUNT(*) AS building_count\nFROM read_parquet(\n  's3://overturemaps-us-west-2/release/2026-01-21.0/theme=buildings/type=building/*',\n  hive_partitioning=1\n)\nWHERE bbox.xmin <= -0.106851\n  AND bbox.xmax >= -0.160549\n  AND bbox.ymin <= 51.526076\n  AND bbox.ymax >= 51.493724",
        label="SQL Query",
        full_width=True,
        rows=10,
    )
    run_button = mo.ui.run_button(label="Execute query")

    mo.md(
        f"""
        ## Custom SQL Console

        {sql_input}

        {run_button}
        """
    )
    return run_button, sql_input


@app.cell
def custom_sql_result(conn, mo, pl, run_button, sql_input):
    mo.stop(not run_button.value, mo.md("*Click 'Execute query' to run.*"))

    try:
        _result = conn.execute(sql_input.value).fetchdf()
        _result_df = pl.from_pandas(_result)
        mo.md(
            f"""
            ### Query Result ({len(_result_df)} rows)

            {mo.ui.table(_result_df)}
            """
        )
    except Exception as _e:
        mo.md(f"### Error\n\n```\n{_e}\n```")
    return


if __name__ == "__main__":
    app.run()

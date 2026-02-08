import marimo

__generated_with = "0.19.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import duckdb
    import polars as pl
    import altair as alt
    import math
    import sys
    import os

    sys.path.insert(0, os.path.dirname(__file__))

    from utils.overture import (
        CITIES,
        S3_BUILDINGS,
        init_duckdb,
        bbox_from_center,
        bbox_predicate,
        pedshed_filter,
        pedshed_area_m2,
        pedshed_area_ha,
    )

    return (
        CITIES,
        S3_BUILDINGS,
        alt,
        bbox_from_center,
        bbox_predicate,
        init_duckdb,
        math,
        mo,
        pedshed_area_ha,
        pedshed_area_m2,
        pedshed_filter,
        pl,
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
        start=400,
        stop=2000,
        step=100,
        value=1200,
        label="Pedshed radius (m)",
    )
    mo.md(f"""
    ## Ch 1 — Urban Fabric Metrics

    Select a city and pedshed radius to compute 6 Urban Fabric metrics from Overture Maps buildings data.
    Default: **Piccadilly Circus** (canonical reference location).

    {city_dropdown}

    {radius_m}
    """)
    return city_dropdown, radius_m


@app.cell
def compute_bbox(
    CITIES,
    bbox_from_center,
    city_dropdown,
    mo,
    pedshed_area_ha,
    pedshed_area_m2,
    radius_m,
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

    mo.md(f"""
    **{_city.name}** — {_city.description}

    | Parameter | Value |
    |-----------|-------|
    | Center | {study_lat:.4f}, {study_lng:.4f} |
    | Radius | {study_radius} m |
    | Study area | {study_area_ha:.1f} ha ({study_area_m2:,.0f} m^2) |
    | Bbox S/N | {study_bbox['south']:.4f} / {study_bbox['north']:.4f} |
    | Bbox W/E | {study_bbox['west']:.4f} / {study_bbox['east']:.4f} |
    """)
    return study_area_m2, study_bbox, study_lat, study_lng, study_radius


@app.cell
def buildings_raw_query(
    S3_BUILDINGS,
    bbox_predicate,
    conn,
    mo,
    pedshed_filter,
    study_bbox,
    study_lat,
    study_lng,
    study_radius,
):
    _bbox_pred = bbox_predicate(study_bbox)
    _circle_pred = pedshed_filter(study_lat, study_lng, study_radius)

    _sql = f"""
    SELECT
        ST_Area_Spheroid(geometry) as area_m2,
        (4 * PI() * ST_Area_Spheroid(geometry))
            / POWER(ST_Perimeter_Spheroid(geometry), 2) as compactness,
        ST_Perimeter_Spheroid(geometry) as perimeter_m,
        COALESCE(
            num_floors,
            CASE WHEN height IS NOT NULL
                 THEN GREATEST(ROUND(height / 3.5), 1)
                 ELSE NULL
            END
        ) as est_floors,
        height,
        num_floors
    FROM read_parquet('{S3_BUILDINGS}', hive_partitioning=1)
    WHERE {_bbox_pred}
        AND {_circle_pred}
    """

    buildings_df = conn.execute(_sql).pl()
    building_count = len(buildings_df)

    mo.md(f"""
    ### Buildings Query

    Fetched **{building_count:,}** buildings within the pedshed.
    """)
    return building_count, buildings_df


@app.cell
def compute_gsi(buildings_df, mo, study_area_m2):
    _total_footprint = buildings_df["area_m2"].sum()
    gsi = _total_footprint / study_area_m2

    if gsi > 0.5:
        _gsi_interp = "Compact urban fabric (>0.5)"
    elif gsi < 0.15:
        _gsi_interp = "Sprawl / very low coverage (<0.15)"
    else:
        _gsi_interp = "Moderate coverage (0.15 - 0.50)"

    mo.md(f"""
    ### 1. GSI — Ground Space Index

    **GSI = {gsi:.4f}**

    Total building footprint: {_total_footprint:,.0f} m^2 / Study area: {study_area_m2:,.0f} m^2

    *Interpretation:* {_gsi_interp}

    > GSI measures the proportion of the study area covered by building footprints.
    > Values above 0.5 indicate compact urban fabric; below 0.15 suggests sprawl.
    """)
    return (gsi,)


@app.cell
def compute_fsi(building_count, buildings_df, mo, pl, study_area_m2):
    _with_floors = buildings_df.filter(pl.col("est_floors").is_not_null())
    _floors_coverage = len(_with_floors) / building_count if building_count > 0 else 0.0

    _gfa = (_with_floors["area_m2"] * _with_floors["est_floors"]).sum()
    fsi = _gfa / study_area_m2

    mo.md(f"""
    ### 2. FSI — Floor Space Index

    **FSI = {fsi:.4f}**

    Estimated gross floor area: {_gfa:,.0f} m^2

    Buildings with floor data: {len(_with_floors):,} / {building_count:,} ({_floors_coverage:.1%})

    > FSI measures the total floor area relative to the study area.
    > Higher FSI indicates more intense use of land (more floors stacked up).
    """)
    return (fsi,)


@app.cell
def compute_osr(fsi, gsi, mo):
    osr = (1 - gsi) / fsi if fsi > 0 else float("inf")

    if osr < 0.5:
        _osr_interp = "Low — cramped, little open space per unit of floor area"
    elif osr > 2.0:
        _osr_interp = "High — spacious, generous open space per unit of floor area"
    else:
        _osr_interp = "Moderate — balanced open space ratio"

    mo.md(f"""
    ### 3. OSR — Open Space Ratio

    **OSR = {osr:.4f}**

    *Interpretation:* {_osr_interp}

    > OSR = (1 - GSI) / FSI. It measures how much open space is available per unit
    > of gross floor area. Low values indicate cramped environments; high values
    > indicate spacious settings.
    """)
    return (osr,)


@app.cell
def compute_compactness(buildings_df, mo, pl):
    _valid = buildings_df.filter(
        pl.col("compactness").is_not_null()
        & pl.col("compactness").is_finite()
        & (pl.col("compactness") > 0)
        & (pl.col("compactness") <= 1.0)
    )

    avg_compactness = _valid["compactness"].mean() if len(_valid) > 0 else 0.0

    if avg_compactness > 0.7:
        _compact_interp = "High — buildings are relatively circular / regular"
    elif avg_compactness < 0.4:
        _compact_interp = "Low — buildings have irregular, complex shapes"
    else:
        _compact_interp = "Moderate — typical urban building shapes"

    mo.md(f"""
    ### 4. Building Compactness

    **Mean compactness = {avg_compactness:.4f}** (isoperimetric quotient)

    Valid buildings: {len(_valid):,} (excluded null/invalid values)

    *Interpretation:* {_compact_interp}

    > The isoperimetric quotient is 4*pi*Area / Perimeter^2.
    > A perfect circle has a value of 1.0. Lower values indicate more complex shapes.
    """)
    return (avg_compactness,)


@app.cell
def compute_urban_grain(buildings_df, mo):
    _median_footprint = buildings_df["area_m2"].median()
    median_footprint = _median_footprint if _median_footprint is not None else 0.0

    if median_footprint < 150:
        grain_class = "Fine grain (<150 m^2)"
    elif median_footprint > 500:
        grain_class = "Coarse grain (>500 m^2)"
    else:
        grain_class = "Medium grain (150-500 m^2)"

    mo.md(f"""
    ### 5. Urban Grain

    **Median footprint area = {median_footprint:.1f} m^2**

    *Classification:* {grain_class}

    > Fine grain (<150 m^2) = small, walkable, diverse. Typical of historic centers.
    > Medium grain (150-500 m^2) = residential blocks, mixed areas.
    > Coarse grain (>500 m^2) = large footprints, commercial/industrial or sprawl.
    """)
    return grain_class, median_footprint


@app.cell
def compute_fractal_dimension(buildings_df, math, mo):
    _total_perimeter = buildings_df["perimeter_m"].sum()
    _total_area = buildings_df["area_m2"].sum()

    if _total_area > 0 and _total_perimeter > 4:
        fractal_d = 2 * math.log(_total_perimeter / 4) / math.log(_total_area)
    else:
        fractal_d = 0.0

    if fractal_d < 1.3:
        _fd_interp = "Low (<1.3) — planned, regular geometry"
    elif fractal_d > 1.5:
        _fd_interp = "High (>1.5) — organic, mature urban fabric"
    else:
        _fd_interp = "Moderate (1.3-1.5) — grid-based urban form"

    mo.md(f"""
    ### 6. Fractal Dimension (proxy)

    **D = {fractal_d:.4f}**

    Total perimeter: {_total_perimeter:,.0f} m | Total area: {_total_area:,.0f} m^2

    *Interpretation:* {_fd_interp}

    > D = 2 * ln(total_perimeter / 4) / ln(total_area).
    > Values below 1.3 suggest planned, regular layouts.
    > Values between 1.3 and 1.5 suggest grid-based urban form.
    > Values above 1.5 suggest organic, mature, or highly complex urban fabric.
    """)
    return (fractal_d,)


@app.cell
def summary_table(
    avg_compactness,
    fractal_d,
    fsi,
    grain_class,
    gsi,
    median_footprint,
    mo,
    osr,
    pl,
):
    # GSI interpretation
    if gsi > 0.5:
        _gsi_note = "Compact"
    elif gsi < 0.15:
        _gsi_note = "Sprawl"
    else:
        _gsi_note = "Moderate"

    # FSI interpretation
    if fsi > 2.0:
        _fsi_note = "High intensity"
    elif fsi < 0.5:
        _fsi_note = "Low intensity"
    else:
        _fsi_note = "Moderate intensity"

    # OSR interpretation
    if osr < 0.5:
        _osr_note = "Cramped"
    elif osr > 2.0:
        _osr_note = "Spacious"
    else:
        _osr_note = "Balanced"

    # Compactness interpretation
    if avg_compactness > 0.7:
        _compact_note = "Regular shapes"
    elif avg_compactness < 0.4:
        _compact_note = "Complex shapes"
    else:
        _compact_note = "Typical shapes"

    # Fractal interpretation
    if fractal_d < 1.3:
        _fd_note = "Planned / regular"
    elif fractal_d > 1.5:
        _fd_note = "Organic / mature"
    else:
        _fd_note = "Grid-based"

    summary_df = pl.DataFrame({
        "Metric": [
            "GSI (Ground Space Index)",
            "FSI (Floor Space Index)",
            "OSR (Open Space Ratio)",
            "Building Compactness",
            "Urban Grain",
            "Fractal Dimension",
        ],
        "Value": [
            f"{gsi:.4f}",
            f"{fsi:.4f}",
            f"{osr:.4f}",
            f"{avg_compactness:.4f}",
            f"{median_footprint:.1f}",
            f"{fractal_d:.4f}",
        ],
        "Unit": [
            "ratio",
            "ratio",
            "ratio",
            "0-1 (isoperimetric quotient)",
            "m^2 (median footprint)",
            "dimensionless",
        ],
        "Interpretation": [
            _gsi_note,
            _fsi_note,
            _osr_note,
            _compact_note,
            grain_class,
            _fd_note,
        ],
    })

    mo.md(f"""
    ---

    ## Summary — 6 Urban Fabric Metrics

    {mo.ui.table(summary_df)}
    """)
    return


@app.cell
def visualizations(alt, buildings_df, mo, pl):
    # --- Footprint area distribution (log scale) ---
    _fp = buildings_df.filter(pl.col("area_m2") > 0).select(
        pl.col("area_m2").alias("area")
    )

    footprint_chart = (
        alt.Chart(_fp.to_pandas())
        .mark_bar(opacity=0.7, color="#4c78a8")
        .encode(
            x=alt.X(
                "area:Q",
                scale=alt.Scale(type="log"),
                bin=alt.Bin(maxbins=40),
                title="Footprint area (m2, log scale)",
            ),
            y=alt.Y("count()", title="Number of buildings"),
        )
        .properties(width=500, height=250, title="Footprint Area Distribution")
    )

    # --- Compactness distribution ---
    _cmp = buildings_df.filter(
        pl.col("compactness").is_not_null()
        & pl.col("compactness").is_finite()
        & (pl.col("compactness") > 0)
        & (pl.col("compactness") <= 1.0)
    ).select(pl.col("compactness"))

    compactness_chart = (
        alt.Chart(_cmp.to_pandas())
        .mark_bar(opacity=0.7, color="#f58518")
        .encode(
            x=alt.X(
                "compactness:Q",
                bin=alt.Bin(maxbins=30),
                title="Compactness (isoperimetric quotient)",
            ),
            y=alt.Y("count()", title="Number of buildings"),
        )
        .properties(width=500, height=250, title="Compactness Distribution")
    )

    # --- Height distribution (where available) ---
    _ht = buildings_df.filter(
        pl.col("height").is_not_null()
    ).select(pl.col("height"))

    if len(_ht) > 0:
        height_chart = (
            alt.Chart(_ht.to_pandas())
            .mark_bar(opacity=0.7, color="#e45756")
            .encode(
                x=alt.X(
                    "height:Q",
                    bin=alt.Bin(maxbins=30),
                    title="Height (m)",
                ),
                y=alt.Y("count()", title="Number of buildings"),
            )
            .properties(
                width=500,
                height=250,
                title=f"Height Distribution ({len(_ht):,} buildings with data)",
            )
        )
    else:
        height_chart = None

    _charts = alt.vconcat(footprint_chart, compactness_chart)
    if height_chart is not None:
        _charts = alt.vconcat(footprint_chart, compactness_chart, height_chart)

    mo.md("### Distributions")
    _charts
    return


@app.cell
def spacematrix_plot(alt, fsi, gsi, mo):
    _zones = [
        {"label": "Suburban",        "x": 0.05, "x2": 0.20, "y": 0.05, "y2": 0.50},
        {"label": "Garden City",     "x": 0.10, "x2": 0.30, "y": 0.20, "y2": 1.00},
        {"label": "Row Houses",      "x": 0.25, "x2": 0.50, "y": 0.50, "y2": 1.50},
        {"label": "Perimeter Block", "x": 0.30, "x2": 0.60, "y": 1.00, "y2": 3.00},
        {"label": "Tower-in-Park",   "x": 0.05, "x2": 0.25, "y": 1.50, "y2": 4.00},
        {"label": "High-Rise",       "x": 0.15, "x2": 0.45, "y": 3.00, "y2": 8.00},
    ]

    _zones_chart = (
        alt.Chart(alt.Data(values=_zones))
        .mark_rect(opacity=0.08, stroke="#888", strokeWidth=0.5)
        .encode(
            x=alt.X("x:Q"),
            x2="x2:Q",
            y=alt.Y("y:Q"),
            y2="y2:Q",
        )
    )

    _zone_labels = (
        alt.Chart(alt.Data(values=_zones))
        .mark_text(align="left", baseline="top", fontSize=10, opacity=0.5)
        .encode(
            x="x:Q",
            y="y2:Q",
            text="label:N",
        )
    )

    _point_data = [{"GSI": gsi, "FSI": fsi, "label": "Current pedshed"}]
    _point = (
        alt.Chart(alt.Data(values=_point_data))
        .mark_point(size=150, filled=True, color="#e45756")
        .encode(
            x=alt.X(
                "GSI:Q",
                scale=alt.Scale(domain=[0, 0.7]),
                title="GSI (Ground Space Index)",
            ),
            y=alt.Y(
                "FSI:Q",
                scale=alt.Scale(domain=[0, 8]),
                title="FSI (Floor Space Index)",
            ),
            tooltip=["label:N", "GSI:Q", "FSI:Q"],
        )
    )

    _point_label = (
        alt.Chart(alt.Data(values=_point_data))
        .mark_text(align="left", dx=10, dy=-5, fontSize=12, fontWeight="bold", color="#e45756")
        .encode(
            x="GSI:Q",
            y="FSI:Q",
            text="label:N",
        )
    )

    spacematrix_chart = (
        (_zones_chart + _zone_labels + _point + _point_label)
        .properties(width=550, height=400, title="Spacematrix: GSI vs FSI with Typology Zones")
    )

    mo.md("### Spacematrix Position")
    spacematrix_chart
    return


if __name__ == "__main__":
    app.run()

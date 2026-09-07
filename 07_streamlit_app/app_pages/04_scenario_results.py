"""
Scenario Results — compare scenario output against the reference baseline.

Provides:
  • KPI outcome tiles: Reference vs Scenario + absolute and % delta
  • Side-by-side production and financial charts
  • Waterfall: Reference → per-case deltas → Scenario
  • Applied changes summary table
"""

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from scenario_modeller.data.loaders import load_case_listing
from scenario_modeller.services.comparison_service import (
    build_waterfall,
    scenario_kpi_delta,
)
from scenario_modeller.services.portfolio_service import stacked_by_case
from scenario_modeller.ui.theme import (
    CHART_PALETTE,
    DARK_GREEN,
    GREEN,
    LIGHT_GREEN,
    METRIC_CSS,
    MUTED,
    NEGATIVE,
    POSITIVE,
    WHITE,
    apply_bp_layout,
)

SAMPLE_DIR = Path(__file__).parent.parent / "data" / "sample"
YEARS_HORIZON = list(range(2026, 2041))


@st.cache_data
def _load_cl():
    return load_case_listing(SAMPLE_DIR / "001_case_listing.csv")


case_listing = _load_cl()

st.markdown(METRIC_CSS, unsafe_allow_html=True)

# ── Journey strip ─────────────────────────────────────────────────────────

st.markdown(
    f"""
    <div style="background-color:{DARK_GREEN}; border:1px solid {GREEN};
                border-radius:6px; padding:0.8rem 1.2rem; margin-bottom:1rem;">
        <span style="color:{MUTED}; font-size:0.85rem;">WORKFLOW</span>&nbsp;&nbsp;
        <span style="color:{MUTED};">1 · Explore Portfolio</span>
        &nbsp;›&nbsp;<span style="color:{MUTED};">2 · Build a Scenario</span>
        &nbsp;›&nbsp;
        <span style="color:{LIGHT_GREEN}; font-weight:600;">3 · Review Results</span>
    </div>
    """,
    unsafe_allow_html=True,
)

st.header("Scenario Results")

# ── Guard ─────────────────────────────────────────────────────────────────

results = st.session_state.get("last_results")
baseline = st.session_state.get("last_baseline")
scenario_name = st.session_state.get("last_scenario_name", "Scenario")

if results is None or (hasattr(results, "empty") and results.empty):
    st.info("No results yet — configure and run a scenario on **Build a Scenario** first.")
    st.page_link("app_pages/03_build_scenario.py", label="Go to Build a Scenario →", icon="🔧")
    st.stop()

errors = st.session_state.get("last_errors", [])
scen_state = st.session_state.get("last_scenario_state", {})

st.caption(f"Comparing **{scenario_name}** against reference baseline.")

if scen_state.get("description"):
    st.markdown(f"> {scen_state['description']}")
if scen_state.get("rationale"):
    st.markdown(f"*Rationale: {scen_state['rationale']}*")

# ── Sidebar filters ───────────────────────────────────────────────────────

all_metrics = sorted(results["Metric"].dropna().unique().tolist()) if "Metric" in results.columns else []
PROD_METRIC = "Production"        if "Production"        in all_metrics else (all_metrics[0] if all_metrics else "")
FCF_METRIC  = "Pre Tax Cash Flow" if "Pre Tax Cash Flow" in all_metrics else (all_metrics[0] if all_metrics else "")
GM_METRIC   = "Gross Margin"      if "Gross Margin"      in all_metrics else (all_metrics[0] if all_metrics else "")

with st.sidebar:
    st.subheader("Results Filters")
    kpi_metric1 = st.selectbox(
        "KPI Metric 1", all_metrics,
        index=all_metrics.index(PROD_METRIC) if PROD_METRIC in all_metrics else 0,
        key="res_kpi1",
    )
    kpi_metric2 = st.selectbox(
        "KPI Metric 2", all_metrics,
        index=all_metrics.index(FCF_METRIC) if FCF_METRIC in all_metrics else 0,
        key="res_kpi2",
    )
    waterfall_metric = st.selectbox(
        "Waterfall Metric", all_metrics,
        index=all_metrics.index(FCF_METRIC) if FCF_METRIC in all_metrics else 0,
        key="res_wf_metric",
    )
    year_range = st.slider(
        "Year range", min_value=2026, max_value=2040, value=(2026, 2040),
        key="res_years",
    )
    sel_years = list(range(year_range[0], year_range[1] + 1))

# ── KPI comparison tiles ──────────────────────────────────────────────────

kpi_deltas = scenario_kpi_delta(baseline, results, case_listing, [kpi_metric1, kpi_metric2, GM_METRIC], sel_years)

def _fmt(v: float, prefix: str = "") -> str:
    return f"{prefix}{v:,.0f}"

def _delta_str(d: dict, prefix: str = "") -> str:
    sign = "+" if d["delta"] >= 0 else ""
    return f"{sign}{prefix}{d['delta']:,.0f} ({sign}{d['delta_pct']:.1f}%)"

k1, k2, k3, k4 = st.columns(4)

d1 = kpi_deltas.get(kpi_metric1, {})
d2 = kpi_deltas.get(kpi_metric2, {})
d3 = kpi_deltas.get(GM_METRIC, {})

if d1:
    k1.metric(
        f"{kpi_metric1} — Scenario",
        _fmt(d1["scenario"]),
        delta=_delta_str(d1),
        delta_color="normal",
        help=f"Reference: {_fmt(d1['baseline'])}",
    )
if d2:
    k2.metric(
        f"{kpi_metric2} — Scenario",
        _fmt(d2["scenario"], "$") + "m",
        delta=_delta_str(d2, "$") + "m",
        delta_color="normal",
        help=f"Reference: {_fmt(d2['baseline'], '$')}m",
    )
if d3:
    k3.metric(
        f"{GM_METRIC} — Scenario",
        _fmt(d3["scenario"], "$") + "m",
        delta=_delta_str(d3, "$") + "m",
        delta_color="normal",
        help=f"Reference: {_fmt(d3['baseline'], '$')}m",
    )
k4.metric("Errors", len(errors), delta_color="off")

if errors:
    with st.expander(f"⚠️ {len(errors)} error(s)"):
        st.dataframe(pd.DataFrame(errors), use_container_width=True, hide_index=True)

st.divider()

# ── Comparison charts ─────────────────────────────────────────────────────

def _stacked_area(df, case_listing, metric, ids, title):
    data = stacked_by_case(df, case_listing, metric, selected_ids=ids)
    if data.empty:
        return go.Figure()
    data = data[data["Year"].isin(sel_years)]
    fig = go.Figure()
    for i, case_name in enumerate(sorted(data["Case Name"].unique())):
        sub = data[data["Case Name"] == case_name]
        color = CHART_PALETTE[i % len(CHART_PALETTE)]
        fig.add_trace(go.Scatter(
            x=sub["Year"], y=sub["Value"],
            name=case_name, mode="none",
            fill="tonexty" if i > 0 else "tozeroy",
            stackgroup="one",
            line=dict(color=color), fillcolor=color,
        ))
    apply_bp_layout(fig, title)
    fig.update_layout(height=280, showlegend=False)
    return fig

chart_col1, chart_col2 = st.columns(2)
all_ids = case_listing["ID"].tolist()

with chart_col1:
    st.caption("Reference")
    fig_b1 = _stacked_area(baseline, case_listing, kpi_metric1, all_ids, f"Reference — {kpi_metric1}")
    st.plotly_chart(fig_b1, use_container_width=True)

with chart_col2:
    st.caption("Scenario")
    fig_s1 = _stacked_area(results, case_listing, kpi_metric1, all_ids, f"Scenario — {kpi_metric1}")
    st.plotly_chart(fig_s1, use_container_width=True)

st.divider()

# ── Waterfall ─────────────────────────────────────────────────────────────

st.subheader(f"Impact Waterfall — {waterfall_metric}")
st.caption("Reference → per-case changes → Scenario total.")

wf = build_waterfall(baseline, results, case_listing, waterfall_metric, sel_years)

if not wf.empty:
    measure = []
    text_vals = []
    for _, row in wf.iterrows():
        if row["Type"] == "absolute":
            measure.append("absolute")
        else:
            measure.append("relative")
        text_vals.append(f"{row['Value']:,.0f}")

    # Colour: reference=blue, positive delta=green, negative delta=red, scenario=blue
    marker_colors = []
    for _, row in wf.iterrows():
        if row["Type"] == "absolute":
            marker_colors.append(CHART_PALETTE[0])
        elif row["Value"] >= 0:
            marker_colors.append(POSITIVE)
        else:
            marker_colors.append(NEGATIVE)

    fig_wf = go.Figure(go.Waterfall(
        name="", orientation="v",
        measure=measure,
        x=wf["Label"].tolist(),
        y=wf["Value"].tolist(),
        text=text_vals,
        textposition="outside",
        connector=dict(line=dict(color=MUTED, width=1, dash="dot")),
        increasing=dict(marker_color=POSITIVE),
        decreasing=dict(marker_color=NEGATIVE),
        totals=dict(marker_color=CHART_PALETTE[0]),
    ))
    apply_bp_layout(fig_wf, "")
    fig_wf.update_layout(height=380, showlegend=False, xaxis_tickangle=-30)
    st.plotly_chart(fig_wf, use_container_width=True)
else:
    st.info("Waterfall data unavailable.")

st.divider()

# ── Applied changes table ─────────────────────────────────────────────────

st.subheader("Applied Changes")
st.caption("Operations and parameters configured for this scenario run.")

if scen_state:
    rows = []
    for case_id, cs in scen_state.get("cases", {}).items():
        if not cs.get("include", True):
            continue
        cl_row = case_listing[case_listing["ID"] == case_id]
        case_name = cl_row.iloc[0]["Case Name"] if not cl_row.empty else str(case_id)
        params = cs.get("params", [])
        rows.append({
            "Case Name": case_name,
            "Operation": cs.get("operation", "No Change"),
            "Param1": params[0] if len(params) > 0 else 0.0,
            "Param2": params[1] if len(params) > 1 else 0.0,
            "Param3": params[2] if len(params) > 2 else 0.0,
            "Param4": params[3] if len(params) > 3 else 0.0,
            "Param5": params[4] if len(params) > 4 else 0.0,
        })
    if rows:
        changes_df = pd.DataFrame(rows)
        st.dataframe(changes_df, use_container_width=True, hide_index=True)
    else:
        st.info("No non-default operations applied.")

st.divider()

# ── Full output table ─────────────────────────────────────────────────────

with st.expander("Full scenario output table"):
    filt_res = results.copy()
    sel_metrics = st.multiselect(
        "Filter metrics", all_metrics,
        default=all_metrics[:5] if len(all_metrics) > 5 else all_metrics,
        key="res_tbl_metrics",
    )
    if sel_metrics:
        filt_res = filt_res[filt_res["Metric"].isin(sel_metrics)]
    filt_res = filt_res[filt_res["Year"].isin(sel_years)]
    display_cols = [c for c in ["Case", "Operation", "Metric", "Year", "Value"] if c in filt_res.columns]
    st.dataframe(
        filt_res[display_cols].sort_values(["Case", "Metric", "Year"]),
        use_container_width=True, hide_index=True,
    )

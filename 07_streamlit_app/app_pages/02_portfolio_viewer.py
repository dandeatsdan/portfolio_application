"""
Portfolio Viewer — explore the baseline portfolio.

Provides:
  • KPI headline tiles (Production, FCF, Gross Margin)
  • Stacked area charts: Production and Pre-Tax Cash Flow by case over the planning horizon
  • Ranked Contributors bar chart
  • Entity Summary table with case selection
  • "Build a Scenario" navigation link with selected-case count
"""

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from scenario_modeller.data.loaders import (
    load_case_listing,
    load_profiles,
    load_totals_avgs,
)
from scenario_modeller.services.portfolio_service import (
    creaming_curve,
    portfolio_kpis,
    rank_contributors,
    stacked_by_case,
)
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

# ── Data (cached) ─────────────────────────────────────────────────────────

@st.cache_data
def _load():
    cl = load_case_listing(SAMPLE_DIR / "001_case_listing.csv")
    prof = load_profiles(SAMPLE_DIR / "002_profiles.csv")
    ta = load_totals_avgs(SAMPLE_DIR / "004_totals_avgs.csv")
    return cl, prof, ta


try:
    case_listing, profiles, totals_avgs = _load()
except ValueError as e:
    st.error(f"Data load failed: {e}")
    st.stop()

all_metrics = sorted(totals_avgs["Metric"].unique().tolist())
PROD_METRIC   = "Production"          if "Production"          in all_metrics else all_metrics[0]
FCF_METRIC    = "Pre Tax Cash Flow"   if "Pre Tax Cash Flow"   in all_metrics else all_metrics[0]
GM_METRIC     = "Gross Margin"        if "Gross Margin"        in all_metrics else all_metrics[0]
CAPEX_METRIC  = "Cash Capex"          if "Cash Capex"          in all_metrics else all_metrics[0]
OPEX_METRIC   = "Cash Costs"          if "Cash Costs"          in all_metrics else all_metrics[0]

st.markdown(METRIC_CSS, unsafe_allow_html=True)

# ── Journey strip ─────────────────────────────────────────────────────────

st.markdown(
    f"""
    <div style="background-color:{DARK_GREEN}; border:1px solid {GREEN};
                border-radius:6px; padding:0.8rem 1.2rem; margin-bottom:1rem;">
        <span style="color:{MUTED}; font-size:0.85rem;">WORKFLOW</span>&nbsp;&nbsp;
        <span style="color:{LIGHT_GREEN}; font-weight:600;">1 · Explore Portfolio</span>
        &nbsp;›&nbsp;<span style="color:{MUTED};">2 · Build a Scenario</span>
        &nbsp;›&nbsp;<span style="color:{MUTED};">3 · Review Results</span>
    </div>
    """,
    unsafe_allow_html=True,
)

st.header("Portfolio Viewer")
st.caption("Baseline reference portfolio — sanitised representative data only.")

# ── Sidebar filters ───────────────────────────────────────────────────────

with st.sidebar:
    st.subheader("Filters")
    available_segments = sorted(case_listing["Segment"].unique().tolist())
    sel_segments = st.multiselect(
        "Segment", available_segments, default=available_segments, key="pv_seg"
    )
    available_regions = sorted(case_listing["Region"].unique().tolist())
    sel_regions = st.multiselect(
        "Region", available_regions, default=available_regions, key="pv_reg"
    )
    chart_metric = st.selectbox(
        "Chart Metric", options=all_metrics,
        index=all_metrics.index(PROD_METRIC) if PROD_METRIC in all_metrics else 0,
        key="pv_chart_metric",
    )
    fcf_metric = st.selectbox(
        "Financial Metric", options=all_metrics,
        index=all_metrics.index(FCF_METRIC) if FCF_METRIC in all_metrics else 0,
        key="pv_fcf_metric",
    )

# Filter case listing by sidebar selections
filtered_cl = case_listing[
    case_listing["Segment"].isin(sel_segments) &
    case_listing["Region"].isin(sel_regions)
].copy()
filtered_ids = filtered_cl["ID"].tolist()

# ── KPI tiles ─────────────────────────────────────────────────────────────

kpis = portfolio_kpis(profiles, filtered_cl, totals_avgs, [PROD_METRIC, fcf_metric, GM_METRIC])

k1, k2, k3, k4 = st.columns(4)
k1.metric(
    f"{PROD_METRIC} (5Y Total)",
    f"{kpis.get(PROD_METRIC, 0):,.0f}",
    help="Sum of Production Total 5Y across selected cases",
)
k2.metric(
    f"{fcf_metric} (5Y Total)",
    f"${kpis.get(fcf_metric, 0):,.0f}m",
    help="Sum of selected financial metric Total 5Y across selected cases",
)
k3.metric(
    f"{GM_METRIC} (5Y Total)",
    f"${kpis.get(GM_METRIC, 0):,.0f}m",
    help="Gross Margin Total 5Y",
)
k4.metric(
    "Cases selected",
    len(filtered_ids),
    help="Cases matching current sidebar filters",
)

st.divider()

# ── Production & Financial charts ─────────────────────────────────────────

chart_col1, chart_col2 = st.columns(2)

def _stacked_area(profiles, case_listing, metric, ids, title):
    df = stacked_by_case(profiles, case_listing, metric, selected_ids=ids)
    if df.empty:
        return go.Figure()
    fig = go.Figure()
    for i, case_name in enumerate(sorted(df["Case Name"].unique())):
        sub = df[df["Case Name"] == case_name]
        color = CHART_PALETTE[i % len(CHART_PALETTE)]
        fig.add_trace(go.Scatter(
            x=sub["Year"], y=sub["Value"],
            name=case_name,
            mode="none",
            fill="tonexty" if i > 0 else "tozeroy",
            stackgroup="one",
            line=dict(color=color),
            fillcolor=color,
        ))
    apply_bp_layout(fig, title)
    fig.update_layout(height=320, showlegend=True)
    return fig

with chart_col1:
    fig1 = _stacked_area(profiles, filtered_cl, chart_metric, filtered_ids, chart_metric)
    st.plotly_chart(fig1, use_container_width=True)

with chart_col2:
    fig2 = _stacked_area(profiles, filtered_cl, fcf_metric, filtered_ids, fcf_metric)
    st.plotly_chart(fig2, use_container_width=True)

# ── Ranked Contributors & Creaming Curve ──────────────────────────────────

rank_col, cream_col = st.columns(2)

with rank_col:
    st.subheader(f"Ranked Contributors — {fcf_metric}")
    ranked = rank_contributors(profiles, filtered_cl, fcf_metric)
    if not ranked.empty:
        colors = [POSITIVE if v >= 0 else NEGATIVE for v in ranked["Total"]]
        fig_rank = go.Figure(go.Bar(
            x=ranked["Total"],
            y=ranked["Case Name"],
            orientation="h",
            marker_color=colors,
            text=[f"{v:,.0f}" for v in ranked["Total"]],
            textposition="outside",
            textfont=dict(color=WHITE, size=10),
        ))
        apply_bp_layout(fig_rank, "")
        fig_rank.update_layout(height=320, showlegend=False)
        fig_rank.update_yaxes(autorange="reversed")
        st.plotly_chart(fig_rank, use_container_width=True)
    else:
        st.info("No data for selected filters.")

with cream_col:
    st.subheader(f"Creaming Curve — {fcf_metric}")
    cream = creaming_curve(profiles, filtered_cl, fcf_metric)
    if not cream.empty:
        fig_cream = go.Figure()
        fig_cream.add_trace(go.Bar(
            x=cream["Case Name"], y=cream["Total"],
            name="Individual",
            marker_color=CHART_PALETTE[0],
        ))
        fig_cream.add_trace(go.Scatter(
            x=cream["Case Name"], y=cream["Cumulative"],
            name="Cumulative",
            mode="lines+markers",
            line=dict(color=LIGHT_GREEN, width=2),
            yaxis="y2",
        ))
        apply_bp_layout(fig_cream, "")
        fig_cream.update_layout(
            height=320,
            yaxis2=dict(
                overlaying="y", side="right",
                gridcolor=GREEN, tickfont_color=MUTED, title_font_color=WHITE,
                showgrid=False,
            ),
            xaxis_tickangle=-35,
        )
        st.plotly_chart(fig_cream, use_container_width=True)
    else:
        st.info("No data for selected filters.")

st.divider()

# ── Entity Summary — selection table ─────────────────────────────────────

st.subheader("Entity Summary")
st.caption(
    "Tick **Include in Scenario** to shortlist cases for scenario configuration. "
    "Then click **Build a Scenario** below."
)

# Initialise selection state (persists across reruns)
if "portfolio_selection" not in st.session_state:
    st.session_state["portfolio_selection"] = set(case_listing["ID"].tolist())

# Build the selection DataFrame
sel_df = filtered_cl[["ID", "Case Name", "Group Entity", "Segment", "Region", "Country", "Plan Type"]].copy()
sel_df["Include in Scenario"] = sel_df["ID"].isin(st.session_state["portfolio_selection"])

_sel_key = "entity_summary_editor"
_sel_base_key = "entity_summary_base"

# Apply previous edits before rebuilding
if _sel_key in st.session_state and _sel_base_key in st.session_state:
    diff = st.session_state[_sel_key]
    base = st.session_state[_sel_base_key].copy()
    for row_idx_str, changes in diff.get("edited_rows", {}).items():
        row_idx = int(row_idx_str)
        for col, val in changes.items():
            if col in base.columns:
                base.at[row_idx, col] = val
    # Persist selection to session state
    new_selection = set(
        base.loc[base["Include in Scenario"] == True, "ID"].tolist()
    )
    st.session_state["portfolio_selection"] = new_selection
    sel_df["Include in Scenario"] = sel_df["ID"].isin(new_selection)

st.session_state[_sel_base_key] = sel_df.copy()

edited = st.data_editor(
    sel_df,
    column_config={
        "ID":                   st.column_config.NumberColumn("ID", disabled=True, width=50),
        "Case Name":            st.column_config.TextColumn("Case Name", disabled=True, width=220),
        "Group Entity":         st.column_config.TextColumn("Group Entity", disabled=True, width=180),
        "Segment":              st.column_config.TextColumn("Segment", disabled=True, width=100),
        "Region":               st.column_config.TextColumn("Region", disabled=True, width=160),
        "Country":              st.column_config.TextColumn("Country", disabled=True, width=160),
        "Plan Type":            st.column_config.TextColumn("Plan Type", disabled=True, width=110),
        "Include in Scenario":  st.column_config.CheckboxColumn("Include in Scenario?", width=160),
    },
    use_container_width=True,
    hide_index=True,
    num_rows="fixed",
    key=_sel_key,
)

# ── Build a Scenario CTA ──────────────────────────────────────────────────

n_selected = len(st.session_state.get("portfolio_selection", set()))

st.divider()
cta_col, link_col = st.columns([2, 1])
with cta_col:
    if n_selected > 0:
        st.success(f"**{n_selected}** case(s) selected for scenario configuration.")
    else:
        st.warning("No cases selected. Tick cases above before building a scenario.")

with link_col:
    st.page_link(
        "app_pages/03_build_scenario.py",
        label=f"Build a Scenario with {n_selected} case(s) →",
        icon="🔧",
    )

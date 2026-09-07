"""
Home — journey start page.

Three destination cards and a workflow guide strip.
No data is loaded here; this is purely navigational.
"""

import streamlit as st

from scenario_modeller.ui.theme import DARK_GREEN, GREEN, LIGHT_GREEN, MUTED, WHITE

# ── Journey strip ─────────────────────────────────────────────────────────

st.markdown(
    f"""
    <div style="background-color:{DARK_GREEN}; border:1px solid {GREEN};
                border-radius:6px; padding:0.8rem 1.2rem; margin-bottom:1.2rem;">
        <span style="color:{MUTED}; font-size:0.85rem;">WORKFLOW</span>&nbsp;&nbsp;
        <span style="color:{LIGHT_GREEN}; font-weight:600;">1 · Explore Portfolio</span>
        &nbsp;›&nbsp;
        <span style="color:{WHITE};">2 · Build a Scenario</span>
        &nbsp;›&nbsp;
        <span style="color:{WHITE};">3 · Review Results</span>
    </div>
    """,
    unsafe_allow_html=True,
)

# ── Page header ───────────────────────────────────────────────────────────

st.title("Upstream Portfolio Scenario Modeller")
st.caption(
    "Software learning experiment — sanitised representative data only. "
    "Select a destination below or use the sidebar navigation."
)

st.divider()

# ── Destination cards ─────────────────────────────────────────────────────

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown(
        f"""
        <div style="background-color:{DARK_GREEN}; border:1px solid {GREEN};
                    border-radius:6px; padding:1.4rem; height:180px;">
            <div style="color:{LIGHT_GREEN}; font-size:2rem; margin-bottom:0.5rem;">📊</div>
            <div style="color:{WHITE}; font-size:1.1rem; font-weight:600; margin-bottom:0.4rem;">
                Portfolio Viewer
            </div>
            <div style="color:{MUTED}; font-size:0.88rem;">
                Explore baseline production and financial performance.
                Select cases to take into a scenario.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("app_pages/02_portfolio_viewer.py", label="Open Portfolio Viewer →", icon="📊")

with col2:
    st.markdown(
        f"""
        <div style="background-color:{DARK_GREEN}; border:1px solid {GREEN};
                    border-radius:6px; padding:1.4rem; height:180px;">
            <div style="color:{LIGHT_GREEN}; font-size:2rem; margin-bottom:0.5rem;">🔧</div>
            <div style="color:{WHITE}; font-size:1.1rem; font-weight:600; margin-bottom:0.4rem;">
                Build a Scenario
            </div>
            <div style="color:{MUTED}; font-size:0.88rem;">
                Configure operations for selected cases.
                Set parameters and run the scenario engine.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("app_pages/03_build_scenario.py", label="Open Scenario Builder →", icon="🔧")

with col3:
    st.markdown(
        f"""
        <div style="background-color:{DARK_GREEN}; border:1px solid {GREEN};
                    border-radius:6px; padding:1.4rem; height:180px;">
            <div style="color:{LIGHT_GREEN}; font-size:2rem; margin-bottom:0.5rem;">📈</div>
            <div style="color:{WHITE}; font-size:1.1rem; font-weight:600; margin-bottom:0.4rem;">
                Scenario Results
            </div>
            <div style="color:{MUTED}; font-size:0.88rem;">
                Compare scenario against reference portfolio.
                Review impacts, waterfall, and applied changes.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("app_pages/04_scenario_results.py", label="Open Results →", icon="📈")

st.divider()

# ── Status banner ─────────────────────────────────────────────────────────

has_results = (
    "last_results" in st.session_state
    and st.session_state["last_results"] is not None
    and not st.session_state["last_results"].empty
)

if has_results:
    scenario_name = st.session_state.get("last_scenario_name", "Scenario")
    n_rows = len(st.session_state["last_results"])
    st.success(
        f"Last run: **{scenario_name}** — {n_rows:,} output rows. "
        "Go to Scenario Results to review."
    )
else:
    st.info("No scenario has been run yet. Start on Portfolio Viewer to explore the baseline data.")

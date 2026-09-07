"""
Scenario Modeller — Streamlit MPA v2 entry point.

Uses st.navigation + st.Page for the Horizon X four-screen experience.
All analytical logic lives in scenario_modeller.*; no business rules here.
"""

import streamlit as st

st.set_page_config(
    page_title="Scenario Modeller",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

from scenario_modeller.ui.theme import DARK_GREEN, GREEN, LIGHT_GREEN, MUTED, WHITE

# ── Sidebar brand strip ───────────────────────────────────────────────────

with st.sidebar:
    st.markdown(
        f"""
        <div style="background-color:{DARK_GREEN}; border-bottom:2px solid {LIGHT_GREEN};
                    padding:0.8rem 1rem; margin-bottom:1rem; border-radius:4px;">
            <span style="color:{LIGHT_GREEN}; font-size:1.1rem; font-weight:700;
                         letter-spacing:0.05em;">UPSTREAM</span>
            <br/>
            <span style="color:{MUTED}; font-size:0.78rem; letter-spacing:0.08em;">
                PORTFOLIO SCENARIO MODELLER
            </span>
        </div>
        """,
        unsafe_allow_html=True,
    )

# ── Navigation ────────────────────────────────────────────────────────────

pg = st.navigation(
    [
        st.Page("app_pages/01_home.py",             title="Home",               icon="🏠"),
        st.Page("app_pages/02_portfolio_viewer.py", title="Portfolio Viewer",   icon="📊"),
        st.Page("app_pages/03_build_scenario.py",   title="Build a Scenario",   icon="🔧"),
        st.Page("app_pages/04_scenario_results.py", title="Scenario Results",   icon="📈"),
    ]
)
pg.run()

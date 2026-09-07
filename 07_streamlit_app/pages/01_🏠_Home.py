"""Home page — data status and smoke-test run."""

from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Home", page_icon="🏠", layout="wide")

from scenario_modeller.data.loaders import load_case_listing, load_profiles
from scenario_modeller.engine.scenario_engine import run_scenario

SAMPLE_DIR = Path(__file__).parent.parent / "data" / "sample"

st.header("Home")
st.caption("Load data and confirm the engine is working correctly.")

@st.cache_data
def _load_data():
    case_listing = load_case_listing(SAMPLE_DIR / "001_case_listing.csv")
    profiles = load_profiles(SAMPLE_DIR / "002_profiles.csv")
    return case_listing, profiles


try:
    case_listing, profiles = _load_data()
    data_ok = True
    st.success(f"Data loaded — {len(case_listing)} cases, {len(profiles):,} profile rows.")
except ValueError as e:
    st.error(f"Data load failed: {e}")
    data_ok = False

if data_ok:
    st.subheader("Modelling Cases")
    st.dataframe(
        case_listing[["ID", "Case Name", "Group Entity", "Segment", "Region", "Country", "Plan Type"]],
        use_container_width=True,
        hide_index=True,
    )

    st.divider()
    st.subheader("NoChange Smoke Test")
    st.write(
        "Runs NoChange on all cases — output should match the baseline profile exactly."
    )

    if st.button("Run NoChange on all cases"):
        instructions = case_listing[["ID", "Case"]].copy()
        instructions["Scenario"] = 1
        instructions["Include"] = True
        instructions["Operation"] = "NoChange"
        for p in ["Param1", "Param2", "Param3", "Param4", "Param5"]:
            instructions[p] = 0.0

        results, errors = run_scenario(profiles, instructions)

        col1, col2, col3 = st.columns(3)
        col1.metric("Input rows", len(profiles))
        col2.metric("Output rows", len(results))
        col3.metric("Errors", len(errors))

        if errors:
            st.warning("Errors encountered:")
            st.dataframe(pd.DataFrame(errors), use_container_width=True)
        else:
            st.success(f"✅ {len(results):,} rows returned — engine working correctly.")

        with st.expander("Preview output (first 100 rows)"):
            st.dataframe(results.head(100), use_container_width=True, hide_index=True)

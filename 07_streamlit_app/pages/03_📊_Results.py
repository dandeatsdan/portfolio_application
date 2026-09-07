"""
Results page — review the last scenario output.

Displays the output from the most recently run scenario with basic
metric and case filters. Full comparison capability comes in a later iteration.
"""

import streamlit as st

st.set_page_config(page_title="Results", page_icon="📊", layout="wide")

st.header("Results")

if "last_results" not in st.session_state or st.session_state["last_results"].empty:
    st.info("No results yet — configure and run a scenario on the **Scenario Builder** page first.")
    st.stop()

results = st.session_state["last_results"]
errors = st.session_state.get("last_errors", [])
scenario_name = st.session_state.get("last_scenario_name", "Scenario")

st.caption(f"Showing results for: **{scenario_name}**")

# ---------------------------------------------------------------------------
# Summary metrics
# ---------------------------------------------------------------------------

col1, col2, col3 = st.columns(3)
col1.metric("Output rows", f"{len(results):,}")
col2.metric("Cases", results["Case"].nunique() if "Case" in results.columns else "—")
col3.metric("Errors", len(errors))

if errors:
    import pandas as pd
    with st.expander(f"⚠️ {len(errors)} error(s) from last run"):
        st.dataframe(pd.DataFrame(errors), use_container_width=True, hide_index=True)

st.divider()

# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

col_f1, col_f2 = st.columns(2)

with col_f1:
    all_metrics = sorted(results["Metric"].dropna().unique().tolist()) if "Metric" in results.columns else []
    selected_metrics = st.multiselect("Filter by Metric", options=all_metrics, default=all_metrics[:5] if len(all_metrics) > 5 else all_metrics)

with col_f2:
    all_cases = sorted(results["Case"].dropna().unique().tolist()) if "Case" in results.columns else []
    selected_cases = st.multiselect("Filter by Case", options=all_cases, default=all_cases)

# Apply filters
filtered = results.copy()
if selected_metrics:
    filtered = filtered[filtered["Metric"].isin(selected_metrics)]
if selected_cases:
    filtered = filtered[filtered["Case"].isin(selected_cases)]

# ---------------------------------------------------------------------------
# Output table
# ---------------------------------------------------------------------------

st.subheader(f"Output — {len(filtered):,} rows")

display_cols = [c for c in ["Case", "Operation", "Metric", "Year", "Value"] if c in filtered.columns]
st.dataframe(
    filtered[display_cols].sort_values(["Case", "Metric", "Year"]),
    use_container_width=True,
    hide_index=True,
)

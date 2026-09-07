"""
Scenario Builder page — tabular layout matching the Excel Scenario Configuration design.

Three zones in one wide table:
  1. Case Reference Data   — read-only: ID, Case Name, Segment, Region, Country, Plan Type
  2. Financial Screening   — up to 5 configurable metric lookups (XLOOKUP equivalent)
  3. Operation Config      — Include, Operation, Op Description, then per input:
                             Label (auto) | Required (auto) | Value (editable)

All business logic is delegated to scenario_modeller.ui.state and the engine.
"""

from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Scenario Builder", page_icon="📋", layout="wide")

from scenario_modeller.data.loaders import (
    get_param_spec,
    load_case_listing,
    load_operations_library,
    load_profiles,
    load_totals_avgs,
    lookup_value,
)
from scenario_modeller.engine.scenario_engine import run_scenario
from scenario_modeller.ui.state import (
    OPERATION_LABELS,
    apply_editor_changes,
    get_scenario_instructions,
    get_scenario_state,
    init_scenario_state,
)

SAMPLE_DIR = Path(__file__).parent.parent / "data" / "sample"
SCENARIO_ID = 1
YEAR_OPTIONS = ["Total 5Y", "Average 5Y", "2026", "2027", "2028", "2029", "2030"]


# ---------------------------------------------------------------------------
# Load reference data (cached)
# ---------------------------------------------------------------------------

@st.cache_data
def _load_reference():
    case_listing = load_case_listing(SAMPLE_DIR / "001_case_listing.csv")
    profiles = load_profiles(SAMPLE_DIR / "002_profiles.csv")
    ops_library = load_operations_library(SAMPLE_DIR / "005_operations_library.csv")
    totals_avgs = load_totals_avgs(SAMPLE_DIR / "004_totals_avgs.csv")
    return case_listing, profiles, ops_library, totals_avgs


try:
    case_listing, profiles, ops_library, totals_avgs = _load_reference()
except ValueError as e:
    st.error(f"Data load failed: {e}")
    st.stop()

all_metrics = sorted(totals_avgs["Metric"].unique().tolist())

# Initialise session state
init_scenario_state(SCENARIO_ID, case_listing)
state = get_scenario_state(SCENARIO_ID)

N_SLOTS = 5
DEFAULT_YEARS = ["2026", "2027", "2028", "2029", "2030"]

# Initialise financial screening slots
if "screening_slots" not in st.session_state:
    default_metric = all_metrics[0] if all_metrics else ""
    st.session_state["screening_slots"] = [
        {"metric": default_metric, "year": yr} for yr in DEFAULT_YEARS
    ]
if "screening_default_metric" not in st.session_state:
    st.session_state["screening_default_metric"] = (
        st.session_state["screening_slots"][0]["metric"]
    )
slots = st.session_state["screening_slots"]


# ---------------------------------------------------------------------------
# Page header
# ---------------------------------------------------------------------------

st.header("Scenario Builder")
st.caption("Sanitised representative data only.")

# ---------------------------------------------------------------------------
# Scenario metadata
# ---------------------------------------------------------------------------

col_name, col_desc = st.columns([1, 2])
with col_name:
    state["name"] = st.text_input("Scenario Name", value=state["name"], key=f"scen_name_{SCENARIO_ID}")
with col_desc:
    state["description"] = st.text_input(
        "Description", value=state["description"],
        placeholder="Describe the assumptions being tested…",
        key=f"scen_desc_{SCENARIO_ID}",
    )

st.divider()

# ---------------------------------------------------------------------------
# Financial Screening slot selectors
# ---------------------------------------------------------------------------

st.subheader("Financial Screening")
st.caption(
    "Select a metric to populate reference values for each planning year across all cases. "
    "Use these to inform operation parameters before configuring the table below."
)

# Default metric selector — applies to all 5 amounts
dm_index = all_metrics.index(st.session_state["screening_default_metric"]) \
    if st.session_state["screening_default_metric"] in all_metrics else 0

default_metric_sel = st.selectbox(
    "Financial Screening — Metric (applied to all amounts)",
    options=all_metrics,
    index=dm_index,
    key="screening_default_metric",
)

# When the default metric changes, reset all per-slot metric keys so the
# individual selectboxes in the expander don't silently override the new default.
prev_default = st.session_state.get("_screening_prev_default")
if prev_default != default_metric_sel:
    for i in range(N_SLOTS):
        st.session_state[f"slot_metric_{i}"] = default_metric_sel
    st.session_state["_screening_prev_default"] = default_metric_sel

with st.expander("Customise individual amounts"):
    slot_cols = st.columns(N_SLOTS)
    for i, col in enumerate(slot_cols):
        with col:
            st.caption(f"**Amount {i+1}**")
            slots[i]["metric"] = st.selectbox(
                "Metric",
                options=all_metrics,
                index=all_metrics.index(st.session_state.get(f"slot_metric_{i}", default_metric_sel)),
                key=f"slot_metric_{i}",
            )
            cur_year = slots[i]["year"] if slots[i]["year"] in YEAR_OPTIONS else DEFAULT_YEARS[i]
            slots[i]["year"] = st.selectbox(
                "Period",
                options=YEAR_OPTIONS,
                index=YEAR_OPTIONS.index(cur_year),
                key=f"slot_year_{i}",
            )
    st.caption("Changes here override the default metric for individual amounts only.")

slot_headers = []
for i in range(N_SLOTS):
    label = slots[i]["metric"]
    truncated = f"{label[:18]}… {slots[i]['year']}" if len(label) > 18 else f"{label} {slots[i]['year']}"
    slot_headers.append(f"Amount {i+1}\n{truncated}")

st.divider()

# ---------------------------------------------------------------------------
# Build the configuration DataFrame
# ---------------------------------------------------------------------------

def _req_label(required: bool) -> str:
    return "Required" if required else "Optional"


def _build_editor_df() -> pd.DataFrame:
    rows = []
    for _, cl_row in case_listing.iterrows():
        case_id = int(cl_row["ID"])
        cs = state["cases"].get(case_id, {"include": True, "operation": "No Change", "params": [0.0]*5})
        op_label = cs.get("operation", "No Change")
        params = cs.get("params", [0.0]*5)
        spec = get_param_spec(ops_library, op_label)

        # Auto-populated op description
        op_desc_rows = ops_library[ops_library["Operation"] == op_label]
        op_desc = str(op_desc_rows.iloc[0]["Description"]) if not op_desc_rows.empty else ""

        # Financial screening lookups
        case_name_key = str(cl_row["Case"])
        amounts = [
            lookup_value(totals_avgs, case_name_key, slots[i]["metric"], slots[i]["year"])
            for i in range(N_SLOTS)
        ]

        def _pl(s, idx):
            return s[idx]["label"] if idx < len(s) else "—"

        def _pr(s, idx):
            return _req_label(s[idx]["required"]) if idx < len(s) else "—"

        rows.append({
            # Reference
            "ID":         case_id,
            "Case Name":  str(cl_row["Case Name"]),
            "Segment":    str(cl_row["Segment"]),
            "Region":     str(cl_row["Region"]),
            "Country":    str(cl_row["Country"]),
            "Plan Type":  str(cl_row["Plan Type"]),
            # Financial screening
            "Amount 1":   amounts[0],
            "Amount 2":   amounts[1],
            "Amount 3":   amounts[2],
            "Amount 4":   amounts[3],
            "Amount 5":   amounts[4],
            # Operation config
            "Include":    bool(cs.get("include", True)),
            "Operation":  op_label,
            "Op Desc":    op_desc,
            # Input 1
            "Input 1 Label": _pl(spec, 0),
            "Input 1 Req":   _pr(spec, 0),
            "Input 1":       float(params[0]) if len(params) > 0 else 0.0,
            # Input 2
            "Input 2 Label": _pl(spec, 1),
            "Input 2 Req":   _pr(spec, 1),
            "Input 2":       float(params[1]) if len(params) > 1 else 0.0,
            # Input 3
            "Input 3 Label": _pl(spec, 2),
            "Input 3 Req":   _pr(spec, 2),
            "Input 3":       float(params[2]) if len(params) > 2 else 0.0,
            # Input 4
            "Input 4 Label": _pl(spec, 3),
            "Input 4 Req":   _pr(spec, 3),
            "Input 4":       float(params[3]) if len(params) > 3 else 0.0,
            # Input 5
            "Input 5 Label": _pl(spec, 4),
            "Input 5 Req":   _pr(spec, 4),
            "Input 5":       float(params[4]) if len(params) > 4 else 0.0,
        })
    return pd.DataFrame(rows)


# Apply any edits from the previous interaction BEFORE rebuilding the display
# DataFrame. st.data_editor stores changes as a diff dict in session_state[key]
# with keys "edited_rows", "added_rows", "deleted_rows". We apply that diff to
# the last known base DataFrame (stored separately) so labels are always derived
# from the current operation selection on this rerun.
_editor_key = f"editor_{SCENARIO_ID}"
_base_key = f"editor_base_{SCENARIO_ID}"

if _editor_key in st.session_state and _base_key in st.session_state:
    diff = st.session_state[_editor_key]
    base_df = st.session_state[_base_key].copy()
    for row_idx_str, changes in diff.get("edited_rows", {}).items():
        row_idx = int(row_idx_str)
        for col, val in changes.items():
            if col in base_df.columns:
                base_df.at[row_idx, col] = val
    apply_editor_changes(SCENARIO_ID, base_df)

editor_df = _build_editor_df()
# Store the base DataFrame so we can apply the diff against it next rerun
st.session_state[_base_key] = editor_df.copy()

# ---------------------------------------------------------------------------
# Readiness summary tiles
# ---------------------------------------------------------------------------

st.subheader("Configuration")

total_cases = len(case_listing)
included = sum(1 for cs in state["cases"].values() if cs.get("include", True))
ops_configured = sum(
    1 for cs in state["cases"].values()
    if cs.get("include", True) and cs.get("operation", "No Change") != "No Change"
)

# Cases with all required params filled
def _required_complete(cs):
    op = cs.get("operation", "No Change")
    spec = get_param_spec(ops_library, op)
    params = cs.get("params", [0.0]*5)
    for i, s in enumerate(spec):
        if s["required"] and (i >= len(params) or params[i] == 0.0):
            return False
    return True

ready = sum(
    1 for cs in state["cases"].values()
    if cs.get("include", True) and _required_complete(cs)
)
readiness_pct = int(100 * ready / included) if included > 0 else 0

tile1, tile2, tile3 = st.columns(3)
tile1.metric("① Case Inclusion", f"{included} / {total_cases}", help="Cases marked Include")
tile2.metric("② Operations configured", f"{ops_configured} / {included}", help="Included cases with a non-NoChange operation")
tile3.metric("③ Scenario Readiness", f"{readiness_pct}%", help="Included cases with all required parameters filled")

st.divider()

# ---------------------------------------------------------------------------
# Main data editor
# ---------------------------------------------------------------------------

st.subheader("Case Configuration")
st.caption(
    "Edit **Include**, **Operation**, and **Input 1–5** columns. "
    "Label, Required, Op Description, and reference columns are read-only."
)

readonly_cols = [
    "ID", "Case Name", "Segment", "Region", "Country", "Plan Type",
    "Amount 1", "Amount 2", "Amount 3",
    "Op Desc",
    "Input 1 Label", "Input 1 Req",
    "Input 2 Label", "Input 2 Req",
    "Input 3 Label", "Input 3 Req",
    "Input 4 Label", "Input 4 Req",
    "Input 5 Label", "Input 5 Req",
]

column_config = {
    "ID":        st.column_config.NumberColumn("ID", disabled=True, width=50),
    "Case Name": st.column_config.TextColumn("Case Name", disabled=True, width=220),
    "Segment":   st.column_config.TextColumn("Segment", disabled=True, width=100),
    "Region":    st.column_config.TextColumn("Region", disabled=True, width=160),
    "Country":   st.column_config.TextColumn("Country", disabled=True, width=160),
    "Plan Type": st.column_config.TextColumn("Plan Type", disabled=True, width=110),
    "Amount 1":  st.column_config.NumberColumn(slot_headers[0], disabled=True, format="%.1f", width=150),
    "Amount 2":  st.column_config.NumberColumn(slot_headers[1], disabled=True, format="%.1f", width=150),
    "Amount 3":  st.column_config.NumberColumn(slot_headers[2], disabled=True, format="%.1f", width=150),
    "Amount 4":  st.column_config.NumberColumn(slot_headers[3], disabled=True, format="%.1f", width=150),
    "Amount 5":  st.column_config.NumberColumn(slot_headers[4], disabled=True, format="%.1f", width=150),
    "Include":   st.column_config.CheckboxColumn("Include?", width=100),
    "Operation": st.column_config.SelectboxColumn(
        "Operation", options=OPERATION_LABELS, width=180,
    ),
    "Op Desc":   st.column_config.TextColumn("Op Description", disabled=True, width=220),
    "Input 1 Label": st.column_config.TextColumn("Input 1 Label", disabled=True, width=200),
    "Input 1 Req":   st.column_config.TextColumn("Input 1 Req", disabled=True, width=90),
    "Input 1":       st.column_config.NumberColumn("Input 1", format="%.4g", width=90),
    "Input 2 Label": st.column_config.TextColumn("Input 2 Label", disabled=True, width=200),
    "Input 2 Req":   st.column_config.TextColumn("Input 2 Req", disabled=True, width=90),
    "Input 2":       st.column_config.NumberColumn("Input 2", format="%.4g", width=90),
    "Input 3 Label": st.column_config.TextColumn("Input 3 Label", disabled=True, width=200),
    "Input 3 Req":   st.column_config.TextColumn("Input 3 Req", disabled=True, width=90),
    "Input 3":       st.column_config.NumberColumn("Input 3", format="%.4g", width=90),
    "Input 4 Label": st.column_config.TextColumn("Input 4 Label", disabled=True, width=200),
    "Input 4 Req":   st.column_config.TextColumn("Input 4 Req", disabled=True, width=90),
    "Input 4":       st.column_config.NumberColumn("Input 4", format="%.4g", width=90),
    "Input 5 Label": st.column_config.TextColumn("Input 5 Label", disabled=True, width=200),
    "Input 5 Req":   st.column_config.TextColumn("Input 5 Req", disabled=True, width=90),
    "Input 5":       st.column_config.NumberColumn("Input 5", format="%.4g", width=90),
}

edited = st.data_editor(
    editor_df,
    column_config=column_config,
    use_container_width=True,
    hide_index=True,
    key=f"editor_{SCENARIO_ID}",
    num_rows="fixed",
)

# ---------------------------------------------------------------------------
# Validation warnings
# ---------------------------------------------------------------------------

missing_required = []
for _, cl_row in case_listing.iterrows():
    case_id = int(cl_row["ID"])
    cs = state["cases"].get(case_id, {})
    if not cs.get("include", True):
        continue
    op = cs.get("operation", "No Change")
    spec = get_param_spec(ops_library, op)
    params = cs.get("params", [0.0]*5)
    for i, s in enumerate(spec):
        if s["required"] and (i >= len(params) or params[i] == 0.0):
            missing_required.append(
                f"{cl_row['Case Name']} — {op}: **{s['label']}** (Input {i+1}) is required"
            )

if missing_required:
    with st.expander(f"⚠️ {len(missing_required)} required input(s) not set", expanded=True):
        for msg in missing_required:
            st.write(f"• {msg}")

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

st.divider()

run_disabled = included == 0
if st.button("▶ Run Scenario", type="primary", disabled=run_disabled):
    with st.spinner("Running scenario engine…"):
        instructions = get_scenario_instructions(SCENARIO_ID, case_listing)
        results, errors = run_scenario(profiles, instructions)

    st.session_state["last_results"] = results
    st.session_state["last_errors"] = errors
    st.session_state["last_scenario_name"] = state["name"]

    c1, c2, c3 = st.columns(3)
    c1.metric("Cases included", included)
    c2.metric("Output rows", f"{len(results):,}")
    c3.metric("Errors", len(errors))

    if errors:
        st.warning(f"{len(errors)} case(s) encountered errors:")
        st.dataframe(pd.DataFrame(errors), use_container_width=True, hide_index=True)

    if len(results) > 0:
        st.success(f"✅ Scenario '{state['name']}' complete — {len(results):,} rows produced.")
        with st.expander("Preview output (first 50 rows)"):
            st.dataframe(results.head(50), use_container_width=True, hide_index=True)
        st.info("Go to the **Results** page to explore the full output.")

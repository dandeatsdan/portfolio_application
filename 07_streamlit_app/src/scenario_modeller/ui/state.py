"""
Scenario session-state helpers.

Manages the in-memory scenario configuration stored in st.session_state.
No Streamlit rendering logic lives here — only data structures and
transformations that could also be called from tests without Streamlit.
"""

import pandas as pd

# Maps user-facing operation labels to internal engine keys.
# Mirrors OPERATION_MAP in 003_scenario_instructions.py.
OPERATION_MAP: dict[str, str] = {
    "No Change": "NoChange",
    "Delay": "Delay",
    "Accelerate": "Accelerate",
    "Farm In (Increase)": "Increase",
    "Farm Down (Dilution)": "Dilution",
    "Truncate Before": "TruncateBefore",
    "Truncate After": "TruncateAfter",
    "Production Change %": "ProdnAdj",
    "OPEX Change %": "CostAdjOpex",
    "CAPEX Change %": "CostAdjCapex",
    "CAPEX Change $m": "CapexAbsolute",
    "OPEX Change $m": "OpexAbsolute",
}

OPERATION_LABELS = list(OPERATION_MAP.keys())


def _state_key(scenario_id: int) -> str:
    return f"scenario_{scenario_id}"


def init_scenario_state(scenario_id: int, case_listing: pd.DataFrame) -> None:
    """
    Initialise session state for a scenario if not already present.

    Idempotent — safe to call on every page load.
    Requires st.session_state to be available (i.e. called from a Streamlit page).
    """
    import streamlit as st

    key = _state_key(scenario_id)
    if key in st.session_state:
        return

    st.session_state[key] = {
        "name": f"Scenario {scenario_id}",
        "description": "",
        "cases": {
            int(row["ID"]): {
                "include": True,
                "operation": "No Change",
                "params": [0.0, 0.0, 0.0, 0.0, 0.0],
            }
            for _, row in case_listing.iterrows()
        },
    }


def get_scenario_state(scenario_id: int) -> dict:
    """Return the raw session state dict for a scenario."""
    import streamlit as st
    return st.session_state[_state_key(scenario_id)]


def apply_editor_changes(scenario_id: int, edited_df: pd.DataFrame) -> None:
    """
    Persist editable column changes from a st.data_editor result back to session state.

    Only reads back the columns the user can actually edit:
    Include, Operation, and Input 1–5.
    """
    import streamlit as st

    state = st.session_state[_state_key(scenario_id)]

    for _, row in edited_df.iterrows():
        case_id = int(row["ID"])
        if case_id not in state["cases"]:
            state["cases"][case_id] = {
                "include": True, "operation": "No Change", "params": [0.0] * 5,
            }
        cs = state["cases"][case_id]
        cs["include"] = bool(row.get("Include", True))
        cs["operation"] = str(row.get("Operation", "No Change"))
        cs["params"] = [
            float(row.get("Input 1", 0.0) or 0.0),
            float(row.get("Input 2", 0.0) or 0.0),
            float(row.get("Input 3", 0.0) or 0.0),
            float(row.get("Input 4", 0.0) or 0.0),
            float(row.get("Input 5", 0.0) or 0.0),
        ]


def get_scenario_instructions(
    scenario_id: int,
    case_listing: pd.DataFrame,
) -> pd.DataFrame:
    """
    Build the engine instruction DataFrame from session state.

    Returns columns: Scenario, ID, Case, Include, Operation, Param1–Param5.
    Operation is translated from user-facing label to internal engine key.
    """
    import streamlit as st

    state = st.session_state[_state_key(scenario_id)]
    rows = []

    for _, cl_row in case_listing.iterrows():
        case_id = int(cl_row["ID"])
        case_name = str(cl_row["Case"])
        case_state = state["cases"].get(case_id, {})

        include = bool(case_state.get("include", True))
        op_label = case_state.get("operation", "No Change")
        op_key = OPERATION_MAP.get(op_label, "NoChange")
        params = case_state.get("params", [0.0] * 5)

        rows.append({
            "Scenario": scenario_id,
            "ID": case_id,
            "Case": case_name,
            "Include": include,
            "Operation": op_key,
            "Param1": float(params[0]) if len(params) > 0 else 0.0,
            "Param2": float(params[1]) if len(params) > 1 else 0.0,
            "Param3": float(params[2]) if len(params) > 2 else 0.0,
            "Param4": float(params[3]) if len(params) > 3 else 0.0,
            "Param5": float(params[4]) if len(params) > 4 else 0.0,
        })

    return pd.DataFrame(rows)

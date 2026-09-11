# ========================================================================
# SCENARIO DISPATCHER — APPLY ONE INSTRUCTION TO EACH CASE PROFILE
# ========================================================================
#
# Purpose and position
# --------------------
# This is the loop between cleaned scenario instructions and the individual
# operation functions. The usual entry point for a complete calculation is
# services/scenario_service.execute_scenario, which calls this dispatcher
# and then handles post-tax calculations and success/failure checks.
#
# What run_scenario does
# ----------------------
# 1. Iterate over instruction rows; skip those marked Include=False.
# 2. Find the source rows belonging to the instruction's case ID.
# 3. Look up the internal operation key in operation_functions.
# 4. Pass that case's profile and Param1–Param5 to the operation function.
# 5. Keep output years within YEAR_MIN–YEAR_MAX.
# 6. Attach Scenario, operation, parameters and a shared run timestamp.
# 7. Concatenate the successful case outputs into one result DataFrame.
#
# Example
# -------
# An instruction with Operation=Delay and Param1=2 passes that case's
# annual data to apply_delay. Another case with NoChange gets a copy of
# its reference rows. Their outputs are combined; one case's transformed
# rows are not used as the next case's input.
#
# Understanding the output
# ------------------------
# The result has a fixed column order including ID, Case, Metric, Year,
# Value and instruction metadata. If nothing succeeds, the result is empty
# but still has the expected columns. Errors are returned separately.
# A missing case, unknown operation or failing operation adds an error;
# the loop continues, so a result may contain partial output AND errors.
# The coordinating service rejects such a run rather than treating those
# partial rows as a complete portfolio.
#
# Boundaries
# ----------
# This module does not save scenarios, calculate tax, discount cash flows
# or invert values for presentation. It also does not replace the API's
# parameter validation. It dispatches one operation per instruction;
# multiple rows are not an implicit sequential chain of case operations.
# Read operations.py for the transformations and scenario_service.py for
# how errors and financialisation are handled around this loop.

"""
Scenario engine orchestration.

run_scenario() mirrors the core loop from 005_model_engine.py: for each
included case in the instruction set, fetch the baseline profile, dispatch
to the appropriate operation function, clip to the planning horizon, and
collect results. Errors are captured per-case rather than crashing the run.
"""

import logging
from datetime import datetime

import pandas as pd

from scenario_modeller.data.schemas import YEAR_MIN, YEAR_MAX
from scenario_modeller.engine.operations import operation_functions

logger = logging.getLogger(__name__)

OUTPUT_COLUMNS = [
    "Scenario", "ID", "Case", "Operation",
    "Param1", "Param2", "Param3", "Param4", "Param5",
    "Metric", "Year", "Value", "RunDateTime",
]


def run_scenario(
    profiles: pd.DataFrame,
    instructions: pd.DataFrame,
) -> tuple[pd.DataFrame, list[dict]]:
    """
    Execute scenario instructions against baseline profiles.

    Parameters
    ----------
    profiles:
        Output of load_profiles(). Columns: ID, Case, Metric, Year, Value.
    instructions:
        DataFrame with columns: Scenario, ID, Case, Include (bool), Operation,
        Param1-5 (numeric). One row per case per scenario.

    Returns
    -------
    results : pd.DataFrame
        Tall output in OUTPUT_COLUMNS schema.
    errors : list[dict]
        Per-case error records (scenario, case_id, case, operation, message).
    """
    results = []
    errors = []
    run_dt = datetime.now().isoformat(timespec="seconds")

    for _, row in instructions.iterrows():
        if not row.get("Include", True):
            continue

        scenario = row["Scenario"]
        case_id = row["ID"]
        case_name = row.get("Case", "")
        operation = row.get("Operation", "NoChange")
        params = [
            row.get("Param1", 0.0),
            row.get("Param2", 0.0),
            row.get("Param3", 0.0),
            row.get("Param4", 0.0),
            row.get("Param5", 0.0),
        ]

        subset = profiles[profiles["ID"] == case_id].copy()
        if subset.empty:
            errors.append({
                "Scenario": scenario, "ID": case_id, "Case": case_name,
                "Operation": operation, "Message": "No profile rows found for case ID.",
            })
            logger.warning("Scenario %s / case %s (%s): no profile rows found.", scenario, case_id, case_name)
            continue

        fn = operation_functions.get(operation)
        if fn is None:
            errors.append({
                "Scenario": scenario, "ID": case_id, "Case": case_name,
                "Operation": operation, "Message": f"Unknown operation key: {operation}",
            })
            logger.error("Scenario %s / case %s: unknown operation '%s'.", scenario, case_id, operation)
            continue

        try:
            transformed = fn(subset, *params)
        except NotImplementedError:
            errors.append({
                "Scenario": scenario, "ID": case_id, "Case": case_name,
                "Operation": operation, "Message": f"Operation '{operation}' is not yet implemented.",
            })
            logger.warning("Scenario %s / case %s: operation '%s' not implemented.", scenario, case_id, operation)
            continue
        except Exception as exc:
            errors.append({
                "Scenario": scenario, "ID": case_id, "Case": case_name,
                "Operation": operation, "Message": str(exc),
            })
            logger.error("Scenario %s / case %s / op %s: %s", scenario, case_id, operation, exc)
            continue

        # Clip to planning horizon
        transformed = transformed[
            (transformed["Year"] >= YEAR_MIN) & (transformed["Year"] <= YEAR_MAX)
        ].copy()

        transformed["Scenario"] = scenario
        transformed["Operation"] = operation
        transformed["Param1"] = params[0]
        transformed["Param2"] = params[1]
        transformed["Param3"] = params[2]
        transformed["Param4"] = params[3]
        transformed["Param5"] = params[4]
        transformed["RunDateTime"] = run_dt

        results.append(transformed)

    if not results:
        return pd.DataFrame(columns=OUTPUT_COLUMNS), errors

    out = pd.concat(results, ignore_index=True)
    # Keep only output columns that exist; fill any missing with None
    for col in OUTPUT_COLUMNS:
        if col not in out.columns:
            out[col] = None
    return out[OUTPUT_COLUMNS], errors

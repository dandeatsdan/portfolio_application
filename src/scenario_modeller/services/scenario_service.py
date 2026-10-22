# ========================================================================
# SCENARIO SERVICE — TURN INSTRUCTIONS INTO A COMPLETE RESULT
# ========================================================================
#
# Purpose
# -------
# This is the coordinating service for running a scenario. It takes the
# user's case instructions, checks that they are usable, applies the chosen
# operations, and derives fresh post-tax results. It returns a ScenarioRun
# object so callers can distinguish success from a failed calculation.
#
# Where it fits
# -------------
# React request -> backend/routers/scenario.py -> execute_scenario here
#   -> engine/scenario_engine.py -> engine/operations.py
#   -> engine/financials.py -> results returned to the caller.
# The optimiser also uses this service to check its selected portfolio.
# There is no file saving or screen rendering in this module.
#
# Inputs and their meaning
# -----------------------
# - profiles: annual source data in a pandas DataFrame (a table in memory).
#   Each row describes one case, one metric and one year.
# - instructions: Scenario, ID, Case, Include, Operation and Param1–Param5.
#   ID is the reliable case identity; labels are restored from the listing.
# - case_listing: case identities and country mapping for financialisation.
# - tax_rates: country/year assumptions used after operations are applied.
#
# Processing order
# ----------------
# 1. Copy instructions and retain included rows. An empty included set is
#    rejected here; the optimiser handles its empty selection separately.
# 2. Reject missing/duplicate scenario-case identities and unknown cases.
# 3. Restore canonical Case labels, default blank operations to NoChange,
#    convert parameters to numbers and reject non-finite values.
# 4. Remove previously derived financial metrics from the source, then run
#    each instruction through the operation dispatcher.
# 5. Reject the whole run if dispatch reports errors or returns no rows.
# 6. Calculate post-tax metrics from the transformed source profiles.
#
# Example
# -------
# A case delayed two years first has its profile shifted. Tax is then
# calculated using the country/year assumptions for the resulting years.
# Simply moving an old post-tax result would bypass that recalculation.
# An excluded case contributes no rows to the resulting portfolio.
#
# Reading the return value
# ------------------------
# ScenarioRun.valid says whether the run can be used. results contains the
# annual output; instructions contains the cleaned included instructions;
# diagnostics explains errors or financial warnings. The API separately
# retains exclusion instructions for its response to the frontend.
# The dispatcher can return partial data with errors, but this service does
# not publish that partial data as a successful scenario.
#
# Boundaries to remember
# ----------------------
# The React API applies parameter-specific business rules before calling
# this service. This module's structural checks do not replace those rules.
# Values keep their analytical signs: display inversion happens later.
# ValueError and KeyError become invalid runs; unexpected exceptions can
# still reach the API's error handler.
#
# Suggested reading order
# -----------------------
# ScenarioRun -> execute_scenario -> scenario_engine.run_scenario
# -> the relevant operation -> financials.calculate_post_tax.

"""Complete scenario execution. Invalid candidates are never published."""

from dataclasses import dataclass
import numpy as np
import pandas as pd

from scenario_modeller.engine.financials import calculate_post_tax, source_profiles
from scenario_modeller.engine.scenario_engine import run_scenario


@dataclass
class ScenarioRun:
    valid: bool
    results: pd.DataFrame
    instructions: pd.DataFrame
    diagnostics: list[dict]


def execute_scenario(profiles: pd.DataFrame, instructions: pd.DataFrame,
                     case_listing: pd.DataFrame, tax_rates: pd.DataFrame) -> ScenarioRun:
    clean = instructions.copy()
    try:
        if clean.empty:
            raise ValueError("No included scenario instructions")
        clean = clean.loc[clean["Include"] == True].copy()
        if clean.empty:
            raise ValueError("No included scenario instructions")
        if clean[["Scenario", "ID"]].isna().any(axis=None) or clean.duplicated(["Scenario", "ID"]).any():
            raise ValueError("Missing or duplicate scenario/case identifiers")
        if not clean["ID"].isin(case_listing["ID"]).all():
            raise ValueError("Unknown case ID in instructions")
        # Case labels are authoritative metadata, not client-supplied identity.
        names = case_listing.set_index("ID")["Case"]
        clean["Case"] = clean["ID"].map(names)
        clean["Operation"] = clean["Operation"].fillna("NoChange").replace("", "NoChange")
        for p in [f"Param{i}" for i in range(1, 6)]:
            clean[p] = pd.to_numeric(clean[p], errors="coerce")
            clean.loc[clean["Operation"] == "NoChange", p] = 0.0
            if not np.isfinite(clean[p]).all():
                raise ValueError(f"{p} must be finite")
        candidate, errors = run_scenario(source_profiles(profiles), clean)
        if errors:
            return ScenarioRun(False, pd.DataFrame(), clean,
                               [{"severity": "error", **e} for e in errors])
        if candidate.empty:
            raise ValueError("No scenario output was generated")
        enriched, diagnostics = calculate_post_tax(candidate, case_listing, tax_rates)
        return ScenarioRun(True, enriched, clean, diagnostics)
    except (ValueError, KeyError) as exc:
        return ScenarioRun(False, pd.DataFrame(), clean,
                           [{"severity": "error", "message": str(exc)}])

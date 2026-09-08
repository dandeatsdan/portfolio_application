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

# ========================================================================
# FINANCIALISATION — DERIVE POST-TAX METRICS FROM SOURCE PROFILES
# ========================================================================
#
# Purpose
# -------
# Calculate tax and post-tax profit/cash flow after scenario operations
# have changed the source profiles. The same functions also prepare the
# reference baseline, keeping both sides of a comparison consistent.
#
# Inputs and identity
# -------------------
# profiles contains ID, Case, Metric, Year and Value, with optional Scenario.
# case_listing maps each ID to a Country Key. tax_rates supplies each
# country/year's ETR (effective tax rate) and CTR (cash tax rate).
# Rates are fractions: 0.30 means 30%. Cash values retain their source units.
#
# Calculation in plain language
# -----------------------------
# For each case/year's Underlying RCOP:
#   taxable amount = max(Underlying RCOP, 0)
#   tax charge = taxable amount * ETR
#   cash tax = taxable amount * CTR
#   Post-Tax RCOP = Underlying RCOP - tax charge
#   Post-Tax Cash Flow = Pre Tax Cash Flow - cash tax
# Tax Charge and Cash Tax Payment are also appended as negative outflows.
# For RCOP=100, pre-tax cash flow=80, ETR=30% and CTR=20%, the resulting
# post-tax RCOP is 70 and post-tax cash flow is 60.
# Negative RCOP produces zero tax here; this is not a loss-carry-forward
# model. The code applies the supplied country/year rates to each case.
#
# Why source_profiles comes first
# ------------------------------
# Previously derived tax/post-tax rows and the Excel discounted metric are
# removed before recalculation. Otherwise stale derived values could be
# mixed with new ones or transformed twice. calculate_post_tax returns
# source rows plus freshly derived metrics and a list of diagnostics.
#
# Validation and missing rows
# ---------------------------
# Required identities, integer years, finite values, horizon bounds and
# unique case/metric/year rows are checked. Country mappings and tax-rate
# joins must be unambiguous; missing required mappings/rates cause errors.
# When a pre-tax cash-flow row has no matching RCOP row, cash tax is treated
# as zero and a diagnostic records that specific convention. Sparse inputs
# are valid: derive each financial metric only where its source rows exist.
# No cash-flow rows are invented for cases or years without pre-tax cash flow.
#
# Keep financial signs separate from display signs
# ------------------------------------------------
# Expenses and outflows keep their analytical signs here. The metrics-helper
# CSV can reverse signs later for tables/charts, without changing these
# calculations. NPV is calculated separately in valuation_service.py from
# the resulting true signed Post-Tax Cash Flow.
#
# Read source_profiles first, then calculate_post_tax, paying particular
# attention to the join keys and the final derived-row construction.

"""Shared baseline/scenario post-tax stage, derived from Excel 005_model_engine.

Values retain analytical signs. Display inversion is a separate concern.
"""

import numpy as np
import pandas as pd

from scenario_modeller.data.loaders import validate_tax_rates
from scenario_modeller.data.schemas import YEAR_MIN, YEAR_MAX

URCOP = "Underlying RCOP"
PRE_TAX_FCF = "Pre Tax Cash Flow"
POST_TAX_FCF = "Post-Tax Cash Flow"
POST_TAX_RCOP = "Post-Tax RCOP"
DERIVED_METRICS = ("Tax Charge", "Cash Tax Payment", POST_TAX_RCOP, POST_TAX_FCF)
EXCEL_DISCOUNTED_METRIC = "Discounted Post-Tax Cash Flow @ 8%"


def source_profiles(profiles: pd.DataFrame) -> pd.DataFrame:
    """Remove only owned derived metrics before transformation/recalculation."""
    return profiles.loc[
        ~profiles["Metric"].isin([*DERIVED_METRICS, EXCEL_DISCOUNTED_METRIC])
    ].copy()


def calculate_post_tax(
    profiles: pd.DataFrame, case_listing: pd.DataFrame, tax_rates: pd.DataFrame,
) -> tuple[pd.DataFrame, list[dict]]:
    """Enrich ID×Metric×Year (optionally Scenario) profiles; report zero-tax fallbacks.

    Calculation is per case/year, never on aggregated portfolio RCOP. Repeating
    the call replaces derived rows. All joins validate their cardinality.
    """
    required = {"ID", "Case", "Metric", "Year", "Value"}
    if not required.issubset(profiles.columns):
        raise ValueError(f"financials: missing columns {sorted(required - set(profiles.columns))}")
    data = source_profiles(profiles)
    if data.empty:
        raise ValueError("financials: no source profiles")
    keys = (["Scenario"] if "Scenario" in data else []) + ["ID", "Year"]
    if data[[*keys, "Case", "Metric"]].isna().any(axis=None):
        raise ValueError("financials: missing profile identifiers")
    for col in ["ID", "Year", "Value"]:
        data[col] = pd.to_numeric(data[col], errors="coerce")
        if not np.isfinite(data[col]).all():
            raise ValueError(f"financials: {col} must contain finite numbers")
    if (data["ID"] % 1 != 0).any() or (data["Year"] % 1 != 0).any():
        raise ValueError("financials: ID and Year must be whole numbers")
    data["ID"] = data["ID"].astype(int)
    data["Year"] = data["Year"].astype(int)
    if not data["Year"].between(YEAR_MIN, YEAR_MAX).all():
        raise ValueError("financials: profile year outside modelling horizon")
    if data.duplicated([*keys, "Metric"]).any():
        raise ValueError("financials: duplicate profile keys")

    mapping = case_listing[["ID", "Country Key"]].copy()
    mapping["Country Key"] = mapping["Country Key"].astype("string").str.strip().replace("", pd.NA)
    if mapping["ID"].isna().any() or mapping["ID"].duplicated().any():
        raise ValueError("financials: missing or duplicate case IDs")
    # Use the case-listing mapping, not a stale Country Key on a prior result.
    data = data.drop(columns="Country Key", errors="ignore").merge(
        mapping, on="ID", how="left", validate="many_to_one",
    )
    if data["Country Key"].isna().any():
        raise ValueError("financials: missing case-to-country mapping")
    rates = validate_tax_rates(tax_rates)
    urcop = data.loc[data["Metric"] == URCOP].copy()
    fcf = data.loc[data["Metric"] == PRE_TAX_FCF].copy()
    urcop = urcop.merge(
        rates[["Country Key", "Year", "ETR", "CTR"]],
        on=["Country Key", "Year"], how="left", validate="many_to_one",
    )
    missing = urcop.loc[urcop[["ETR", "CTR"]].isna().any(axis=1), ["Country Key", "Year"]]
    if not missing.empty:
        raise ValueError(f"financials: missing tax rates for {missing.drop_duplicates().to_dict('records')}")
    taxable = urcop["Value"].clip(lower=0)
    urcop["_charge"] = taxable * urcop["ETR"]
    urcop["_cash_tax"] = taxable * urcop["CTR"]
    fcf = fcf.merge(urcop[[*keys, "_cash_tax"]], on=keys, how="left", validate="one_to_one")
    diagnostics = [
        {"severity": "warning", "code": "UNMATCHED_CASH_TAX", **row,
         "message": "No matching RCOP row; cash tax treated as zero (Excel convention)."}
        for row in fcf.loc[fcf["_cash_tax"].isna(), keys].to_dict("records")
    ]
    fcf["_cash_tax"] = fcf["_cash_tax"].fillna(0)
    derived = []
    for frame, metric, values in [
        (urcop, "Tax Charge", -urcop["_charge"]),
        (urcop, "Cash Tax Payment", -urcop["_cash_tax"]),
        (urcop, POST_TAX_RCOP, urcop["Value"] - urcop["_charge"]),
        (fcf, POST_TAX_FCF, fcf["Value"] - fcf["_cash_tax"]),
    ]:
        out = frame[data.columns].copy()
        out["Metric"], out["Value"] = metric, values
        derived.append(out)
    result = pd.concat([data, *derived], ignore_index=True)
    if result.duplicated([*keys, "Metric"]).any() or not np.isfinite(result["Value"]).all():
        raise ValueError("financials: invalid calculated output")
    return result, diagnostics

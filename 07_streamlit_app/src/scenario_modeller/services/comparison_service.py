# ========================================================================
# COMPARISON SERVICE — EXPLAIN THE DIFFERENCE BETWEEN TWO RESULTS
# ========================================================================
#
# Purpose
# -------
# Compare already-calculated reference and scenario tables. These helpers
# measure changes; they do not apply operations or run financialisation.
# A DataFrame is a table in memory, and its columns are the matching keys
# and measures used by the joins and aggregations below.
#
# Three useful entry points
# -------------------------
# compute_variance:
#   Match rows by ID, Case, Metric and Year unless other keys are supplied.
#   An outer join keeps rows present on either side. Missing values become
#   zero, so excluded cases and newly created rows still contribute.
#   Return Baseline, Scenario, Delta and Delta_pct for each matched row.
#
# scenario_kpi_delta:
#   Restrict to the cases in case_listing and an optional year selection,
#   then sum each requested metric for the reference and scenario.
#   Return the total values and their absolute/percentage differences.
#
# build_waterfall:
#   Select a metric and optional years, attach a requested case-listing
#   dimension by ID, and calculate each group's change. Return a reference
#   total, relative change bars, and a final scenario total.
#
# A small example
# ---------------
# Reference values of 100 and 50 become 120 and 0 after a change and an
# exclusion. The changes are +20 and -50. The waterfall bridges the
# reference total of 150 to the scenario total of 120.
# A relative bar is a change from the running total; an absolute bar is
# an endpoint. The chart renderer positions the bars from these records.
#
# Details that affect interpretation
# ---------------------------------
# Delta always means Scenario minus Baseline. The older percentage helpers
# here divide by the signed baseline and return zero near a zero baseline.
# The newer results_analysis API uses its own percentage convention, with
# an absolute baseline denominator and no percentage for a zero baseline.
# Do not assume the two percentage presentations are interchangeable.
#
# Waterfall grouping supports the dimensions in BREAKDOWN_COLUMNS. Missing
# labels become Unassigned. Duplicate case-name labels are distinguished
# by ID. Nonzero changes are sorted descending, with no Top N truncation.
# For build_waterfall, an explicit empty year selection selects no years;
# the older KPI helper treats an empty year list as no year restriction.
#
# Signs and related files
# -----------------------
# These functions compare the values supplied by the caller. They do not
# invert costs themselves. Reporting callers may first use to_display;
# analytical callers may supply raw signed values.
# Read backend/routers/results_analysis.py for the React results workflow
# and backend/utils/display.py for presentation-only sign changes.

"""
Scenario comparison services.

Functions that compute baseline-vs-scenario variances, summary deltas,
and waterfall chart data. No Streamlit dependencies.
"""

from __future__ import annotations

import pandas as pd


def compute_variance(
    baseline: pd.DataFrame,
    scenario: pd.DataFrame,
    join_on: list[str] | None = None,
) -> pd.DataFrame:
    """
    Compute absolute and percentage delta between baseline and scenario.

    Both DataFrames must have columns [ID, Case, Metric, Year, Value].
    Returns columns [ID, Case, Metric, Year, Baseline, Scenario, Delta, Delta_pct].
    """
    if join_on is None:
        join_on = ["ID", "Case", "Metric", "Year"]

    b = baseline[join_on + ["Value"]].rename(columns={"Value": "Baseline"})
    s = scenario[join_on + ["Value"]].rename(columns={"Value": "Scenario"})

    merged = b.merge(s, on=join_on, how="outer").fillna(0.0)
    merged["Delta"] = merged["Scenario"] - merged["Baseline"]
    merged["Delta_pct"] = merged.apply(
        lambda r: (r["Delta"] / r["Baseline"] * 100.0) if abs(r["Baseline"]) > 1e-9 else 0.0,
        axis=1,
    )
    return merged.sort_values(join_on).reset_index(drop=True)


def scenario_kpi_delta(
    baseline: pd.DataFrame,
    scenario: pd.DataFrame,
    case_listing: pd.DataFrame,
    metrics: list[str],
    years: list[int] | None = None,
) -> dict[str, dict]:
    """
    Return headline KPI comparison dict for each metric.

    Returns {metric: {"baseline": float, "scenario": float, "delta": float, "delta_pct": float}}.
    """
    ids = set(case_listing["ID"].tolist())
    result: dict[str, dict] = {}

    for m in metrics:
        b = baseline[(baseline["Metric"] == m) & (baseline["ID"].isin(ids))]
        s = scenario[(scenario["Metric"] == m) & (scenario["ID"].isin(ids))]
        if years:
            b = b[b["Year"].isin(years)]
            s = s[s["Year"].isin(years)]
        bv = float(b["Value"].sum())
        sv = float(s["Value"].sum())
        dv = sv - bv
        dp = (dv / bv * 100.0) if abs(bv) > 1e-9 else 0.0
        result[m] = {"baseline": bv, "scenario": sv, "delta": dv, "delta_pct": dp}

    return result


BREAKDOWN_COLUMNS = {
    "plan_type": "Plan Type", "group_entity": "Group Entity", "region": "Region",
    "country": "Country", "case_name": "Case Name",
}


def build_waterfall(baseline, scenario, case_listing, metric, years=None, group_by="case_name"):
    """Analytical signs; group by stable IDs for Case, never by ambiguous labels."""
    if group_by not in BREAKDOWN_COLUMNS:
        raise ValueError("Unsupported waterfall breakdown")
    column = BREAKDOWN_COLUMNS[group_by]
    listing = case_listing[["ID", column]].copy()
    listing[column] = listing[column].fillna("Unassigned")
    if group_by == "case_name":
        duplicate = listing[column].duplicated(keep=False)
        listing.loc[duplicate, column] += " (" + listing.loc[duplicate, "ID"].astype(str) + ")"
    def aggregate(frame):
        rows = frame.loc[frame.Metric == metric]
        if years is not None:
            rows = rows.loc[rows.Year.isin(years)]
        rows = rows.merge(listing, on="ID", how="inner", validate="many_to_one")
        return rows.groupby(column, dropna=False).Value.sum()
    b, s = aggregate(baseline), aggregate(scenario)
    deltas = s.subtract(b, fill_value=0).sort_values(ascending=False)
    rows = [{"Label": "Reference", "Value": float(b.sum()), "Type": "absolute"}]
    rows += [{"Label": str(label), "Value": float(value), "Type": "relative"}
             for label, value in deltas.items() if value != 0]
    rows.append({"Label": "Scenario", "Value": float(s.sum()), "Type": "absolute"})
    return pd.DataFrame(rows)

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

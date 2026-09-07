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


def build_waterfall(
    baseline: pd.DataFrame,
    scenario: pd.DataFrame,
    case_listing: pd.DataFrame,
    metric: str,
    years: list[int] | None = None,
) -> pd.DataFrame:
    """
    Build waterfall chart data for a single metric.

    Returns a DataFrame with columns [Label, Value, Type].
    Type is one of: "absolute" (reference/scenario totals), "relative" (per-case delta).

    The ordering is:
      Reference total → sorted case deltas (largest pos first, then neg) → Scenario total
    """
    ids = set(case_listing["ID"].tolist())

    b = baseline[(baseline["Metric"] == metric) & (baseline["ID"].isin(ids))].copy()
    s = scenario[(scenario["Metric"] == metric) & (scenario["ID"].isin(ids))].copy()

    if years:
        b = b[b["Year"].isin(years)]
        s = s[s["Year"].isin(years)]

    b = b.merge(case_listing[["ID", "Case Name"]], on="ID", how="left")
    s = s.merge(case_listing[["ID", "Case Name"]], on="ID", how="left")

    b_total = float(b["Value"].sum())
    s_total = float(s["Value"].sum())

    # Per-case delta
    b_case = b.groupby("Case Name")["Value"].sum().rename("Baseline")
    s_case = s.groupby("Case Name")["Value"].sum().rename("Scenario")
    case_delta = (
        pd.concat([b_case, s_case], axis=1)
        .fillna(0.0)
        .assign(Delta=lambda d: d["Scenario"] - d["Baseline"])
        .reset_index()
        .sort_values("Delta", ascending=False)
    )

    rows = [{"Label": "Reference", "Value": b_total, "Type": "absolute"}]
    for _, r in case_delta.iterrows():
        if abs(r["Delta"]) > 1e-9:
            rows.append({"Label": r["Case Name"], "Value": r["Delta"], "Type": "relative"})
    rows.append({"Label": "Scenario", "Value": s_total, "Type": "absolute"})

    return pd.DataFrame(rows)

# ========================================================================
# PORTFOLIO SERVICE — SUMMARISE THE REFERENCE DATA
# ========================================================================
#
# Purpose
# -------
# Provide reusable table operations for portfolio totals, annual profiles
# and rankings. These functions aggregate existing values; they do not
# choose projects, apply scenario operations or calculate an NPV.
#
# Data layout
# -----------
# profiles is a tall table: ID, Case, Metric, Year, Value. A case therefore
# has many rows. case_listing supplies the case scope and display labels.
# totals_avgs is a separate wide reference table with year columns and
# precomputed Total 5Y / Average 5Y columns.
#
# Which function to read
# ----------------------
# - add_derived_totals: rebuild the derived post-tax metrics in the wide
#   table from calculated profiles for the fixed 2026–2030 window.
#   Missing years are zero; Average 5Y is always Total 5Y divided by five.
#   Other reference metrics in the supplied totals table are retained.
# - aggregate_by_year: restrict to the supplied case listing and metric,
#   then sum all contributing cases for each year.
# - stacked_by_case: return Year / Case Name / Value rows suitable for a
#   chart. The output remains tall; it is not a pivoted spreadsheet.
# - rank_contributors: total a metric over the requested years, group by
#   Case Name and sort from largest to smallest.
# - creaming_curve: take that ranking and add a running cumulative total.
# - portfolio_kpis: read and sum a chosen aggregation column from the wide
#   totals table, scoped by the case listing's Case labels.
#
# Example of aggregation
# ----------------------
# If two cases have metric values 10 and 20 in 2027, aggregate_by_year
# returns 30 for 2027. A stacked view retains the two case contributions.
# These sums preserve the units and signs of the supplied values.
#
# Distinctions worth understanding
# -------------------------------
# The simple creaming_curve helper here accumulates ONE ranked metric.
# The React portfolio endpoint builds a different curve: cumulative NPV
# against cumulative Capex, ordered by NPV/Capex. Read
# backend/routers/portfolio.py for that implementation.
#
# portfolio_kpis reads totals_avgs, not its currently unused profiles
# argument. Its default five-year total is not a dynamic 2026–2040 total.
# The React portfolio KPI endpoint computes its selected-window totals
# separately from profiles.
#
# rank_contributors groups by display Case Name, so equal names combine.
# An empty selected_ids list in stacked_by_case, or an empty years list in
# rank_contributors, acts as no restriction. Callers needing an explicitly
# empty result must handle that distinction.
#
# This module does not apply the metrics-helper Invert flag. Presentation
# callers must supply appropriately formatted values or format afterwards.
# For fresh post-tax metrics, start with engine/financials.py; for NPV,
# use valuation_service.py rather than summing an NPV source column.

"""
Portfolio aggregation services.

Functions that aggregate the baseline profiles dataset for Portfolio Viewer charts,
KPI tiles, and ranked contributor views. No Streamlit dependencies.
"""

from __future__ import annotations

import pandas as pd

from scenario_modeller.engine.financials import DERIVED_METRICS


def add_derived_totals(totals_avgs: pd.DataFrame, profiles: pd.DataFrame) -> pd.DataFrame:
    """Replace only derived-metric reference rows; preserve original CSV values.

    Total/Average 5Y use 2026–2030, including zero contribution in absent years.
    """
    derived = profiles.loc[profiles["Metric"].isin(DERIVED_METRICS)
                           & profiles["Year"].between(2026, 2030)]
    wide = derived.pivot_table(index=["Metric", "Case"], columns="Year",
                               values="Value", aggfunc="sum", fill_value=0)
    wide = wide.reindex(columns=range(2026, 2031), fill_value=0)
    wide.columns = wide.columns.astype(str)
    wide["Total 5Y"] = wide.sum(axis=1)
    wide["Average 5Y"] = wide["Total 5Y"] / 5
    return pd.concat([totals_avgs.loc[~totals_avgs["Metric"].isin(DERIVED_METRICS)],
                      wide.reset_index()], ignore_index=True)


def aggregate_by_year(
    profiles: pd.DataFrame,
    case_listing: pd.DataFrame,
    metric: str,
) -> pd.DataFrame:
    """
    Sum a metric across all cases by year.

    Returns a DataFrame with columns [Year, Value].
    """
    df = profiles[profiles["Metric"] == metric].copy()
    df = df.merge(case_listing[["ID"]], on="ID", how="inner")
    return df.groupby("Year", as_index=False)["Value"].sum().sort_values("Year")


def stacked_by_case(
    profiles: pd.DataFrame,
    case_listing: pd.DataFrame,
    metric: str,
    selected_ids: list[int] | None = None,
) -> pd.DataFrame:
    """
    Return a tall DataFrame of metric values per case per year.

    Merges in Case Name for display. Optionally filters to selected_ids.
    Returns columns [Year, Case Name, Value].
    """
    df = profiles[profiles["Metric"] == metric].copy()
    df = df.merge(case_listing[["ID", "Case Name"]], on="ID", how="inner")
    if selected_ids:
        df = df[df["ID"].isin(selected_ids)]
    return df[["Year", "Case Name", "Value"]].sort_values(["Case Name", "Year"])


def rank_contributors(
    profiles: pd.DataFrame,
    case_listing: pd.DataFrame,
    metric: str,
    years: list[int] | None = None,
) -> pd.DataFrame:
    """
    Rank cases by total contribution to a metric over a year range.

    Returns a DataFrame with columns [Case Name, Total] sorted descending.
    """
    df = profiles[profiles["Metric"] == metric].copy()
    if years:
        df = df[df["Year"].isin(years)]
    df = df.merge(case_listing[["ID", "Case Name"]], on="ID", how="inner")
    ranked = (
        df.groupby("Case Name", as_index=False)["Value"]
        .sum()
        .rename(columns={"Value": "Total"})
        .sort_values("Total", ascending=False)
        .reset_index(drop=True)
    )
    return ranked


def creaming_curve(
    profiles: pd.DataFrame,
    case_listing: pd.DataFrame,
    metric: str,
    years: list[int] | None = None,
) -> pd.DataFrame:
    """
    Compute cumulative creaming curve for a metric.

    Cases are sorted by individual total descending, then cumulative sum is computed.
    Returns columns [Case Name, Total, Cumulative].
    """
    ranked = rank_contributors(profiles, case_listing, metric, years)
    ranked["Cumulative"] = ranked["Total"].cumsum()
    return ranked


def portfolio_kpis(
    profiles: pd.DataFrame,
    case_listing: pd.DataFrame,
    totals_avgs: pd.DataFrame,
    metrics: list[str],
    agg: str = "Total 5Y",
) -> dict[str, float]:
    """
    Return a dict of {metric: portfolio_total} for the given aggregation.

    Uses totals_avgs for speed (pre-computed sums).
    """
    ids = set(case_listing["ID"].tolist())
    cases = set(case_listing["Case"].tolist())
    result: dict[str, float] = {}
    for m in metrics:
        rows = totals_avgs[
            (totals_avgs["Metric"] == m) & (totals_avgs["Case"].isin(cases))
        ]
        if agg in rows.columns:
            result[m] = float(rows[agg].sum())
        else:
            result[m] = 0.0
    return result

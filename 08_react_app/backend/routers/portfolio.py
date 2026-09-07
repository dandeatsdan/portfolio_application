"""
Portfolio endpoints — KPIs, stacked chart data, rankings, creaming curve.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, HTTPException
from ..state import app_state
from ..utils.display import to_display
from scenario_modeller.services.portfolio_service import (
    portfolio_kpis,
    stacked_by_case,
    rank_contributors,
)
from scenario_modeller.services.valuation_service import npv_by_case, NPV_METRIC

router = APIRouter(prefix="/api/portfolio")

CASE_COLS = ["ID", "Case Name", "Group Entity", "Segment", "Region", "Country", "Plan Type"]

FCF_METRIC   = "Post-Tax Cash Flow"
CAPEX_METRIC = "Cash Capex"


def _filter_cases(
    case_listing: pd.DataFrame,
    plan_types:     str = "",
    group_entities: str = "",
    segments:       str = "",
    regions:        str = "",
    countries:      str = "",
    case_names:     str = "",
) -> pd.DataFrame:
    """Apply dimension filters to case_listing, return filtered copy."""
    df = case_listing.copy()
    if plan_types:
        vals = [v.strip() for v in plan_types.split(",") if v.strip()]
        df = df[df["Plan Type"].isin(vals)]
    if group_entities:
        vals = [v.strip() for v in group_entities.split(",") if v.strip()]
        df = df[df["Group Entity"].isin(vals)]
    if segments:
        vals = [v.strip() for v in segments.split(",") if v.strip()]
        df = df[df["Segment"].isin(vals)]
    if regions:
        vals = [v.strip() for v in regions.split(",") if v.strip()]
        df = df[df["Region"].isin(vals)]
    if countries:
        vals = [v.strip() for v in countries.split(",") if v.strip()]
        df = df[df["Country"].isin(vals)]
    if case_names:
        vals = [v.strip() for v in case_names.split(",") if v.strip()]
        df = df[df["Case Name"].isin(vals)]
    return df


def _filter_profiles(
    profiles: pd.DataFrame,
    case_listing: pd.DataFrame,
    year_from: int = 2026,
    year_to: int = 2040,
) -> pd.DataFrame:
    """Filter profiles to the given case IDs and year range."""
    if not 2026 <= year_from <= year_to <= 2040:
        raise HTTPException(status_code=422, detail="Invalid year range")
    ids = set(case_listing["ID"].tolist())
    df = profiles[profiles["ID"].isin(ids)].copy()
    df = df[(df["Year"] >= year_from) & (df["Year"] <= year_to)]
    return df


def _safe_records(df: pd.DataFrame) -> list:
    return df.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict(orient="records")


@router.get("/kpis")
def get_kpis(
    metrics:       str = Query(default="Total Production (mboed),Cash Capex,Post-Tax RCOP,Post-Tax Cash Flow"),
    year_from:     int = Query(default=2026),
    year_to:       int = Query(default=2040),
    plan_types:    str = Query(default=""),
    group_entities:str = Query(default=""),
    segments:      str = Query(default=""),
    regions:       str = Query(default=""),
    countries:     str = Query(default=""),
    case_names:    str = Query(default=""),
):
    metric_list = [m.strip() for m in metrics.split(",") if m.strip()]
    cases = _filter_cases(app_state.case_listing, plan_types, group_entities, segments, regions, countries, case_names)
    profs = to_display(_filter_profiles(app_state.profiles, cases, year_from, year_to), app_state.invert_metrics)

    result = []
    for m in metric_list:
        total = profs[profs["Metric"] == m]["Value"].sum()
        annual_avg = total / max((year_to - year_from + 1), 1)
        result.append({"metric": m, "total": float(total), "annual_avg": float(annual_avg)})
    return result


@router.get("/stacked/{metric}")
def get_stacked(
    metric:        str,
    group_by:      str = Query(default=""),
    year_from:     int = Query(default=2026),
    year_to:       int = Query(default=2040),
    plan_types:    str = Query(default=""),
    group_entities:str = Query(default=""),
    segments:      str = Query(default=""),
    regions:       str = Query(default=""),
    countries:     str = Query(default=""),
    case_names:    str = Query(default=""),
):
    cases = _filter_cases(app_state.case_listing, plan_types, group_entities, segments, regions, countries, case_names)
    profs = to_display(_filter_profiles(app_state.profiles, cases, year_from, year_to), app_state.invert_metrics)
    df = profs[profs["Metric"] == metric].copy()

    COL_MAP = {
        "plan_type":    "Plan Type",
        "region":       "Region",
        "segment":      "Segment",
        "country":      "Country",
        "group_entity": "Group Entity",
        "case_name":    "Case Name",
    }

    if group_by and group_by in COL_MAP:
        dim_col = COL_MAP[group_by]
        df = df.merge(cases[["ID", dim_col]], on="ID", how="inner")
        result = (
            df.groupby(["Year", dim_col], as_index=False)["Value"]
            .sum()
            .rename(columns={dim_col: "Series"})
        )
    else:
        result = (
            df.groupby("Year", as_index=False)["Value"]
            .sum()
            .assign(Series="Total")
        )

    return _safe_records(result.sort_values("Year"))


@router.get("/ranked/{metric}")
def get_ranked(
    metric:        str,
    discount_rate: float = Query(default=8.0, gt=-100, allow_inf_nan=False),
    rank_by:       str = Query(default="case_name"),
    top_n:         int = Query(default=20),
    year_from:     int = Query(default=2026),
    year_to:       int = Query(default=2040),
    plan_types:    str = Query(default=""),
    group_entities:str = Query(default=""),
    segments:      str = Query(default=""),
    regions:       str = Query(default=""),
    countries:     str = Query(default=""),
    case_names:    str = Query(default=""),
):
    cases = _filter_cases(app_state.case_listing, plan_types, group_entities, segments, regions, countries, case_names)
    profs = _filter_profiles(app_state.profiles, cases, year_from, year_to)
    if metric == NPV_METRIC:
        df = npv_by_case(profs, discount_rate, year_from, year_to).rename(columns={"NPV": "Value"})
    else:
        df = to_display(profs[profs["Metric"] == metric].copy(), app_state.invert_metrics)

    COL_MAP = {
        "plan_type":    "Plan Type",
        "region":       "Region",
        "segment":      "Segment",
        "country":      "Country",
        "group_entity": "Group Entity",
        "case_name":    "Case Name",
    }
    dim_col = COL_MAP.get(rank_by, "Case Name")
    df = df.merge(cases[["ID", dim_col]].drop_duplicates(), on="ID", how="inner")
    ranked = (
        df.groupby(dim_col, as_index=False)["Value"]
        .sum()
        .rename(columns={dim_col: "Label", "Value": "Total"})
        .sort_values("Total", ascending=False)
    )
    if top_n < 9999:
        ranked = ranked.head(top_n)
    grand_total = ranked["Total"].sum()
    ranked["Pct"] = (ranked["Total"] / grand_total * 100).round(1) if grand_total else 0
    return _safe_records(ranked.reset_index(drop=True))


@router.get("/creaming")
def get_creaming(
    discount_rate: float = Query(default=8.0, gt=-100, allow_inf_nan=False),
    group_by:      str   = Query(default="case_name"),
    year_from:     int   = Query(default=2026),
    year_to:       int   = Query(default=2040),
    plan_types:    str   = Query(default=""),
    group_entities:str   = Query(default=""),
    segments:      str   = Query(default=""),
    regions:       str   = Query(default=""),
    countries:     str   = Query(default=""),
    case_names:    str   = Query(default=""),
):
    """
    Creaming curve: each point is one aggregated unit (case, region, country, or group entity).
    x = cumulative capex, y = cumulative NPV.
    NPV uses post-tax cash flow and fixed 2026 period-1 discounting.
    Units sorted by NPV/Capex descending (most efficient first).
    """
    COL_MAP = {
        "case_name":    "Case Name",
        "region":       "Region",
        "country":      "Country",
        "group_entity": "Group Entity",
        "plan_type":    "Plan Type",
    }
    dim_col = COL_MAP.get(group_by, "Case Name")

    cases = _filter_cases(app_state.case_listing, plan_types, group_entities, segments, regions, countries, case_names)
    profs = _filter_profiles(app_state.profiles, cases, year_from, year_to)
    npv_per_case = npv_by_case(profs, discount_rate, year_from, year_to)
    if npv_per_case.empty:
        return []

    # Capex per case — invert sign for display if Cash Capex is in the invert list
    capex_df = profs[profs["Metric"] == CAPEX_METRIC].copy()
    if CAPEX_METRIC in app_state.invert_metrics:
        capex_df["Value"] = capex_df["Value"] * -1
    capex_per_case = capex_df.groupby("ID")["Value"].sum().reset_index().rename(columns={"Value": "Capex"})

    # Merge dimension label from case_listing
    per_case = (
        npv_per_case
        # Keep every valued case, including cases without capex rows in the
        # selected window. Their NPV must not vanish from the cumulative total.
        .merge(capex_per_case, on="ID", how="left")
        .merge(cases[["ID", dim_col]], on="ID", how="inner")
    )

    # Aggregate to dimension level
    agg = (
        per_case.groupby(dim_col, as_index=False)[["NPV", "Capex"]]
        .sum()
        .rename(columns={dim_col: "Label"})
        .assign(PI=lambda d: d["NPV"] / d["Capex"].replace(0, np.nan))
        .sort_values("PI", ascending=False)
        .reset_index(drop=True)
    )
    agg["Cum Capex"] = agg["Capex"].cumsum()
    agg["Cum NPV"]   = agg["NPV"].cumsum()

    return _safe_records(agg[["Label", "NPV", "Capex", "Cum Capex", "Cum NPV", "PI"]])


@router.get("/entity_summary")
def get_entity_summary(
    year_from:     int = Query(default=2026),
    year_to:       int = Query(default=2040),
    plan_types:    str = Query(default=""),
    group_entities:str = Query(default=""),
    segments:      str = Query(default=""),
    regions:       str = Query(default=""),
    countries:     str = Query(default=""),
    case_names:    str = Query(default=""),
    discount_rate: float = Query(default=8.0, gt=-100, allow_inf_nan=False),
):
    """
    Per-case summary: Case Name, Plan Type, Region, Country,
    Cumulative Production, Cumulative Capex, Cumulative FCF, NPV.
    """
    cases = _filter_cases(app_state.case_listing, plan_types, group_entities, segments, regions, countries, case_names)
    profs = _filter_profiles(app_state.profiles, cases, year_from, year_to)

    def get_metric_totals(metric):
        df = profs[profs["Metric"] == metric].groupby("ID")["Value"].sum().reset_index()
        df.columns = ["ID", metric]
        return df

    PROD_METRIC = "Total Production (mboed)"
    production = get_metric_totals(PROD_METRIC)
    # Convert mboed-years to mmboe: multiply by 0.36525
    if PROD_METRIC in production.columns:
        production[PROD_METRIC] = production[PROD_METRIC] * 0.36525
    capex      = get_metric_totals(CAPEX_METRIC)
    fcf        = get_metric_totals(FCF_METRIC)

    npv_df = npv_by_case(profs, discount_rate, year_from, year_to)

    summary = cases[["ID", "Case Name", "Plan Type", "Group Entity", "Segment", "Region", "Country"]].copy()
    for df in [production, capex, fcf, npv_df]:
        summary = summary.merge(df, on="ID", how="left")

    summary = summary.rename(columns={
        PROD_METRIC:  "Production",
        CAPEX_METRIC: "Capex",
        FCF_METRIC:   "FCF",
    })
    return _safe_records(summary.sort_values("Case Name"))

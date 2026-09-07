"""
Data endpoints — case listing, operations library, totals & averages.
"""

from fastapi import APIRouter, HTTPException, Query
from ..state import app_state

router = APIRouter(prefix="/api")


@router.get("/cases")
def get_cases():
    cl = app_state.case_listing
    records = []
    for _, row in cl.iterrows():
        records.append({
            "id":           int(row["ID"]),
            "case":         str(row["Case"]),
            "case_name":    str(row["Case Name"]),
            "group_entity": str(row.get("Group Entity", "")),
            "segment":      str(row["Segment"]),
            "region":       str(row["Region"]),
            "country":      str(row["Country"]),
            "plan_type":    str(row["Plan Type"]),
        })
    return records


@router.get("/operations")
def get_operations():
    ops = app_state.ops_library
    records = []
    for _, row in ops.iterrows():
        records.append({
            "operation":       str(row.get("Operation", "")),
            "category":        str(row.get("Category", "")),
            "description":     str(row.get("Description", "")),
            "input_1_label":   _or_none(row.get("Input 1 Label")),
            "input_1_required":_or_none(row.get("Input 1 Required")),
            "input_2_label":   _or_none(row.get("Input 2 Label")),
            "input_2_required":_or_none(row.get("Input 2 Required")),
            "input_3_label":   _or_none(row.get("Input 3 Label")),
            "input_3_required":_or_none(row.get("Input 3 Required")),
            "input_4_label":   _or_none(row.get("Input 4 Label")),
            "input_4_required":_or_none(row.get("Input 4 Required")),
            "input_5_label":   _or_none(row.get("Input 5 Label")),
            "input_5_required":_or_none(row.get("Input 5 Required")),
        })
    return records


@router.get("/totals")
def get_totals():
    ta = app_state.totals_avgs
    cols = ["Metric", "Case", "Total 5Y", "Average 5Y", "2026", "2027", "2028", "2029", "2030"]
    records = []
    for _, row in ta.iterrows():
        records.append({
            "metric":     str(row.get("Metric", "")),
            "case":       str(row.get("Case", "")),
            "total_5y":   _float_or_none(row.get("Total 5Y")),
            "average_5y": _float_or_none(row.get("Average 5Y")),
            "y2026":      _float_or_none(row.get("2026")),
            "y2027":      _float_or_none(row.get("2027")),
            "y2028":      _float_or_none(row.get("2028")),
            "y2029":      _float_or_none(row.get("2029")),
            "y2030":      _float_or_none(row.get("2030")),
        })
    return records


@router.get("/metrics")
def get_metrics():
    return sorted(app_state.profiles["Metric"].unique().tolist())


@router.get("/filter_options")
def get_filter_options(
    plan_types:     str = Query(default=""),
    group_entities: str = Query(default=""),
    segments:       str = Query(default=""),
    regions:        str = Query(default=""),
    countries:      str = Query(default=""),
    case_names:     str = Query(default=""),
):
    """
    Return the available values for each filter dimension given the current
    selections. Each dimension's options are computed from the cases that remain
    after applying ALL OTHER active filters (cascaded / cross-filtering).
    """
    cl = app_state.case_listing.copy()

    def _vals(col, raw):
        return [v.strip() for v in raw.split(",") if v.strip()] if raw else []

    sel = {
        "Plan Type":    _vals("Plan Type",    plan_types),
        "Group Entity": _vals("Group Entity", group_entities),
        "Segment":      _vals("Segment",      segments),
        "Region":       _vals("Region",       regions),
        "Country":      _vals("Country",      countries),
        "Case Name":    _vals("Case Name",    case_names),
    }

    def _filter_except(exclude_col):
        df = cl.copy()
        for col, vals in sel.items():
            if col == exclude_col or not vals:
                continue
            df = df[df[col].isin(vals)]
        return df

    def _sorted(df, col):
        return sorted(df[col].dropna().unique().tolist())

    return {
        "plan_types":     _sorted(_filter_except("Plan Type"),    "Plan Type"),
        "group_entities": _sorted(_filter_except("Group Entity"), "Group Entity"),
        "segments":       _sorted(_filter_except("Segment"),      "Segment"),
        "regions":        _sorted(_filter_except("Region"),       "Region"),
        "countries":      _sorted(_filter_except("Country"),      "Country"),
        "case_names":     _sorted(_filter_except("Case Name"),    "Case Name"),
    }


def _or_none(val):
    import math, pandas as pd
    if val is None:
        return None
    s = str(val).strip()
    if s.lower() in ("nan", "n/a", "-", ""):
        return None
    return s


def _float_or_none(val):
    import math, pandas as pd
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None

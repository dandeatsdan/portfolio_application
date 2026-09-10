"""
Scenario endpoints — run a scenario and compute comparison/waterfall data.
"""

from fastapi import APIRouter, HTTPException
import logging
import pandas as pd
import numpy as np
from ..state import app_state
from ..schemas import ScenarioRunRequest, ScenarioRunResponse, WaterfallRequest, ValuationRequest
from scenario_modeller.services.scenario_service import execute_scenario
from scenario_modeller.services.valuation_service import npv_by_case, valuation_basis
from scenario_modeller.services.comparison_service import build_waterfall, scenario_kpi_delta

router = APIRouter(prefix="/api/scenario")
logger = logging.getLogger(__name__)

from ..operation_validation import OPERATION_MAP, validate_operations


@router.post("/validate")
def validate_scenario_endpoint(request: ScenarioRunRequest):
    errors, warnings = validate_operations(request.instructions, app_state.raw_profiles)
    return {"valid": not errors, "errors": errors, "warnings": warnings}


@router.post("/run", response_model=ScenarioRunResponse)
def run_scenario_endpoint(request: ScenarioRunRequest):
    errors, warnings = validate_operations(request.instructions, app_state.raw_profiles)
    if errors:
        raise HTTPException(status_code=422, detail={
            "valid": False, "message": "Check the operation inputs before running.", "diagnostics": errors})
    instructions_rows = []
    for inst in request.instructions:
        op_key = OPERATION_MAP.get(inst.operation, inst.operation)
        instructions_rows.append({
            "Scenario": request.scenario_id,
            "ID":       inst.id,
            "Case":     inst.case,
            "Include":  inst.include,
            "Operation":op_key,
            "Param1":   inst.param1,
            "Param2":   inst.param2,
            "Param3":   inst.param3,
            "Param4":   inst.param4,
            "Param5":   inst.param5,
        })
    instructions_df = pd.DataFrame(instructions_rows)

    try:
        run = execute_scenario(app_state.raw_profiles, instructions_df,
                               app_state.case_listing, app_state.tax_rates)
    except Exception:
        logger.exception("Unexpected scenario calculation failure")
        raise HTTPException(status_code=500, detail="Calculation failed; no new results published.")
    if not run.valid:
        raise HTTPException(status_code=422, detail={
            "valid": False, "message": "Scenario failed; no new results published.",
            "diagnostics": run.diagnostics,
        })
    results = run.results
    if not np.isfinite(results["Value"]).all():
        raise HTTPException(status_code=422, detail="Calculation produced non-finite values; reduce the input magnitude.")
    # Same enriched reference used by Portfolio Viewer; full-portfolio comparison.
    baseline_results = app_state.profiles

    def _df_to_records(df):
        if df.empty:
            return []
        rows = []
        for _, r in df.iterrows():
            rows.append({
                "id":        int(r["ID"]) if "ID" in r else 0,
                "case":      str(r.get("Case", "")),
                "metric":    str(r.get("Metric", "")),
                "year":      int(r.get("Year", 0)),
                "value":     float(r.get("Value", 0)),
                "operation": str(r.get("Operation", "")),
                "scenario": int(r["Scenario"]) if "Scenario" in r else 0,
                "run_datetime": r.get("RunDateTime", None),
            })
        return rows

    return {
        "valid": True,
        "scenario_id": request.scenario_id,
        "scenario_name": request.scenario_name,
        "scenario_description": request.scenario_description,
        "rationale": request.rationale,
        "valuation": valuation_basis(),
        "diagnostics": warnings + run.diagnostics + app_state.baseline_diagnostics,
        "instructions": run.instructions.rename(columns={
            "ID": "id", "Case": "case", "Include": "include", "Operation": "operation",
            **{f"Param{i}": f"param{i}" for i in range(1, 6)},
        }).to_dict("records"),
        "output_rows":   len(results),
        "errors":        [],
        "results":       _df_to_records(results),
        "baseline":      _df_to_records(baseline_results),
    }


@router.post("/waterfall")
def waterfall_endpoint(request: WaterfallRequest):
    baseline_df = pd.DataFrame([r.model_dump() for r in request.baseline])
    scenario_df = pd.DataFrame([r.model_dump() for r in request.scenario])

    # Normalise column names
    baseline_df = baseline_df.rename(columns={"id": "ID", "case": "Case", "metric": "Metric", "year": "Year", "value": "Value"})
    scenario_df = scenario_df.rename(columns={"id": "ID", "case": "Case", "metric": "Metric", "year": "Year", "value": "Value"})

    wf = build_waterfall(
        baseline_df, scenario_df, app_state.case_listing,
        request.metric, request.years
    )
    return wf.rename(columns={"Label": "label", "Value": "value", "Type": "type"}).to_dict(orient="records")


@router.post("/valuation")
def scenario_valuation(request: ValuationRequest):
    def total(rows):
        df = pd.DataFrame([r.model_dump() for r in rows]).rename(columns={
            "id": "ID", "metric": "Metric", "year": "Year", "value": "Value",
        })
        if df.empty:
            return 0.0
        return float(npv_by_case(df, request.discount_rate, request.year_from, request.year_to)["NPV"].sum())
    try:
        baseline, scenario = total(request.baseline), total(request.scenario)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"baseline": baseline, "scenario": scenario, "delta": scenario - baseline,
            "basis": valuation_basis(request.discount_rate)}


@router.post("/kpi-delta")
def kpi_delta_endpoint(request: dict):
    baseline_rows = request.get("baseline", [])
    scenario_rows = request.get("scenario", [])
    metrics       = request.get("metrics", ["Total Production (mboed)", "Post-Tax Cash Flow"])
    years         = request.get("years", None)

    baseline_df = pd.DataFrame(baseline_rows).rename(
        columns={"id":"ID","case":"Case","metric":"Metric","year":"Year","value":"Value"}
    )
    scenario_df = pd.DataFrame(scenario_rows).rename(
        columns={"id":"ID","case":"Case","metric":"Metric","year":"Year","value":"Value"}
    )

    deltas = scenario_kpi_delta(
        baseline_df, scenario_df, app_state.case_listing, metrics, years
    )
    return deltas

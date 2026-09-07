"""
Scenario endpoints — run a scenario and compute comparison/waterfall data.
"""

from fastapi import APIRouter, HTTPException
import pandas as pd
from ..state import app_state
from ..schemas import ScenarioRunRequest, ScenarioRunResponse, WaterfallRequest
from scenario_modeller.engine.scenario_engine import run_scenario
from scenario_modeller.services.comparison_service import build_waterfall, scenario_kpi_delta

router = APIRouter(prefix="/api/scenario")

OPERATION_MAP = {
    "No Change":           "NoChange",
    "Delay":               "Delay",
    "Accelerate":          "Accelerate",
    "Farm In (Increase)":  "Increase",
    "Farm Down (Dilution)":"Dilution",
    "Truncate Before":     "TruncateBefore",
    "Truncate After":      "TruncateAfter",
    "Production Change %": "ProdnAdj",
    "OPEX Change %":       "CostAdjOpex",
    "CAPEX Change %":      "CostAdjCapex",
    "CAPEX Change $m":     "CapexAbsolute",
    "OPEX Change $m":      "OpexAbsolute",
}


@router.post("/run")
def run_scenario_endpoint(request: ScenarioRunRequest):
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
        results, errors = run_scenario(app_state.profiles, instructions_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Baseline: NoChange on all cases
    baseline_instructions = app_state.case_listing[["ID", "Case"]].copy()
    baseline_instructions["Scenario"] = 0
    baseline_instructions["Include"] = True
    baseline_instructions["Operation"] = "NoChange"
    for p in ["Param1", "Param2", "Param3", "Param4", "Param5"]:
        baseline_instructions[p] = 0.0
    baseline_results, _ = run_scenario(app_state.profiles, baseline_instructions)

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
            })
        return rows

    return {
        "scenario_name": request.scenario_name,
        "output_rows":   len(results),
        "errors":        errors,
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
    return wf.to_dict(orient="records")


@router.post("/kpi-delta")
def kpi_delta_endpoint(request: dict):
    baseline_rows = request.get("baseline", [])
    scenario_rows = request.get("scenario", [])
    metrics       = request.get("metrics", ["Production", "Pre Tax Cash Flow"])
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

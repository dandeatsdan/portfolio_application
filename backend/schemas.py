# ========================================================================
# API DATA MODELS — THE SHAPES OF REQUESTS AND RESPONSES
# ========================================================================
#
# These Pydantic models describe the JSON exchanged between React and the
# Python API. Fields specify names, types, defaults and selected constraints.
# They are not database tables and do not calculate portfolio results.
#
# The main families below cover case/operation metadata, portfolio chart
# records, scenario instructions and runs, annual profile rows, waterfall
# requests and valuation requests/responses. ScenarioInstruction carries
# one case's include flag, operation and five numeric parameter slots.
# ProfileRow represents one case/metric/year observation, with optional
# scenario/operation metadata. A run response contains many such rows.
#
# Validation is split by responsibility
# ------------------------------------
# A declared Pydantic model checks a request when FastAPI uses that model
# for the endpoint. Finite-number and range constraints catch invalid
# values at that boundary. operation_validation.py adds rules whose meaning
# depends on the selected operation; the engine checks calculation inputs.
# A model declaration alone does not enforce rules on unrelated untyped
# endpoint dictionaries or on direct calls into the shared Python services.
#
# Financial profile values in scenario responses keep their analytical
# signs. Reporting endpoints can format separate display copies later.
# Saved JSON definitions have their own models in saved_scenario_models.py;
# the optimiser request/response models are in routers/optimisation.py.
# When tracing a field, find the router that uses its model, then follow
# that router's conversion from JSON fields into pandas DataFrame columns.

"""
Pydantic response schemas for the FastAPI backend.

These define the shape of data returned to the React frontend.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class CaseRow(BaseModel):
    id: int
    case: str
    case_name: str
    group_entity: str
    segment: str
    region: str
    country: str
    plan_type: str


class OperationRow(BaseModel):
    operation: str
    category: str
    description: str
    input_1_label: str | None
    input_1_required: str | None
    input_2_label: str | None
    input_2_required: str | None
    input_3_label: str | None
    input_3_required: str | None
    input_4_label: str | None
    input_4_required: str | None
    input_5_label: str | None
    input_5_required: str | None


class TotalsRow(BaseModel):
    metric: str
    case: str
    total_5y: float | None
    average_5y: float | None
    y2026: float | None
    y2027: float | None
    y2028: float | None
    y2029: float | None
    y2030: float | None


class PortfolioKpis(BaseModel):
    metric: str
    total_5y: float
    average_5y: float


class StackedPoint(BaseModel):
    year: int
    case_name: str
    value: float


class RankedRow(BaseModel):
    case_name: str
    total: float
    cumulative: float | None = None


class ScenarioInstruction(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    id: int
    case: str
    include: bool
    operation: str
    param1: float = 0.0
    param2: float = 0.0
    param3: float = 0.0
    param4: float = 0.0
    param5: float = 0.0


class ScenarioRunRequest(BaseModel):
    scenario_id: int = 1
    scenario_name: str = "Scenario"
    scenario_description: str = ""
    rationale: str = ""
    instructions: list[ScenarioInstruction]


class ProfileRow(BaseModel):
    id: int
    case: str
    metric: str
    year: int
    value: float
    operation: str | None = None
    scenario: int | None = None
    run_datetime: str | None = None


class ScenarioRunResponse(BaseModel):
    valid: bool
    scenario_name: str
    scenario_description: str = ""
    rationale: str = ""
    scenario_id: int
    diagnostics: list[dict] = Field(default_factory=list)
    instructions: list[ScenarioInstruction] = Field(default_factory=list)
    valuation: dict = Field(default_factory=dict)
    output_rows: int
    errors: list[dict]
    results: list[ProfileRow]
    baseline: list[ProfileRow]


class WaterfallRequest(BaseModel):
    group_by: Literal["case_name", "region", "country", "group_entity", "plan_type"] = "case_name"
    baseline: list[ProfileRow]
    scenario: list[ProfileRow]
    metric: str
    years: list[int] | None = None


class WaterfallRow(BaseModel):
    label: str
    value: float
    type: str  # "absolute" | "relative"


class ValuationRequest(BaseModel):
    baseline: list[ProfileRow]
    scenario: list[ProfileRow]
    discount_rate: float = Field(default=8.0, gt=-100, allow_inf_nan=False)
    year_from: int = Field(default=2026, ge=2026, le=2040)
    year_to: int = Field(default=2040, ge=2026, le=2040)

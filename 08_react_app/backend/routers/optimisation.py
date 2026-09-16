# ========================================================================
# OPTIMISATION API — VALIDATE A REQUEST AND CALL THE SOLVER SERVICE
# ========================================================================
#
# Where it fits
# -------------
# React Portfolio Optimiser -> POST /api/optimisation/solve -> this router
#   -> OptimisationSpec / Constraint records -> optimisation_service.optimise
#   -> typed result describing the selection and constraint checks.
# The mathematical model is in the shared service, not this HTTP layer.
#
# Accepted decisions and limits
# -----------------------------
# The default objective is post-tax NPV. Cases can be included/excluded, with
# mandatory/excluded ID lists for user controls. Constraint rows describe
# Capex, production or post-tax FCF, total or each-year basis, an inclusive year window,
# a minimum/maximum target and a flexibility percentage from 0 to 15.
# Zero flexibility is strict. Zero targets cannot use percentage relaxation.
# Constraint periods can differ from the objective period.
# Advanced adds production-share targets with percentage-point tolerances
# and Region -> Country -> Case rules. Standard submits no portfolio controls. Both modes accept
# NPV, undiscounted post-tax FCF, pre-tax Underlying RCOP or cumulative production.
#
# What the request models check
# -----------------------------
# Supported literal choices, finite bounded numbers, whole model years,
# ordered year ranges, unique constraint IDs, and nonduplicated/nonoverlapping
# case-control lists. Extra fields are forbidden. These checks run before
# constructing the plain domain dataclasses consumed by the service.
# Valid field types alone do not prove a feasible portfolio exists.
#
# Request lifecycle and errors
# ----------------------------
# A nonblocking process-local lock allows one solve through this router at
# a time; another receives 409. The lock is released even if a solve fails.
# ValueError becomes 422; unexpected errors are logged and returned as 500.
# There is no background job queue, and the lock does not coordinate
# separate backend worker processes.
#
# Reading the response
# --------------------
# Solver status distinguishes optimal, infeasible, unbounded, time limit
# and solver error. Attempts record the relaxation search; constraint checks
# compare achieved values with original/adjusted limits. Case records and
# reconciliation fields explain the recommended portfolio. An HTTP success
# alone does not mean the solver proved an optimal feasible selection.
# The frontend protects unsaved edits before Modify or Save-and-run hand-off.
# Relative-target previews and reference fingerprints prevent stale hand-offs.
# Plan type combines with geography; reference rules lock included cases unchanged.
# Optional priority tiers minimise bounded weighted breaches before the objective.
# For the algorithm and numerical examples, read the detailed header in
# services/optimisation_service.py, then its optimise function.

"""Typed, bounded optimisation of the complete loaded reference portfolio."""
from threading import Lock
from typing import Literal
import logging
from hashlib import sha256
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from ..state import app_state
from scenario_modeller.domain.optimisation import Constraint, MixConstraint, RegionRule, CountryRule, CaseRule, PlanTypeRule, OptimisationSpec
from scenario_modeller.services.optimisation_service import optimise, prepare_coefficients, resolve_case_controls

router = APIRouter(prefix='/api/optimisation', tags=['Optimisation'])
logger = logging.getLogger(__name__)
solve_lock = Lock()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class ConstraintInput(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    metric: Literal['capex', 'production', 'post_tax_fcf']
    basis: Literal['total', 'each_year'] = 'total'
    year_from: int = Field(ge=2026, le=2040, strict=True)
    year_to: int = Field(ge=2026, le=2040, strict=True)
    operator: Literal['max', 'min']
    target: float = Field(default=0, ge=-1e12, le=1e12)
    target_basis: Literal['absolute', 'relative'] = 'absolute'
    relative_pct: float = Field(default=0, ge=-100, le=10000)
    priority: int = Field(default=2, ge=1, le=3, strict=True)
    weight: float = Field(default=1, gt=0, le=100)
    flexibility_pct: int = Field(default=0, ge=0, le=15, strict=True)
    case_ids: list[int] | None = Field(default=None)

    @model_validator(mode='after')
    def valid(self):
        if self.year_from > self.year_to:
            raise ValueError('Constraint start year must not exceed end year')
        if self.target_basis == 'absolute' and self.metric != 'post_tax_fcf' and self.target < 0:
            raise ValueError('Capex and production targets must be nonnegative')
        if (self.target_basis == 'absolute' and self.target == 0 or self.target_basis == 'relative' and self.relative_pct == -100) and self.flexibility_pct:
            raise ValueError('Zero targets must remain strict')
        if self.case_ids is not None and len(self.case_ids) != len(set(self.case_ids)):
            raise ValueError('Scoped case IDs must not contain duplicates')
        return self


class MixInput(StrictModel):
    dimension: Literal['group_entity', 'region']
    value: str = Field(min_length=1)
    target_share_pct: float = Field(ge=0, le=100)
    tolerance_pct_points: float = Field(default=5, ge=0, le=100)


class RegionInput(StrictModel):
    region: str = Field(min_length=1)
    rule: Literal['optional', 'mandatory', 'excluded', 'reference']


class CountryInput(RegionInput):
    country: str = Field(min_length=1)


class CaseInput(StrictModel):
    case_id: int = Field(strict=True)
    rule: Literal['optional', 'mandatory', 'excluded', 'reference']


class PlanTypeInput(StrictModel):
    plan_type: str = Field(min_length=1)
    rule: Literal['optional', 'reference', 'excluded']


class OptimisationRequest(StrictModel):
    objective: Literal['post_tax_npv', 'post_tax_fcf', 'underlying_rcop', 'production'] = 'post_tax_npv'
    mode: Literal['full', 'mix'] = 'full'
    mix_constraints: list[MixInput] = Field(default_factory=list, max_length=100)
    region_rules: list[RegionInput] = Field(default_factory=list, max_length=100)
    country_rules: list[CountryInput] = Field(default_factory=list, max_length=500)
    case_rules: list[CaseInput] = Field(default_factory=list, max_length=10000)
    year_from: int = Field(default=2026, ge=2026, le=2040, strict=True)
    year_to: int = Field(default=2040, ge=2026, le=2040, strict=True)
    constraints: list[ConstraintInput] = Field(default_factory=list, max_length=30)
    mandatory_case_ids: list[int] = Field(default_factory=list, max_length=10000)
    excluded_case_ids: list[int] = Field(default_factory=list, max_length=10000)
    max_delay_years: int = Field(default=0, ge=0, le=14, strict=True)
    max_acceleration_years: int = Field(default=0, ge=0, le=14, strict=True)
    plan_type_rules: list[PlanTypeInput] = Field(default_factory=list, max_length=100)
    reference_case_ids: list[int] = Field(default_factory=list, max_length=10000)
    use_priorities: bool = False
    expected_reference_version: str | None = Field(default=None, max_length=64)

    @model_validator(mode='after')
    def valid(self):
        if self.mode == 'full' and (self.mix_constraints or self.region_rules or self.country_rules or self.case_rules
                                    or self.mandatory_case_ids or self.excluded_case_ids or self.plan_type_rules or self.reference_case_ids):
            raise ValueError('Mix targets and portfolio controls require Advanced mode')
        if self.year_from > self.year_to:
            raise ValueError('Objective start year must not exceed end year')
        if len({c.id for c in self.constraints}) != len(self.constraints):
            raise ValueError('Constraint IDs must be unique')
        if set(self.mandatory_case_ids) & set(self.excluded_case_ids):
            raise ValueError('A case cannot be mandatory and excluded')
        if any(len(values) != len(set(values)) for values in [self.mandatory_case_ids, self.excluded_case_ids]):
            raise ValueError('Case controls must not contain duplicate IDs')
        return self


Status = Literal['optimal', 'infeasible', 'unbounded', 'time_limit', 'solver_error']


class Attempt(StrictModel):
    relaxation_pct: int
    status: Status


class ConstraintCheck(ConstraintInput):
    unit: str
    actual: float
    adjusted_target: float
    allowed_pct: float
    reference_value: float
    breach_pct: float
    original_satisfied: bool
    satisfied: bool
    headroom: float


class CaseConstraintContribution(StrictModel):
    id: str
    year_from: int
    year_to: int
    value: float


class RecommendationCase(StrictModel):
    id: int
    name: str
    selected: bool
    npv: float
    objective_contribution: float
    capex: float
    production: float
    operation: Literal['NoChange', 'Delay', 'Accelerate'] = 'NoChange'
    params: list[float] = Field(default_factory=lambda: [0] * 5)
    year_shift: int = 0
    constraint_contributions: list[CaseConstraintContribution] = Field(default_factory=list)


class MixCheck(StrictModel):
    dimension: Literal['group_entity', 'region']
    value: str
    target_share_pct: float
    min_share_pct: float
    max_share_pct: float
    actual_share_pct: float | None
    satisfied: bool


class OptimisationResponse(StrictModel):
    objective: str
    objective_label: str
    objective_unit: str
    reference_objective_value: float
    status: Status
    selected_case_ids: list[int]
    excluded_case_ids: list[int]
    attempts: list[Attempt]
    relaxation_pct: int
    objective_value: float | None
    reference_npv: float
    capex: float | None
    production: float | None
    constraint_checks: list[ConstraintCheck]
    mix_checks: list[MixCheck]
    cases: list[RecommendationCase]
    diagnostics: list[str]
    reconciled: bool
    solve_time_ms: int
    timing_options_omitted: int = 0
    reference_version: str = ''
    post_tax_fcf: float | None = None
    use_priorities: bool = False
    priority_outcomes: list[dict] = Field(default_factory=list)


def build_spec(request: OptimisationRequest):
    spec = OptimisationSpec(request.year_from, request.year_to,
        tuple(Constraint(**{**c.model_dump(), 'case_ids': tuple(c.case_ids) if c.case_ids is not None else None}) for c in request.constraints),
        tuple(request.mandatory_case_ids), tuple(request.excluded_case_ids),
        objective=request.objective,
        mix_constraints=tuple(MixConstraint(**c.model_dump()) for c in request.mix_constraints),
        region_rules=tuple(RegionRule(**r.model_dump()) for r in request.region_rules),
        country_rules=tuple(CountryRule(**r.model_dump()) for r in request.country_rules),
        case_rules=tuple(CaseRule(**r.model_dump()) for r in request.case_rules),
        max_delay_years=request.max_delay_years,
        max_acceleration_years=request.max_acceleration_years,
        plan_type_rules=tuple(PlanTypeRule(**r.model_dump()) for r in request.plan_type_rules),
        reference_case_ids=tuple(request.reference_case_ids), use_priorities=request.use_priorities)
    return spec


def reference_version():
    digest = sha256()
    for frame in [app_state.raw_profiles, app_state.case_listing, app_state.tax_rates]:
        digest.update(str(list(frame.columns)).encode())
        digest.update(pd.util.hash_pandas_object(frame, index=True).values.tobytes())
    return digest.hexdigest()


@router.get('/reference-version')
def get_reference_version():
    return {'reference_version': reference_version()}


@router.post('/preview')
def preview(request: OptimisationRequest):
    try:
        spec = resolve_case_controls(app_state.case_listing, build_spec(request))
        _, _, limits, _ = prepare_coefficients(app_state.profiles, app_state.case_listing, spec)
        return {'reference_version': reference_version(),
                'limits': [{k: v for k, v in limit.items() if k != 'coefficients'} for limit in limits]}
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc))


@router.post('/solve', response_model=OptimisationResponse)
def solve(request: OptimisationRequest):
    spec = build_spec(request)
    if not solve_lock.acquire(blocking=False):
        raise HTTPException(409, detail='An optimisation is already running. Try again when it finishes.')
    try:
        version = reference_version()
        if request.expected_reference_version and request.expected_reference_version != version:
            raise HTTPException(409, detail='Reference data changed. Refresh the preview and optimise again.')
        result = optimise(app_state.profiles, app_state.raw_profiles, app_state.case_listing, app_state.tax_rates, spec)
        if version != reference_version():
            raise HTTPException(409, detail='Reference data changed during optimisation. Optimise again.')
        return {**result, 'reference_version': version}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc))
    except Exception:
        logger.exception('Optimisation failed')
        raise HTTPException(500, detail='Optimisation failed; no recommendation was published.')
    finally:
        solve_lock.release()

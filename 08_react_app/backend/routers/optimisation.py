"""Typed, bounded optimisation of the complete loaded reference portfolio."""
from threading import Lock
from typing import Literal
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from ..state import app_state
from scenario_modeller.domain.optimisation import Constraint, OptimisationSpec
from scenario_modeller.services.optimisation_service import optimise

router = APIRouter(prefix='/api/optimisation', tags=['Optimisation'])
logger = logging.getLogger(__name__)
solve_lock = Lock()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class ConstraintInput(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    metric: Literal['capex', 'production']
    basis: Literal['total', 'each_year'] = 'total'
    year_from: int = Field(ge=2026, le=2040, strict=True)
    year_to: int = Field(ge=2026, le=2040, strict=True)
    operator: Literal['max', 'min']
    target: float = Field(ge=0, le=1e12)
    flexibility_pct: int = Field(default=0, ge=0, le=15, strict=True)

    @model_validator(mode='after')
    def valid(self):
        if self.year_from > self.year_to:
            raise ValueError('Constraint start year must not exceed end year')
        if self.target == 0 and self.flexibility_pct:
            raise ValueError('Zero targets must remain strict')
        return self


class OptimisationRequest(StrictModel):
    objective: Literal['post_tax_npv'] = 'post_tax_npv'
    year_from: int = Field(default=2026, ge=2026, le=2040, strict=True)
    year_to: int = Field(default=2040, ge=2026, le=2040, strict=True)
    constraints: list[ConstraintInput] = Field(default_factory=list, max_length=30)
    mandatory_case_ids: list[int] = Field(default_factory=list, max_length=10000)
    excluded_case_ids: list[int] = Field(default_factory=list, max_length=10000)

    @model_validator(mode='after')
    def valid(self):
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
    allowed_pct: int
    breach_pct: float
    original_satisfied: bool
    satisfied: bool
    headroom: float


class RecommendationCase(StrictModel):
    id: int
    name: str
    selected: bool
    npv: float
    capex: float
    production: float


class OptimisationResponse(StrictModel):
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
    cases: list[RecommendationCase]
    diagnostics: list[str]
    reconciled: bool
    solve_time_ms: int


@router.post('/solve', response_model=OptimisationResponse)
def solve(request: OptimisationRequest):
    spec = OptimisationSpec(request.year_from, request.year_to,
        tuple(Constraint(**c.model_dump()) for c in request.constraints),
        tuple(request.mandatory_case_ids), tuple(request.excluded_case_ids))
    if not solve_lock.acquire(blocking=False):
        raise HTTPException(409, detail='An optimisation is already running. Try again when it finishes.')
    try:
        return optimise(app_state.profiles, app_state.raw_profiles, app_state.case_listing, app_state.tax_rates, spec)
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc))
    except Exception:
        logger.exception('Optimisation failed')
        raise HTTPException(500, detail='Optimisation failed; no recommendation was published.')
    finally:
        solve_lock.release()

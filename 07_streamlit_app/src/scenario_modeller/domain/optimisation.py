"""Immutable inputs for reference-case portfolio selection."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Constraint:
    id: str
    metric: str  # capex or production
    basis: str  # total or each_year
    year_from: int
    year_to: int
    operator: str  # max or min
    target: float
    flexibility_pct: int = 0


@dataclass(frozen=True)
class OptimisationSpec:
    year_from: int = 2026
    year_to: int = 2040
    constraints: tuple[Constraint, ...] = ()
    mandatory_case_ids: tuple[int, ...] = ()
    excluded_case_ids: tuple[int, ...] = ()

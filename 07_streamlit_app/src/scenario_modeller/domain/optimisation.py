# ========================================================================
# OPTIMISER DOMAIN RECORDS — THE SETTINGS PASSED TO THE SOLVER SERVICE
# ========================================================================
#
# Constraint holds one rule: its identity, metric, aggregation basis,
# inclusive year window, min/max operator, target and flexibility allowance.
# OptimisationSpec collects those rules with the NPV objective's year
# window and the mandatory/excluded case IDs.
#
# For example, a total Capex maximum over 2026–2028 is one limit on the
# three-year sum. The each_year basis imposes a separate limit in each
# year. A constraint's period can differ from the objective's period.
# Zero flexibility means strict; positive flexibility permits the service
# to relax that rule only within the allowed percentage cap.
#
# These frozen dataclasses are containers, not a solver or an API validator.
# Frozen prevents reassignment of their fields after construction. Type
# annotations alone do not check valid metrics, year ordering or targets.
# backend/routers/optimisation.py validates HTTP input and builds these
# records; services/optimisation_service.py interprets them mathematically.
# Read those two files to follow a request from the screen into a solve.

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
    case_ids: tuple[int, ...] | None = None  # when set, constraint applies only to these cases


OBJECTIVE_METRICS = {
    'post_tax_fcf':  'Post-Tax Cash Flow',
    'underlying_rcop': 'Post-Tax RCOP',
    'production':    'Total Production (mboed)',
}


@dataclass(frozen=True)
class OptimisationSpec:
    year_from: int = 2026
    year_to: int = 2040
    constraints: tuple[Constraint, ...] = ()
    mandatory_case_ids: tuple[int, ...] = ()
    excluded_case_ids: tuple[int, ...] = ()
    objective: str = 'post_tax_fcf'  # key from OBJECTIVE_METRICS

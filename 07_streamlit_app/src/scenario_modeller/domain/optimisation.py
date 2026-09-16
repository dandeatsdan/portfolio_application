# ========================================================================
# OPTIMISER DOMAIN RECORDS — THE SETTINGS PASSED TO THE SOLVER SERVICE
# ========================================================================
#
# Constraint holds one rule: its identity, metric, aggregation basis,
# inclusive year window, min/max operator, target and flexibility allowance.
# OptimisationSpec collects those rules with the selected objective's year
# window and the mandatory/excluded case IDs.
# Advanced adds production-share bands over that same year window and
# Region -> Country -> Case inclusion/exclusion rules. More-specific choices
# override parents; explicit optional clears inheritance. Resolved controls stay
# strict during solver relaxation. Mix tolerances are percentage points.
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


@dataclass(frozen=True)
class MixConstraint:
    dimension: str  # group_entity or region
    value: str
    target_share_pct: float
    tolerance_pct_points: float = 5


@dataclass(frozen=True)
class RegionRule:
    region: str
    rule: str  # mandatory or excluded; absence means optimiser chooses


@dataclass(frozen=True)
class CountryRule:
    region: str
    country: str
    rule: str  # optional, mandatory or excluded; absence inherits region


@dataclass(frozen=True)
class CaseRule:
    case_id: int
    rule: str  # optional, mandatory or excluded; absence inherits country/region


# Objective keys are stable API values; labels and units accompany every result.
OBJECTIVES = {
    'post_tax_npv': ('Post-tax NPV', '$m', 'Post-Tax Cash Flow'),
    'post_tax_fcf': ('Free Cash Flow', '$m', 'Post-Tax Cash Flow'),
    'underlying_rcop': ('Underlying RCOP', '$m', 'Underlying RCOP'),
    'production': ('Production', 'mmboe', 'Total Production (mboed)'),
}


@dataclass(frozen=True)
class OptimisationSpec:
    year_from: int = 2026
    year_to: int = 2040
    constraints: tuple[Constraint, ...] = ()
    mandatory_case_ids: tuple[int, ...] = ()
    excluded_case_ids: tuple[int, ...] = ()
    objective: str = 'post_tax_npv'
    mix_constraints: tuple[MixConstraint, ...] = ()
    region_rules: tuple[RegionRule, ...] = ()
    country_rules: tuple[CountryRule, ...] = ()
    case_rules: tuple[CaseRule, ...] = ()

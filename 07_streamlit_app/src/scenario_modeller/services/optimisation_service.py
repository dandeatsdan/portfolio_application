# ============================================================
# PORTFOLIO OPTIMISER — REFERENCE-CASE SELECTION
# ============================================================
#
# Purpose
# -------
# Answer the business question:
#   "Which cases should we include to achieve the highest post-tax
#    NPV while staying within the specified portfolio limits?"
#
# The ordinary scenario engine evaluates decisions supplied by the
# user. This optimiser chooses include/exclude decisions, then checks
# its recommendation using that same scenario engine.
#
# It uses the loaded reference profiles. It does not optimise delays,
# acceleration, ownership percentages or other operation parameters.
# All cases may run concurrently. Mandatory cases must be included;
# excluded cases must stay out. There are no project-dependency or
# mutually exclusive alternative-case rules in this first version.
#
# Where this module fits
# ----------------------
# React Portfolio Optimiser page
#   -> POST /api/optimisation/solve
#   -> backend/routers/optimisation.py validates the request
#   -> optimise(...) in THIS FILE coordinates the calculation
#   -> response returns the recommendation and constraint checks
#
# The API validates years, metric names, targets and flexibility caps.
# The shared domain/optimisation.py file defines the input dataclasses.
# Those dataclasses hold settings; they do not validate API input.
# Direct callers of this service must supply a valid specification.
#
# The optimiser returns data. It does not write JSON files, update
# the working scenario or navigate the browser. React performs the
# editable-scenario hand-off only when the user confirms it.
#
# Inputs to optimise(...)
# -----------------------
# profiles:
#   Reference DataFrame already enriched with post-tax calculations.
#   Important columns: ID, Metric, Year, Value. Values retain their
#   analytical signs, rather than the signs used for presentation.
#
# raw_profiles:
#   Source profiles used to replay the chosen cases through the
#   scenario engine. That engine derives the post-tax values again.
#
# cases:
#   Case-listing DataFrame: ID identifies the case; Case and Case Name
#   supply labels. Financial processing also uses its country mapping.
#
# tax_rates:
#   Existing tax assumptions passed to the scenario engine for replay.
#   This module does not implement a separate tax calculation.
#
# spec (OptimisationSpec):
#   - year_from / year_to: period used for the NPV objective and cards;
#   - constraints: each has its own metric, period, rule and target;
#   - mandatory_case_ids: cases fixed as included;
#   - excluded_case_ids: cases fixed as excluded.
#   A constraint period can differ from the NPV objective period.
#
# time_limit:
#   Default 30 seconds for the sequence of solver attempts. Preparation
#   consumes part of that elapsed-time budget. Each attempt receives
#   the remaining time. Final replay/verification is additional work;
#   this is not a hard 30-second deadline for the entire HTTP response.
#
# The mathematical model, in plain language
# -----------------------------------------
# Each case i receives a binary decision variable, x[i]:
#   x[i] = 1 means include the whole reference case.
#   x[i] = 0 means exclude it.
# A binary variable cannot mean "include 40% of the case".
#
# A COEFFICIENT is simply a precomputed contribution from one case:
# its NPV, its Capex in a given period, or its production in that period.
# Multiplying a coefficient by x[i] either keeps it or makes it zero.
# Summing those products gives the total for the selected portfolio.
#
# Objective: maximise sum(NPV[i] * x[i]).
# Budget:    sum(Capex[i] * x[i]) <= maximum spending target.
# Output:    sum(Production[i] * x[i]) >= minimum production target.
# The interface also permits minimum Capex and maximum production.
# Mandatory/excluded cases add x[i] == 1 / x[i] == 0 constraints.
#
# This is a binary mixed-integer linear programming (MILP) model:
# "linear" means we add fixed contributions multiplied by decisions;
# "integer" means the decisions take discrete values (here, 0 or 1).
# PuLP expresses the model as Python objects. HiGHS solves it through
# highspy. We do not explicitly loop through every possible portfolio
# or simply take cases in descending order of their individual NPV.
#
# Small worked example (illustrative, not the loaded sample data)
# -------------------------------------------------------------
#                 NPV ($m)    Capex ($m)    Production (mmboe)
#   Case A             8             6                     8
#   Case B             7             5                     9
#   Case C             5             4                     6
#
# Suppose the budget is 10 and the production minimum is 12.
# A + B fails the budget: 6 + 5 = 11.
# A + C meets both limits: Capex 10, production 14, NPV 13.
# B + C also meets both:   Capex 9, production 15, NPV 12.
# The NPV objective therefore chooses A + C, even though B + C
# produces more. Production is a constraint in this example, not an
# additional objective. The NPV figures above are already discounted.
#
# Signs, periods and units — especially important here
# ----------------------------------------------------
# NPV:
#   Reuse npv_by_case(...), at the existing 8% discount rate.
#   Annual post-tax cash flow in year y is discounted by
#   (1.08 ** (y - 2026 + 1)). Selecting later years does not restart
#   that clock. Negative-NPV cases are allowed; another constraint
#   may make their inclusion necessary. No NPV display inversion.
#
# Cash Capex:
#   Budget coefficients = NEGATIVE of summed analytical Cash Capex.
#   Raw -100 becomes +100 of expenditure, measured in $m.
#   Raw +19 becomes -19 of expenditure, offsetting other spending.
#   This is signed NET Capex, consistent with the existing reports.
#   Never use abs() or clip negative expenditure to zero: either would
#   change the budget meaning. Source profiles are not modified.
#
# Production:
#   Annual profiles are in mboed. A total-across-period constraint
#   sums the annual values and multiplies by 0.36525 to obtain mmboe.
#   This uses the existing application's annual conversion convention.
#   An every-year constraint uses each year's mboed value directly.
#
# "Total across period" creates ONE inequality for the whole period.
# "In every year" creates a SEPARATE inequality for EACH year. Thus,
# a $1,000m maximum in every year 2026-2028 is three annual limits;
# it is not a single $1,000m limit shared across all three years.
#
# Missing years within an available case/metric contribute zero,
# matching the existing reports. A completely missing required metric
# for a case, duplicate profile keys or non-finite values are errors.
#
# Processing flow and the functions to read
# ------------------------------------------
# 1. optimise(...) starts the elapsed-time clock and calls
#    prepare_coefficients(...). This prepares the case IDs, objective
#    coefficients, expanded constraints and headline contributions.
#
# 2. solve_attempt(...) constructs one PuLP model for the current
#    flexibility step and asks HiGHS to maximise its NPV objective.
#    These attempts reuse prepared financial coefficients; they do
#    not repeatedly rerun financialisation for each possible selection.
#
# 3. If HiGHS proves the limits infeasible, optimise(...) may try the
#    next permitted flexibility step, using adjusted_target(...).
#    Time limits and errors stop the search instead of relaxing rules.
#
# 4. Once an optimal selection is found, constraint_checks(...) sums
#    its case contributions independently and checks the limits again.
#    The mandatory/excluded case rules are also checked independently.
#
# 5. A nonempty selection is converted into included NoChange
#    instructions and replayed through execute_scenario(...).
#    Its per-case NPV, constraint coefficients and headline values
#    must agree with those used for optimisation. This checks that
#    the recommendation will mean the same thing in the scenario app.
#
# 6. Return the selected/excluded IDs, portfolio values, case table,
#    constraint checks, attempt history and elapsed time.
#
# Flexibility is a feasibility fallback, not an NPV booster
# --------------------------------------------------------
# Step 0 always uses the original limits. A feasible optimum at step 0
# is accepted, even if relaxing the budget could achieve higher NPV.
#
# After proven infeasibility, steps 1, 2, ... widen only the limits
# explicitly given flexibility. Each constraint stops at its OWN cap:
#   allowance = min(current step, constraint flexibility cap) / 100
#   maximum target -> original target * (1 + allowance)
#   minimum target -> original target * (1 - allowance)
#
# Example: maximum spending 100 with a 15% cap can become 101, 102,
# ... 115. Minimum production 100 can become 99, 98, ... 85.
# Changes are measured from the ORIGINAL target, not compounded.
# A strict constraint has a zero cap and never moves. Case controls
# also stay strict. The API limits flexibility to 15% and requires
# zero targets to remain strict.
#
# All flexible constraints advance together, subject to their caps.
# Stop at the first step for which an optimal feasible selection is
# established. This policy does not minimise the sum of all breaches
# or choose which individual constraint is commercially best to relax.
# Those would be different optimisation policies.
#
# Result meanings and publication rules
# --------------------------------------
# status = optimal:
#   HiGHS reported an optimum for the limits used in that attempt.
#   With flexibility, that means the ADJUSTED limits, not necessarily
#   the original ones. Equal-value portfolios can have different case
#   combinations; an optimal result need not be a unique result.
#
# status = infeasible:
#   No selection met the limits at the attempted flexibility levels.
#
# status = time_limit / solver_error / unbounded:
#   No recommendation is published. A timeout is not proof of
#   infeasibility. An unbounded result is unexpected with finite
#   coefficients and binary decisions, so it also withholds output.
#
# We inspect the HiGHS model status directly: PuLP can label a
# time-limited candidate "optimal" even without proof of optimality.
# gapRel=0 and gapAbs=0 request no deliberate objective-gap allowance;
# ordinary numerical tolerances still apply to floating-point values.
# Those tiny numerical tolerances are distinct from business flexibility.
#
# original_satisfied checks the user's original target.
# satisfied checks the adjusted target used in the solve.
# headroom is the distance from the adjusted limit in the metric's units.
# allowed_pct is the permitted widening at that step; breach_pct is
# the ACTUAL breach of the original target. They need not be equal.
#
# reconciled=True means the nonempty selection passed scenario replay.
# It does not mean the model has been independently business validated.
# An empty portfolio can be mathematically optimal (for example, when
# every case has negative NPV and none is required). It is reported,
# but cannot be handed to the current scenario engine, which requires
# an included case. It therefore keeps reconciled=False.
#
# A validation or replay mismatch raises ValueError; the API turns
# that into an error response rather than publishing a recommendation.
#
# Relationship to Build a Scenario
# --------------------------------
# The frontend deliberately keeps recommended cases INCLUDED at their
# reference profiles under Available cases. Optimiser exclusions go
# into Shortlisted cases with include=False, making those departures
# from the reference portfolio explicit and editable.
# Shortlisted therefore does not mean included. A recommendation of
# 3 included and 9 excluded cases creates 9 shortlisted exclusions.
# The transition dialog explains this before replacing the working copy.
#
# Useful companion files
# -----------------------
# domain/optimisation.py                 Input dataclasses.
# services/valuation_service.py          Shared NPV calculation.
# services/scenario_service.py           Normal scenario execution.
# 08_react_app/backend/routers/optimisation.py
#                                       API validation and solve lock.
# 08_react_app/backend/tests/test_optimisation.py
#                                       Worked portfolios, brute-force
#                                       checks, flexibility and replay tests.
# 08_react_app/frontend/src/pages/optimiserHelpers.js
#                                       Editable-scenario hand-off.
#
# Suggested reading order: optimise -> prepare_coefficients ->
# solve_attempt -> adjusted_target -> constraint_checks.
# ============================================================

"""Binary reference-case selection. Financialisation stays in existing services."""
from time import monotonic
import math
import numpy as np
import pandas as pd
import pulp
import highspy
from scenario_modeller.domain.optimisation import OptimisationSpec
from scenario_modeller.services.valuation_service import npv_by_case
from scenario_modeller.services.scenario_service import execute_scenario

METRICS = {'capex': 'Cash Capex', 'production': 'Total Production (mboed)'}


def prepare_coefficients(profiles, cases, spec):
    ids = sorted(int(i) for i in cases.ID)
    if not ids or len(ids) != len(set(ids)):
        raise ValueError('Candidate case IDs must be nonempty and unique')
    if not set(spec.mandatory_case_ids + spec.excluded_case_ids).issubset(ids):
        raise ValueError('Unknown mandatory or excluded case')
    if set(spec.mandatory_case_ids) & set(spec.excluded_case_ids):
        raise ValueError('A case cannot be both mandatory and excluded')
    data = profiles.loc[profiles.ID.isin(ids)].copy()
    if data.duplicated(['ID', 'Metric', 'Year']).any() or not np.isfinite(data.Value).all():
        raise ValueError('Duplicate or non-finite analytical profiles')
    # Missing annual rows within a present metric are zero, as in existing reports.
    for metric in ['Post-Tax Cash Flow', *METRICS.values()]:
        missing = set(ids) - set(data.loc[data.Metric == metric, 'ID'])
        if missing:
            raise ValueError(f'Missing {metric} profiles for cases {sorted(missing)}')
    npvs = npv_by_case(data, 8, spec.year_from, spec.year_to).set_index('ID').NPV
    objective = {i: float(npvs.get(i, 0)) for i in ids}

    def values(metric, start, end, cumulative):
        selected = data.loc[(data.Metric == METRICS[metric]) & data.Year.between(start, end)]
        summed = selected.groupby('ID').Value.sum()
        factor = -1 if metric == 'capex' else .36525 if cumulative else 1
        result = {i: float(summed.get(i, 0)) * factor for i in ids}
        if any(not math.isfinite(v) for v in result.values()):
            raise ValueError(f'{metric} values must be finite')
        # Capex is signed net expenditure, matching existing reports. A positive
        # raw cash-flow entry reduces expenditure; never reject, abs or clip it.
        if metric == 'production' and any(v < -1e-8 for v in result.values()):
            raise ValueError('Production values must be nonnegative; review the source data')
        return result

    limits = []
    for constraint in spec.constraints:
        periods = [(constraint.year_from, constraint.year_to)] if constraint.basis == 'total' else [(y, y) for y in range(constraint.year_from, constraint.year_to + 1)]
        for start, end in periods:
            limits.append({'id': constraint.id, 'metric': constraint.metric, 'basis': constraint.basis,
                'year_from': start, 'year_to': end, 'operator': constraint.operator,
                'target': constraint.target, 'flexibility_pct': constraint.flexibility_pct,
                'unit': '$m' if constraint.metric == 'capex' else 'mmboe' if constraint.basis == 'total' else 'mboed',
                'coefficients': values(constraint.metric, start, end, constraint.basis == 'total')})
    headline = {metric: values(metric, spec.year_from, spec.year_to, True) for metric in METRICS}
    return ids, objective, limits, headline


def adjusted_target(limit, step):
    allowance = min(step, limit['flexibility_pct']) / 100
    return limit['target'] * (1 + allowance if limit['operator'] == 'max' else 1 - allowance)


def solve_attempt(ids, objective, limits, spec, step, seconds):
    model = pulp.LpProblem('Portfolio', pulp.LpMaximize)
    x = {i: pulp.LpVariable(f'case_{i}', cat=pulp.LpBinary) for i in ids}
    model += pulp.lpSum(objective[i] * x[i] for i in ids)
    for i in spec.mandatory_case_ids:
        model += x[i] == 1, f'mandatory_{i}'
    for i in spec.excluded_case_ids:
        model += x[i] == 0, f'excluded_{i}'
    # Include every variable even when objective and constraints have zero coefficients.
    for i in ids:
        model += x[i] <= 1, f'case_bound_{i}'
    for n, limit in enumerate(limits):
        expression = pulp.lpSum(limit['coefficients'][i] * x[i] for i in ids)
        target = adjusted_target(limit, step)
        model += (expression <= target if limit['operator'] == 'max' else expression >= target), f'constraint_{n}'
    model.solve(pulp.HiGHS(msg=False, timeLimit=seconds, gapRel=0, gapAbs=0, threads=1, random_seed=0))
    # PuLP can map a time-limited incumbent to an 'optimal' status; inspect HiGHS itself.
    status = model.solverModel.getModelStatus()
    if status == highspy.HighsModelStatus.kInfeasible:
        return 'infeasible', None
    if status == highspy.HighsModelStatus.kUnbounded:
        return 'unbounded', None
    if status in (highspy.HighsModelStatus.kTimeLimit, highspy.HighsModelStatus.kIterationLimit, highspy.HighsModelStatus.kSolutionLimit):
        return 'time_limit', None
    if status != highspy.HighsModelStatus.kOptimal:
        return 'solver_error', None
    vector = {i: x[i].value() for i in ids}
    if any(v is None or not math.isfinite(v) or abs(v - round(v)) > 1e-6 for v in vector.values()):
        return 'solver_error', None
    return 'optimal', [i for i, value in vector.items() if value > .5]


def constraint_checks(limits, selected, step):
    output = []
    for limit in limits:
        actual = sum(limit['coefficients'][i] for i in selected)
        adjusted = adjusted_target(limit, step)
        signed = actual - limit['target'] if limit['operator'] == 'max' else limit['target'] - actual
        headroom = adjusted - actual if limit['operator'] == 'max' else actual - adjusted
        tolerance = 1e-7 * max(1, abs(adjusted))
        output.append({k: v for k, v in limit.items() if k != 'coefficients'} | {
            'actual': actual, 'adjusted_target': adjusted, 'allowed_pct': min(step, limit['flexibility_pct']),
            'breach_pct': max(0, signed) / limit['target'] * 100 if limit['target'] else 0,
            'original_satisfied': signed <= tolerance, 'satisfied': headroom >= -tolerance,
            'headroom': headroom})
    return output


def optimise(profiles, raw_profiles, cases, tax_rates, spec: OptimisationSpec, time_limit=30):
    started = monotonic()
    ids, objective, limits, headline = prepare_coefficients(profiles, cases, spec)
    attempts = []
    result = {'status': 'infeasible', 'selected_case_ids': [], 'excluded_case_ids': [], 'attempts': attempts,
        'relaxation_pct': 0, 'objective_value': None, 'reference_npv': sum(objective.values()),
        'capex': None, 'production': None, 'constraint_checks': [], 'cases': [], 'diagnostics': [],
        'reconciled': False, 'solve_time_ms': 0}
    max_step = max((c.flexibility_pct for c in spec.constraints), default=0)
    for step in range(max_step + 1):
        remaining = time_limit - (monotonic() - started)
        if remaining <= 0:
            result['status'] = 'time_limit'
            break
        status, selected = solve_attempt(ids, objective, limits, spec, step, remaining)
        attempts.append({'relaxation_pct': step, 'status': status})
        result['status'] = status
        if status == 'infeasible':
            continue
        if status != 'optimal':
            break  # Never relax after an inconclusive solve.
        checks = constraint_checks(limits, selected, step)
        if not all(c['satisfied'] for c in checks) or not set(spec.mandatory_case_ids).issubset(selected) or set(spec.excluded_case_ids) & set(selected):
            raise ValueError('Solver recommendation failed independent constraint checks')
        if selected:
            names = cases.set_index('ID').Case
            instructions = pd.DataFrame([{'Scenario': 1, 'ID': i, 'Case': names[i], 'Include': True,
                'Operation': 'NoChange', **{f'Param{p}': 0 for p in range(1, 6)}} for i in selected])
            run = execute_scenario(raw_profiles, instructions, cases, tax_rates)
            if not run.valid:
                raise ValueError('Recommended selection failed scenario execution')
            _, replay_npv, replay_limits, replay_headline = prepare_coefficients(run.results, cases.loc[cases.ID.isin(selected)],
                OptimisationSpec(spec.year_from, spec.year_to, spec.constraints))
            if any(not math.isclose(objective[i], replay_npv[i], rel_tol=1e-8, abs_tol=1e-6) for i in selected):
                raise ValueError('Recommendation NPV does not reconcile with the scenario engine')
            for original, replay in zip(limits, replay_limits):
                if any(not math.isclose(original['coefficients'][i], replay['coefficients'][i], rel_tol=1e-8, abs_tol=1e-6) for i in selected):
                    raise ValueError('Recommendation constraints do not reconcile with the scenario engine')
            for metric in METRICS:
                if any(not math.isclose(headline[metric][i], replay_headline[metric][i], rel_tol=1e-8, abs_tol=1e-6) for i in selected):
                    raise ValueError('Recommendation headline metrics do not reconcile')
            result['diagnostics'] = [d.get('message', str(d)) for d in run.diagnostics]
            result['reconciled'] = True
        else:
            result['diagnostics'] = ['The best selection is empty. Require a case or a positive production floor to create an editable scenario.']
        case_names = cases.set_index('ID')
        result.update(status='optimal', selected_case_ids=selected, excluded_case_ids=[i for i in ids if i not in selected],
            relaxation_pct=step, objective_value=sum(objective[i] for i in selected), constraint_checks=checks,
            capex=sum(headline['capex'][i] for i in selected), production=sum(headline['production'][i] for i in selected),
            cases=[{'id': i, 'name': str(case_names.loc[i].get('Case Name', case_names.loc[i, 'Case'])),
                    'selected': i in selected, 'npv': objective[i], 'capex': headline['capex'][i], 'production': headline['production'][i]} for i in ids])
        break
    result['solve_time_ms'] = round((monotonic() - started) * 1000)
    return result

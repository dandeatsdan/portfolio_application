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

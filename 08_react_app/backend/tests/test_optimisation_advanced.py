"""Independent checks for advanced constraints, reference locks and operation alternatives."""
from dataclasses import replace
from itertools import product
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.state import app_state
from backend.routers.optimisation import OptimisationRequest
from scenario_modeller.domain.optimisation import (
    Constraint, OptimisationSpec, RegionRule, CountryRule, CaseRule, PlanTypeRule,
)
from scenario_modeller.engine.financials import calculate_post_tax
from scenario_modeller.services import optimisation_service as service


@pytest.fixture
def portfolio():
    cases = pd.DataFrame([{'ID': i, 'Case': f'Case {i}', 'Case Name': f'Case {i}',
        'Country Key': '1', 'Country': 'Example', 'Region': 'North' if i == 1 else 'South',
        'Plan Type': 'Base', 'Group Entity': 'Oil'} for i in [1, 2]])
    rows = []
    for i, cost, production, cash in [(1, 100, 90, 90), (2, 110, 100, 200)]:
        for year, fraction in [(2028, .4), (2029, .6)]:
            metrics = {'Cash Capex': -cost, 'Total Production (mboed)': production,
                'Pre Tax Cash Flow': cash, 'Underlying RCOP': cash, 'Gross Margin': cash + 20,
                'Total Cash Costs': -20, 'Production Costs': -20, 'DD&A Charge': 0,
                'EBITDA': cash, 'Operating Cashflow': cash, 'Cash Flow from Sale of Operations': 0}
            rows.extend({'ID': i, 'Case': f'Case {i}', 'Metric': metric, 'Year': year, 'Value': value * fraction}
                        for metric, value in metrics.items())
    raw = pd.DataFrame(rows)
    rates = pd.DataFrame([{'Country': 'Example', 'Country Key': '1', 'Year': year, 'ETR': 0, 'CTR': 0}
                          for year in range(2026, 2041)])
    profiles, _ = calculate_post_tax(raw, cases, rates)
    return profiles, raw, cases, rates


def constraint(id='capex', metric='capex', target=100, operator='max', **kwargs):
    return Constraint(id, metric, 'total', 2028, 2029, operator, target, **kwargs)


def test_fcf_floor_independent_of_npv_objective_and_without_production_scaling(portfolio):
    limits = (constraint(target=120), constraint('cash', 'post_tax_fcf', 150, 'min'))
    result = service.optimise(*portfolio, OptimisationSpec(2028, 2029, limits))
    assert result['selected_case_ids'] == [2]
    assert result['post_tax_fcf'] == pytest.approx(200)
    assert result['constraint_checks'][1]['actual'] == pytest.approx(200)
    assert result['constraint_checks'][1]['unit'] == '$m'
    assert sum(c['constraint_contributions'][1]['value'] for c in result['cases'] if c['selected']) == 200
    # Enumerate the independent two-case economics, rather than the coefficient helper.
    possible = [(a, b) for a, b in product([0, 1], repeat=2) if 100*a + 110*b <= 120 and 90*a + 200*b >= 150]
    assert possible == [(0, 1)]
    expected = (80 / 1.08**3) + (120 / 1.08**4)
    assert result['objective_value'] == pytest.approx(expected)


def test_signed_fcf_relaxation_widens_in_correct_direction(portfolio):
    limit = constraint('cash', 'post_tax_fcf', -100, 'min', flexibility_pct=10)
    assert service.adjusted_target({'target': -100, 'operator': 'min', 'flexibility_pct': 10}, 5) == -105
    assert service.adjusted_target({'target': -100, 'operator': 'max', 'flexibility_pct': 10}, 5) == -95
    spec = OptimisationRequest(constraints=[limit.__dict__])
    assert spec.constraints[0].target == -100
    with pytest.raises(ValueError):
        OptimisationRequest(constraints=[{**limit.__dict__, 'metric': 'production'}])
    check = service.constraint_checks([{'id': 'x', 'target': -100, 'operator': 'min',
        'flexibility_pct': 10, 'coefficients': {1: -105}}], [1], 5)[0]
    assert check['satisfied'] and check['breach_pct'] == 5


def test_relative_annual_baselines_and_scopes_do_not_shift(portfolio):
    limit = replace(constraint(target=0, target_basis='relative', relative_pct=-10, case_ids=(2,)), basis='each_year')
    spec = OptimisationSpec(2026, 2030, (limit,), max_acceleration_years=1)
    result = service.optimise(*portfolio, spec)
    checks = result['constraint_checks']
    assert [c['reference_value'] for c in checks] == [44, 66]
    assert [c['target'] for c in checks] == pytest.approx([39.6, 59.4])
    assert result['reconciled']
    for check in checks:
        assert check['actual'] <= check['target'] + 1e-6
    assert result['cases'][0]['constraint_contributions'][0]['value'] == 0


@pytest.mark.parametrize('value', [0, -1])
def test_relative_nonpositive_reference_rejected(portfolio, value):
    profiles, raw, cases, rates = portfolio
    profiles = profiles.copy()
    profiles.loc[profiles.Metric == 'Post-Tax Cash Flow', 'Value'] = value
    with pytest.raises(ValueError, match='nonpositive reference'):
        service.optimise(profiles, raw, cases, rates, OptimisationSpec(constraints=(
            constraint('cash', 'post_tax_fcf', 0, 'min', target_basis='relative', relative_pct=12),)))


def test_plan_type_reference_lock_and_explicit_override(portfolio):
    spec = OptimisationSpec(plan_type_rules=(PlanTypeRule('Base', 'reference'),), max_acceleration_years=2,
        case_rules=(CaseRule(2, 'optional'),))
    result = service.optimise(*portfolio, spec)
    assert result['selected_case_ids'] == [1, 2]
    assert result['cases'][0]['operation'] == 'NoChange'
    assert result['cases'][1]['year_shift'] == -2
    excluded = service.optimise(*portfolio, replace(spec, case_rules=(CaseRule(2, 'excluded'),)))
    assert excluded['excluded_case_ids'] == [2]
    assert len(excluded['cases']) == 2


def test_cross_dimension_conflict_and_country_override(portfolio):
    spec = OptimisationSpec(region_rules=(RegionRule('North', 'excluded'),),
        plan_type_rules=(PlanTypeRule('Base', 'reference'),))
    with pytest.raises(ValueError, match='Conflicting.*1'):
        service.optimise(*portfolio, spec)
    result = service.optimise(*portfolio, replace(spec, case_rules=(CaseRule(1, 'optional'),)))
    assert result['selected_case_ids'] == [1, 2]
    resolved = service.resolve_case_controls(portfolio[2], replace(spec, country_rules=(CountryRule('North', 'Example', 'optional'),)))
    assert resolved.reference_case_ids == (1, 2)


def test_missing_plan_type_is_explicit_unspecified_group(portfolio):
    cases = portfolio[2].copy()
    cases.loc[cases.ID == 1, 'Plan Type'] = None
    resolved = service.resolve_case_controls(cases, OptimisationSpec(plan_type_rules=(PlanTypeRule('Unspecified', 'excluded'),)))
    assert resolved.excluded_case_ids == (1,)


@pytest.mark.parametrize('budget_priority,production_priority,expected', [(1, 2, [1]), (2, 1, [2])])
def test_priority_precedence_matches_independent_enumeration(portfolio, budget_priority, production_priority, expected):
    limits = (constraint(flexibility_pct=15, priority=budget_priority),
              constraint('production', 'production', 100*.36525, 'min', flexibility_pct=15, priority=production_priority))
    result = service.optimise(*portfolio, OptimisationSpec(2028, 2029, limits, use_priorities=True))
    assert result['selected_case_ids'] == expected
    # Portfolios [1] and [2] have respectively (0%,10%) and (10%,0%) breaches.
    assert all(c['satisfied'] for c in result['constraint_checks'])
    assert sorted(c['breach_pct'] for c in result['constraint_checks']) == pytest.approx([0, 10])
    assert result['priority_outcomes'][0]['normalised_violation'] == pytest.approx(0)
    assert result['reconciled']


def test_equal_priority_weights_and_strict_caps(portfolio):
    budget = constraint(flexibility_pct=15, priority=1, weight=2)
    production = constraint('production', 'production', 100*.36525, 'min', flexibility_pct=15, priority=1)
    spec = OptimisationSpec(2028, 2029, (budget, production), use_priorities=True)
    assert service.optimise(*portfolio, spec)['selected_case_ids'] == [1]
    assert service.optimise(*portfolio, replace(spec, constraints=(replace(budget, weight=.5), production)))['selected_case_ids'] == [2]
    assert service.optimise(*portfolio, replace(spec, constraints=(replace(budget, flexibility_pct=0), replace(production, flexibility_pct=5))))['status'] == 'infeasible'


def test_preview_and_solve_api_use_same_reference_targets(portfolio, monkeypatch):
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    client = TestClient(app)
    payload = {'mode': 'mix', 'constraints': [constraint(target_basis='relative', relative_pct=-10).__dict__],
               'plan_type_rules': [{'plan_type': 'Base', 'rule': 'reference'}],
               'case_rules': [{'case_id': 2, 'rule': 'optional'}]}
    preview = client.post('/api/optimisation/preview', json=payload)
    result = client.post('/api/optimisation/solve', json=payload)
    assert preview.status_code == result.status_code == 200
    assert preview.json()['limits'][0]['reference_value'] == 210
    assert result.json()['constraint_checks'][0]['target'] == 189
    assert result.json()['cases'][0]['operation'] == 'NoChange'


def test_reference_version_rejects_stale_preview(portfolio, monkeypatch):
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    client = TestClient(app)
    version = client.get('/api/optimisation/reference-version').json()['reference_version']
    app_state.raw_profiles = app_state.raw_profiles.copy()
    app_state.raw_profiles.loc[0, 'Value'] += 1
    response = client.post('/api/optimisation/solve', json={'expected_reference_version': version})
    assert response.status_code == 409
    assert 'Reference data changed' in response.json()['detail']


def test_annual_fcf_floor_applies_to_scoped_shifted_case(portfolio):
    limit = replace(constraint('cash', 'post_tax_fcf', 80, 'min', case_ids=(2,)), basis='each_year')
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030, (limit,), max_acceleration_years=2))
    assert result['status'] == 'optimal'
    assert result['cases'][1]['operation'] == 'NoChange'
    assert [c['actual'] for c in result['constraint_checks']] == [80, 120]
    assert all(c['value'] == 0 for c in result['cases'][0]['constraint_contributions'])


def test_annual_priority_is_mean_violation_not_sum():
    limits = [{'id': 'budget', 'target': 100, 'operator': 'max', 'flexibility_pct': 15,
               'priority': 1, 'weight': 1.5, 'coefficients': {1: 100, 2: 110}}]
    limits += [{'id': 'annual', 'target': 100, 'operator': 'min', 'flexibility_pct': 15,
                'priority': 1, 'weight': 1, 'coefficients': {1: 90, 2: 100}} for _ in [2028, 2029]]
    outcomes = []
    status, chosen = service.solve_attempt([1, 2], {1: 90, 2: 200}, limits,
        OptimisationSpec(use_priorities=True), 15, 5, priority_outcomes=outcomes)
    assert status == 'optimal' and chosen == [1]
    assert outcomes[0]['normalised_violation'] == pytest.approx(.1)


def test_priority_timeout_withholds_incumbent_and_partial_outcomes(portfolio, monkeypatch):
    original = service.solver_status
    calls = 0
    def timeout(model):
        nonlocal calls
        calls += 1
        return 'time_limit' if calls == 2 else original(model)
    monkeypatch.setattr(service, 'solver_status', timeout)
    limits = (constraint(flexibility_pct=15, priority=1),
              constraint('production', 'production', 100*.36525, 'min', flexibility_pct=15, priority=2))
    result = service.optimise(*portfolio, OptimisationSpec(2028, 2029, limits, use_priorities=True))
    assert result['status'] == 'time_limit'
    assert result['selected_case_ids'] == result['priority_outcomes'] == []
    assert result['objective_value'] is None and not result['reconciled']


def test_replay_time_counts_towards_shared_budget(portfolio, monkeypatch):
    clock = [0]
    monkeypatch.setattr(service, 'monotonic', lambda: clock[0])
    original = service.execute_scenario
    def slow_replay(*args, **kwargs):
        run = original(*args, **kwargs)
        clock[0] = 31
        return run
    monkeypatch.setattr(service, 'execute_scenario', slow_replay)
    result = service.optimise(*portfolio, OptimisationSpec())
    assert result['status'] == 'time_limit'
    assert not result['reconciled'] and result['selected_case_ids'] == []


@pytest.mark.parametrize('priority,weight', [(0, 1), (4, 1), (1.5, 1), (1, 0), (1, 101)])
def test_invalid_priorities_and_weights_rejected(priority, weight):
    with pytest.raises(ValueError):
        OptimisationRequest(constraints=[constraint(priority=priority, weight=weight).__dict__])

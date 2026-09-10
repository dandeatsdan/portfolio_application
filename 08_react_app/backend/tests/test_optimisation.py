"""Known portfolios, brute-force optima, bounded flexibility and API validation."""
from itertools import combinations
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.state import app_state
from backend.routers.optimisation import OptimisationRequest, solve_lock
from scenario_modeller.domain.optimisation import Constraint, OptimisationSpec
from scenario_modeller.engine.financials import calculate_post_tax
from scenario_modeller.services import optimisation_service as service


@pytest.fixture
def portfolio():
    cases = pd.DataFrame([{'ID': i, 'Case': f'Case {i}', 'Case Name': f'Project {i}', 'Country Key': '1'} for i in [1, 2, 3]])
    # Case 3 is a loss-making source of production. Profits are taxed per case/year.
    rows = []
    for i, capex, prod, fcf in [(1, 60, 10, 100), (2, 50, 20, 90), (3, 10, 40, -5)]:
        for y in [2026, 2027]:
            for m, value in [('Cash Capex', -capex / 2), ('Total Production (mboed)', prod), ('Pre Tax Cash Flow', fcf), ('Underlying RCOP', max(0, fcf))]:
                rows.append({'ID': i, 'Case': f'Case {i}', 'Metric': m, 'Year': y, 'Value': value})
    raw = pd.DataFrame(rows)
    rates = pd.DataFrame([{'Country': 'Test country', 'Country Key': '1', 'Year': y, 'ETR': .2, 'CTR': .2} for y in [2026, 2027]])
    profiles, _ = calculate_post_tax(raw, cases, rates)
    return profiles, raw, cases, rates


def limit(target, **kwargs):
    fields = dict(id='budget', metric='capex', basis='total', year_from=2026, year_to=2027, operator='max', target=target)
    return Constraint(**(fields | kwargs))


def run(portfolio, constraints=(), required=(), excluded=()):
    return service.optimise(*portfolio, OptimisationSpec(2026, 2027, tuple(constraints), tuple(required), tuple(excluded)))


def test_optimum_matches_bruteforce_and_does_not_mutate(portfolio):
    original = portfolio[0].copy(deep=True)
    production = limit(21, id='production', metric='production', operator='min')
    constraints = [limit(70), production]
    result = run(portfolio, constraints)
    ids, values, limits, _ = service.prepare_coefficients(portfolio[0], portfolio[2], OptimisationSpec(2026, 2027, tuple(constraints)))
    feasible = [chosen for n in range(4) for chosen in combinations(ids, n) if all(c['satisfied'] for c in service.constraint_checks(limits, chosen, 0))]
    best = max(feasible, key=lambda chosen: sum(values[i] for i in chosen))
    assert result['status'] == 'optimal'
    assert result['selected_case_ids'] == list(best) == [1, 3]
    assert result['objective_value'] == pytest.approx(sum(values[i] for i in best))
    assert result['reconciled']
    assert result['capex'] == 70
    pd.testing.assert_frame_equal(portfolio[0], original)


def test_required_loss_making_and_excluded_cases(portfolio):
    assert run(portfolio)['selected_case_ids'] == [1, 2]
    assert run(portfolio, required=[3], excluded=[1])['selected_case_ids'] == [2, 3]
    with pytest.raises(ValueError, match='both mandatory'):
        run(portfolio, required=[1], excluded=[1])
    with pytest.raises(ValueError, match='Unknown'):
        run(portfolio, excluded=[999])


def test_strict_and_flexible_limits_stop_at_first_feasible_step(portfolio):
    assert run(portfolio, [limit(59)], required=[1])['status'] == 'infeasible'
    result = run(portfolio, [limit(59, flexibility_pct=15)], required=[1])
    assert result['relaxation_pct'] == 2
    assert [a['status'] for a in result['attempts']] == ['infeasible', 'infeasible', 'optimal']
    check = result['constraint_checks'][0]
    assert check['adjusted_target'] == pytest.approx(60.18)
    assert check['breach_pct'] == pytest.approx(100 / 59)
    assert not check['original_satisfied']
    assert run(portfolio, [limit(50, flexibility_pct=15)], required=[1])['status'] == 'infeasible'
    assert run(portfolio, [limit(50, flexibility_pct=15)], required=[1])['attempts'][-1]['relaxation_pct'] == 15
    # Feasible original limits do not widen to seek a better NPV.
    assert run(portfolio, [limit(60, flexibility_pct=15)])['relaxation_pct'] == 0


def test_production_relaxes_down_and_strict_constraints_never_move(portfolio):
    production = limit(10.1, id='floor', metric='production', basis='each_year', operator='min', flexibility_pct=15)
    result = run(portfolio, [limit(60), production], excluded=[2, 3])
    assert result['relaxation_pct'] == 1
    assert len(result['constraint_checks']) == 3
    assert result['constraint_checks'][0]['adjusted_target'] == 60
    for check in result['constraint_checks'][1:]:
        assert check['unit'] == 'mboed'
        assert check['adjusted_target'] == pytest.approx(9.999)
        assert check['actual'] == 10


def test_total_and_every_year_are_distinct(portfolio):
    profiles, raw, cases, rates = portfolio
    raw.loc[(raw.ID == 1) & (raw.Metric == 'Total Production (mboed)') & (raw.Year == 2026), 'Value'] = 0
    profiles, _ = calculate_post_tax(raw, cases, rates)
    modified = (profiles, raw, cases, rates)
    assert run(modified, [limit(3, metric='production', operator='min')], excluded=[2, 3])['status'] == 'optimal'
    assert run(modified, [limit(3, metric='production', operator='min', basis='each_year')], excluded=[2, 3])['status'] == 'infeasible'


def test_timeout_does_not_trigger_relaxation_or_publish_recommendation(portfolio, monkeypatch):
    calls = []
    def interrupted(*args):
        calls.append(args[-2])
        return 'time_limit', [1]
    monkeypatch.setattr(service, 'solve_attempt', interrupted)
    result = run(portfolio, [limit(50, flexibility_pct=15)])
    assert result['status'] == 'time_limit'
    assert result['selected_case_ids'] == []
    assert calls == [0]


def test_empty_optimum_is_explicit_and_cannot_be_handed_off(portfolio):
    result = run(portfolio, excluded=[1, 2, 3])
    assert result['status'] == 'optimal'
    assert result['selected_case_ids'] == []
    assert result['objective_value'] == 0
    assert not result['reconciled']
    assert 'empty' in result['diagnostics'][0]


def test_missing_nonfinite_and_incorrect_sign_data_rejected(portfolio):
    profiles, _, cases, _ = portfolio
    spec = OptimisationSpec()
    with pytest.raises(ValueError, match='Missing Cash Capex'):
        service.prepare_coefficients(profiles.loc[~((profiles.ID == 1) & (profiles.Metric == 'Cash Capex'))], cases, spec)
    bad = profiles.copy()
    bad.loc[0, 'Value'] = np.nan
    with pytest.raises(ValueError, match='non-finite'):
        service.prepare_coefficients(bad, cases, spec)
    bad = profiles.copy()
    bad.loc[bad.Metric == 'Total Production (mboed)', 'Value'] *= -1
    with pytest.raises(ValueError, match='nonnegative'):
        service.prepare_coefficients(bad, cases, spec)


def test_replay_mismatch_never_publishes(portfolio, monkeypatch):
    execute = service.execute_scenario
    def wrong(*args):
        result = execute(*args)
        result.results.loc[result.results.Metric == 'Post-Tax Cash Flow', 'Value'] += 100
        return result
    monkeypatch.setattr(service, 'execute_scenario', wrong)
    with pytest.raises(ValueError, match='does not reconcile'):
        run(portfolio)


@pytest.mark.parametrize('update', [
    {'year_from': 235}, {'year_from': 2030, 'year_to': 2028}, {'objective': 'risk'},
    {'mandatory_case_ids': [1], 'excluded_case_ids': [1]}, {'mandatory_case_ids': [1, 1]},
    {'constraints': [{'id': 'a', 'metric': 'capex', 'year_from': 2026, 'year_to': 2027, 'operator': 'max', 'target': -1}]},
    {'constraints': [{'id': 'a', 'metric': 'capex', 'year_from': 2026, 'year_to': 2027, 'operator': 'max', 'target': 0, 'flexibility_pct': 15}]},
    {'constraints': [{'id': 'a', 'metric': 'production', 'year_from': 2026, 'year_to': 2027, 'operator': 'min', 'target': 10, 'flexibility_pct': 16}]},
])
def test_invalid_contracts(update):
    with pytest.raises(ValueError):
        OptimisationRequest(**update)


def test_api_response_unknown_cases_and_busy_status(portfolio, monkeypatch):
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    client = TestClient(app)
    response = client.post('/api/optimisation/solve', json={})
    assert response.status_code == 200, response.text
    assert response.json()['reconciled']
    assert client.post('/api/optimisation/solve', json={'mandatory_case_ids': [999]}).status_code == 422
    solve_lock.acquire()
    try:
        assert client.post('/api/optimisation/solve', json={}).status_code == 409
    finally:
        solve_lock.release()


def test_individual_flexibility_caps_and_noncompounding(portfolio):
    constraints = [limit(59, flexibility_pct=1), limit(10.2, id='floor', metric='production', basis='each_year', operator='min', flexibility_pct=15)]
    # Production could become feasible, but the budget cannot widen beyond its own 1% cap.
    result = run(portfolio, constraints, required=[1], excluded=[2, 3])
    assert result['status'] == 'infeasible'
    assert len(result['attempts']) == 16
    assert service.adjusted_target({'target': 100, 'operator': 'max', 'flexibility_pct': 15}, 15) == pytest.approx(115)


def test_partial_pulp_optimal_mapping_is_not_trusted(portfolio, monkeypatch):
    import pulp
    import highspy
    class InterruptedModel:
        def getModelStatus(self):
            return highspy.HighsModelStatus.kTimeLimit
    def fake_solve(model, solver):
        model.solverModel = InterruptedModel()
        model.status = pulp.LpStatusOptimal
        return pulp.LpStatusOptimal
    monkeypatch.setattr(pulp.LpProblem, 'solve', fake_solve)
    result = run(portfolio, [limit(100, flexibility_pct=15)])
    assert result['status'] == 'time_limit'
    assert len(result['attempts']) == 1
    assert result['objective_value'] is None


def test_sample_portfolio_roundtrips_as_normal_scenario():
    from backend.state import AppState
    from backend.schemas import ScenarioRunRequest
    from backend.routers.scenario import run_scenario_endpoint
    from unittest.mock import patch
    state = AppState()
    state.load()
    spec = OptimisationSpec(constraints=(limit(10000, year_to=2028),))
    result = service.optimise(state.profiles, state.raw_profiles, state.case_listing, state.tax_rates, spec)
    assert result['status'] == 'optimal'
    selected = set(result['selected_case_ids'])
    payload = ScenarioRunRequest(instructions=[dict(id=int(c.ID), case=c.Case, include=int(c.ID) in selected, operation='NoChange') for c in state.case_listing.itertuples()])
    with patch('backend.routers.scenario.app_state', state):
        response = run_scenario_endpoint(payload)
    assert response['valid']
    output = pd.DataFrame(response['results']).rename(columns={'id': 'ID', 'metric': 'Metric', 'year': 'Year', 'value': 'Value'})
    assert service.npv_by_case(output).NPV.sum() == pytest.approx(result['objective_value'])
    assert set(i['id'] for i in response['instructions'] if not i['include']) == set(result['excluded_case_ids'])


def test_capex_credits_offset_annual_spend_without_mutating_source(portfolio):
    profiles, raw, cases, rates = portfolio
    raw = raw.copy()
    raw.loc[(raw.ID == 3) & (raw.Metric == 'Cash Capex') & (raw.Year == 2026), 'Value'] = 20
    profiles, _ = calculate_post_tax(raw, cases, rates)
    original = profiles.copy(deep=True)
    constraints = [limit(20, id='budget-2026', basis='each_year', year_to=2026),
                   limit(35, id='budget-2027', basis='each_year', year_from=2027)]
    result = run((profiles, raw, cases, rates), constraints)
    assert result['status'] == 'optimal'
    assert result['selected_case_ids'] == [1, 3]
    assert result['reconciled']
    assert [c['actual'] for c in result['constraint_checks']] == [10, 35]
    assert result['capex'] == 45
    pd.testing.assert_frame_equal(profiles, original)


def test_sample_annual_capex_limit_accepts_copper_bay_credit():
    from backend.state import AppState
    from backend.routers.optimisation import solve
    from unittest.mock import patch
    state = AppState()
    state.load()
    request = OptimisationRequest(constraints=[{
        'id': 'annual-capex', 'metric': 'capex', 'basis': 'each_year',
        'year_from': 2026, 'year_to': 2028, 'operator': 'max', 'target': 1000,
    }])
    with patch('backend.routers.optimisation.app_state', state):
        result = solve(request)
    assert result['status'] == 'optimal'
    assert result['reconciled']
    assert len(result['constraint_checks']) == 3
    selected = state.profiles.loc[state.profiles.ID.isin(result['selected_case_ids']) & (state.profiles.Metric == 'Cash Capex')]
    for check in result['constraint_checks']:
        expected = -selected.loc[selected.Year == check['year_from'], 'Value'].sum()
        assert check['actual'] == pytest.approx(expected)
        assert check['actual'] <= 1000 + 1e-6

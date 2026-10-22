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


def test_empty_cases_nonfinite_and_incorrect_sign_data_rejected(portfolio):
    profiles, _, cases, _ = portfolio
    spec = OptimisationSpec()
    with pytest.raises(ValueError, match='No analytical profile rows'):
        service.prepare_coefficients(profiles.loc[profiles.ID != 1], cases, spec)
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


@pytest.fixture
def sparse_portfolio():
    cases = pd.DataFrame([{'ID': i, 'Case': f'Case {i}', 'Case Name': f'Project {i}',
                          'Country Key': '1', 'Region': 'North' if i == 1 else 'South',
                          'Group Entity': 'Oil' if i == 1 else 'Gas'} for i in [1, 2, 3, 4]])
    raw = pd.DataFrame([
        {'ID': i, 'Case': f'Case {i}', 'Metric': metric, 'Year': year, 'Value': value}
        for i, metric, year, value in [
            (1, 'Pre Tax Cash Flow', 2026, 108), (1, 'Underlying RCOP', 2026, 0),
            (1, 'Cash Capex', 2026, -10), (2, 'Total Production (mboed)', 2027, 20),
            (3, 'Cash Capex', 2028, -5), (4, 'Underlying RCOP', 2027, 30),
        ]])
    rates = pd.DataFrame([{'Country': 'Example', 'Country Key': '1', 'Year': y,
                           'ETR': .2, 'CTR': .2} for y in range(2026, 2029)])
    profiles, _ = calculate_post_tax(raw, cases, rates)
    return profiles, raw, cases, rates


@pytest.mark.parametrize('objective,expected', [
    ('post_tax_npv', 100), ('post_tax_fcf', 108),
    ('underlying_rcop', 30), ('production', 20 * .36525),
])
def test_sparse_metrics_and_years_contribute_zero_and_reconcile(sparse_portfolio, objective, expected):
    before = [frame.copy(deep=True) for frame in sparse_portfolio]
    constraints = (limit(15, year_to=2028),
                   limit(20, id='production', metric='production', basis='each_year', year_to=2028))
    result = service.optimise(*sparse_portfolio, OptimisationSpec(2026, 2028, constraints,
        mandatory_case_ids=(1, 2, 3, 4), objective=objective))
    assert result['status'] == 'optimal' and result['reconciled']
    assert result['objective_value'] == pytest.approx(expected)
    assert result['capex'] == 15
    assert result['production'] == pytest.approx(20 * .36525)
    assert [c['actual'] for c in result['constraint_checks']] == [15, 0, 20, 0]
    rows = {c['id']: c for c in result['cases']}
    assert rows[1]['production'] == 0  # Financial contribution without production.
    assert rows[2]['capex'] == rows[2]['npv'] == 0  # Production without financial rows.
    assert rows[4]['npv'] == 0  # RCOP does not invent a missing cash-flow profile.
    for original, after in zip(before, sparse_portfolio):
        pd.testing.assert_frame_equal(original, after)


@pytest.mark.parametrize('case_id', [1, 2, 3, 4])
def test_sparse_selected_portfolio_can_replay_without_complete_financial_metrics(sparse_portfolio, case_id):
    result = service.optimise(*sparse_portfolio, OptimisationSpec(2026, 2028,
        mandatory_case_ids=(case_id,), excluded_case_ids=tuple(i for i in [1, 2, 3, 4] if i != case_id)))
    assert result['status'] == 'optimal' and result['reconciled']
    assert result['selected_case_ids'] == [case_id]
    assert result['objective_value'] == pytest.approx(100 if case_id == 1 else 0)


def test_sparse_production_mix_includes_financial_only_cases(sparse_portfolio):
    from scenario_modeller.domain.optimisation import MixConstraint
    result = service.optimise(*sparse_portfolio, OptimisationSpec(2026, 2028,
        mix_constraints=(MixConstraint('group_entity', 'Oil', 0, 0), MixConstraint('group_entity', 'Gas', 100, 0))))
    assert result['status'] == 'optimal' and result['reconciled']
    assert {1, 2}.issubset(result['selected_case_ids'])
    assert result['objective_value'] == pytest.approx(100)
    assert [c['actual_share_pct'] for c in result['mix_checks']] == pytest.approx([0, 100])
    assert all(c['satisfied'] for c in result['mix_checks'])


def test_sparse_api_reference_and_solve(sparse_portfolio, monkeypatch):
    monkeypatch.setattr(app_state, 'baseline_diagnostics', [], raising=False)
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], sparse_portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    monkeypatch.setattr(app_state, 'invert_metrics', set(), raising=False)
    client = TestClient(app)
    reference = client.get('/api/portfolio/reference_measure', params={
        'metric': 'Total Production (mboed)', 'year_from': 2026, 'year_to': 2028})
    assert reference.status_code == 200, reference.text
    assert {r['id']: r['value'] for r in reference.json()} == {1: None, 2: 20 * .36525, 3: None, 4: None}
    result = client.post('/api/optimisation/solve', json={'mode': 'mix', 'year_from': 2026, 'year_to': 2028,
        'case_rules': [{'case_id': i, 'rule': 'mandatory'} for i in [1, 2, 3, 4]]})
    assert result.status_code == 200, result.text
    assert result.json()['reconciled']
    assert result.json()['objective_value'] == pytest.approx(100)
    scenario = client.post('/api/scenario/run', json={'instructions': [
        {'id': i, 'case': f'Case {i}', 'include': i == 2, 'operation': 'NoChange'} for i in [1, 2, 3, 4]]})
    assert scenario.status_code == 200, scenario.text
    assert scenario.json()['valid']
    assert [(r['id'], r['metric'], r['year'], r['value']) for r in scenario.json()['results']] == [
        (2, 'Total Production (mboed)', 2027, 20)]


def test_absent_years_still_enforce_annual_minima(sparse_portfolio):
    result = service.optimise(*sparse_portfolio, OptimisationSpec(2026, 2028,
        constraints=(limit(1, metric='production', basis='each_year', operator='min', year_to=2028),)))
    assert result['status'] == 'infeasible'  # No production exists in 2026 or 2028.


def test_period_with_no_profiles_has_zero_contributions(sparse_portfolio):
    result = service.optimise(*sparse_portfolio, OptimisationSpec(2030, 2032, mandatory_case_ids=(1,)))
    assert result['status'] == 'optimal' and result['reconciled']
    assert result['objective_value'] == result['capex'] == result['production'] == 0


def test_portfolio_without_production_can_optimise_finances_but_not_mix(sparse_portfolio):
    from scenario_modeller.domain.optimisation import MixConstraint
    profiles, raw, cases, rates = sparse_portfolio
    financial_only = (profiles.loc[profiles.ID != 2], raw.loc[raw.ID != 2], cases.loc[cases.ID != 2], rates)
    result = service.optimise(*financial_only, OptimisationSpec(2026, 2028))
    assert result['status'] == 'optimal' and result['reconciled']
    assert result['objective_value'] == pytest.approx(100)
    assert result['production'] == 0
    with pytest.raises(ValueError, match='positive reference production'):
        service.optimise(*financial_only, OptimisationSpec(2026, 2028,
            mix_constraints=(MixConstraint('group_entity', 'Oil', 50), MixConstraint('group_entity', 'Gas', 50))))


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


@pytest.fixture
def mix_portfolio(portfolio):
    profiles, raw, cases, rates = portfolio
    cases = cases.assign(**{'Group Entity': ['Oil', 'Gas', 'Oil'], 'Region': ['North', 'South', 'North']})
    return profiles, raw, cases, rates


def share_spec(**kwargs):
    from scenario_modeller.domain.optimisation import MixConstraint
    return OptimisationSpec(2026, 2027, mix_constraints=(
        MixConstraint('group_entity', 'Oil', 65, 5), MixConstraint('group_entity', 'Gas', 35, 5)), **kwargs)


def test_mix_matches_independent_bruteforce_shares(mix_portfolio):
    profiles, _, cases, _ = mix_portfolio
    spec = share_spec()
    result = service.optimise(*mix_portfolio, spec)
    production = {1: 10, 2: 20, 3: 40}
    npv = service.npv_by_case(profiles, 8, 2026, 2027).set_index('ID').NPV.to_dict()
    feasible = []
    for size in range(1, 4):
        for selected in combinations([1, 2, 3], size):
            oil = sum(production[i] for i in selected if i in [1, 3]) / sum(production[i] for i in selected)
            if .60 <= oil <= .70:
                feasible.append(selected)
    best = max(feasible, key=lambda ids: sum(npv[i] for i in ids))
    assert result['selected_case_ids'] == list(best) == [2, 3]
    assert result['reconciled']
    assert result['objective_value'] == pytest.approx(sum(npv[i] for i in best))
    assert result['mix_checks'][0]['actual_share_pct'] == pytest.approx(100 * 40 / 60)
    assert all(c['satisfied'] for c in result['mix_checks'])


def test_region_rules_allow_specific_case_overrides(mix_portfolio):
    from scenario_modeller.domain.optimisation import RegionRule
    spec = OptimisationSpec(2026, 2027, region_rules=(RegionRule('North', 'mandatory'), RegionRule('South', 'excluded')))
    result = service.optimise(*mix_portfolio, spec)
    assert result['selected_case_ids'] == [1, 3]  # Includes loss-making case 3.
    assert result['reconciled']
    overridden = service.optimise(*mix_portfolio, OptimisationSpec(excluded_case_ids=(1,), region_rules=(RegionRule('North', 'mandatory'),)))
    assert overridden['selected_case_ids'] == [2, 3]
    with pytest.raises(ValueError, match='Unknown or duplicate'):
        service.optimise(*mix_portfolio, OptimisationSpec(region_rules=(RegionRule('Atlantis', 'excluded'),)))
    blocked = share_spec(region_rules=(RegionRule('South', 'excluded'),), constraints=(limit(100, flexibility_pct=15),))
    result = service.optimise(*mix_portfolio, blocked)
    assert result['status'] == 'infeasible'
    assert result['selected_case_ids'] == []
    assert not result['reconciled']


def test_mix_rejects_zero_reference_and_cannot_choose_zero_denominator(mix_portfolio):
    from dataclasses import replace
    from scenario_modeller.domain.optimisation import MixConstraint
    profiles, raw, cases, rates = mix_portfolio
    spec = share_spec()
    assert service.optimise(*mix_portfolio, replace(spec, excluded_case_ids=(1, 2, 3)))['status'] == 'infeasible'
    zero = profiles.copy()
    zero.loc[zero.Metric == 'Total Production (mboed)', 'Value'] = 0
    with pytest.raises(ValueError, match='positive reference production'):
        service.optimise(zero, raw, cases, rates, spec)
    # A zero-production, profitable case cannot bypass a production-share policy.
    zero.loc[(zero.ID == 3) & (zero.Metric == 'Total Production (mboed)'), 'Value'] = 40
    broad = replace(spec, mix_constraints=(MixConstraint('group_entity', 'Oil', 50, 50), MixConstraint('group_entity', 'Gas', 50, 50)), excluded_case_ids=(3,))
    assert service.optimise(zero, raw, cases, rates, broad)['status'] == 'infeasible'


def test_mix_uses_selected_period_and_replay_mismatch_blocks_publication(mix_portfolio, monkeypatch):
    from dataclasses import replace
    profiles, raw, cases, rates = mix_portfolio
    raw = raw.copy()
    raw.loc[(raw.ID == 1) & (raw.Metric == 'Total Production (mboed)') & (raw.Year == 2026), 'Value'] = 40
    profiles, _ = calculate_post_tax(raw, cases, rates)
    first = service.optimise(profiles, raw, cases, rates, replace(share_spec(), year_to=2026))
    second = service.optimise(profiles, raw, cases, rates, replace(share_spec(), year_from=2027))
    assert first['selected_case_ids'] == [1, 2]
    assert second['selected_case_ids'] == [2, 3]
    execute = service.execute_scenario
    def incorrect(*args):
        run = execute(*args)
        run.results.loc[run.results.Metric == 'Total Production (mboed)', 'Value'] *= 2
        return run
    monkeypatch.setattr(service, 'execute_scenario', incorrect)
    with pytest.raises(ValueError, match='do not reconcile'):
        service.optimise(*mix_portfolio, share_spec())


@pytest.mark.parametrize('targets', [
    [('Oil', 50), ('Gas', 40)], [('Oil', 60), ('Atlantis', 40)], [('Oil', 100)],
    [('Oil', 30), ('Oil', 30), ('Gas', 40)],
])
def test_invalid_mix_targets_rejected(mix_portfolio, targets):
    from scenario_modeller.domain.optimisation import MixConstraint
    with pytest.raises(ValueError):
        service.optimise(*mix_portfolio, OptimisationSpec(mix_constraints=tuple(MixConstraint('group_entity', key, value) for key, value in targets)))


def test_scoped_constraint_unknown_ids_rejected_and_replay_uses_selected_scope(portfolio):
    with pytest.raises(ValueError, match='Unknown or duplicate scoped'):
        run(portfolio, [limit(100, case_ids=(999,))])
    result = run(portfolio, [limit(60, case_ids=(1, 2, 3))])
    assert result['selected_case_ids'] == [1]
    assert result['reconciled']


@pytest.mark.parametrize('update', [
    {'objective': 'unknown'}, {'mode': 'balanced'},
    {'region_rules': [{'region': 'North', 'rule': 'mandatory'}]},
    {'mode': 'mix', 'mix_constraints': [{'dimension': 'region', 'value': 'North', 'target_share_pct': 101}]},
    {'mode': 'mix', 'mix_constraints': [{'dimension': 'region', 'value': 'North', 'target_share_pct': 50, 'tolerance_pct_points': -1}]},
])
def test_simplified_api_rejects_obsolete_objectives_modes_and_invalid_mix(update):
    with pytest.raises(ValueError):
        OptimisationRequest(**update)


def test_mix_api_returns_verified_share_checks(mix_portfolio, monkeypatch):
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], mix_portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    client = TestClient(app)
    response = client.post('/api/optimisation/solve', json={'mode': 'mix', 'year_from': 2026, 'year_to': 2027,
        'mix_constraints': [{'dimension': 'group_entity', 'value': key, 'target_share_pct': value} for key, value in [('Oil', 65), ('Gas', 35)]]})
    assert response.status_code == 200, response.text
    assert response.json()['selected_case_ids'] == [2, 3]
    assert response.json()['mix_checks'][0]['actual_share_pct'] == pytest.approx(100 * 40 / 60)


@pytest.fixture
def objective_portfolio():
    cases = pd.DataFrame([{'ID': i, 'Case': f'Case {i}', 'Case Name': f'Project {i}',
                           'Country Key': str(i)} for i in range(1, 5)])
    rows, rates = [], []
    for i in range(1, 5):
        for year in [2026, 2040]:
            fcf = {1: 100, 2: 0, 3: 10, 4: 5}[i] if year == 2026 else (200 if i == 2 else 0)
            rcop = {1: 100, 2: 50, 3: 300, 4: 10}[i] if year == 2026 else 0
            production = {1: 10, 2: 20, 3: 30, 4: 80}[i] if year == 2026 else 0
            for metric, value in [('Cash Capex', -.5), ('Total Production (mboed)', production),
                                  ('Pre Tax Cash Flow', fcf), ('Underlying RCOP', rcop)]:
                rows.append(dict(ID=i, Case=f'Case {i}', Metric=metric, Year=year, Value=value))
            rates.append({'Country': f'Country {i}', 'Country Key': str(i), 'Year': year,
                          'ETR': .9 if i == 3 else 0, 'CTR': 0})
    raw, rates = pd.DataFrame(rows), pd.DataFrame(rates)
    profiles, _ = calculate_post_tax(raw, cases, rates)
    return profiles, raw, cases, rates


@pytest.mark.parametrize('objective,selected,value,label,unit', [
    ('post_tax_npv', 1, 100 / 1.08, 'Post-tax NPV', '$m'),
    ('post_tax_fcf', 2, 200, 'Free Cash Flow', '$m'),
    ('underlying_rcop', 3, 300, 'Underlying RCOP', '$m'),
    ('production', 4, 80 * .36525, 'Production', 'mmboe'),
])
def test_each_objective_has_a_distinct_correct_optimum(objective_portfolio, objective, selected, value, label, unit):
    spec = OptimisationSpec(2026, 2040, constraints=(limit(1, year_to=2040),), objective=objective)
    result = service.optimise(*objective_portfolio, spec)
    assert result['status'] == 'optimal'
    assert result['selected_case_ids'] == [selected]
    assert result['objective_value'] == pytest.approx(value)
    assert result['objective_label'] == label
    assert result['objective_unit'] == unit
    assert result['reconciled']
    selected_row = next(c for c in result['cases'] if c['selected'])
    assert selected_row['objective_contribution'] == pytest.approx(value)
    # Legacy NPV fields always remain discounted NPV, even with another objective.
    expected_npvs = {1: 100 / 1.08, 2: 200 / 1.08**15, 3: 10 / 1.08, 4: 5 / 1.08}
    assert selected_row['npv'] == pytest.approx(expected_npvs[selected])
    assert result['reference_npv'] == pytest.approx(sum(expected_npvs.values()))
    assert result['reference_objective_value'] == pytest.approx(sum(c['objective_contribution'] for c in result['cases']))


@pytest.mark.parametrize('objective', ['post_tax_npv', 'post_tax_fcf', 'underlying_rcop', 'production'])
@pytest.mark.parametrize('mode', ['full', 'mix'])
def test_objective_api_in_both_modes(mix_portfolio, monkeypatch, objective, mode):
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], mix_portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    payload = dict(objective=objective, mode=mode, year_from=2026, year_to=2027)
    if mode == 'mix':
        payload['mix_constraints'] = [dict(dimension='group_entity', value=key, target_share_pct=pct)
                                     for key, pct in [('Oil', 65), ('Gas', 35)]]
    response = TestClient(app).post('/api/optimisation/solve', json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['objective'] == objective
    assert result['reconciled']
    assert result['objective_value'] == pytest.approx(sum(c['objective_contribution'] for c in result['cases'] if c['selected']))
    if mode == 'mix':
        assert result['mix_checks'] and all(c['satisfied'] for c in result['mix_checks'])


def test_undiscounted_objective_replay_is_checked(objective_portfolio, monkeypatch):
    execute = service.execute_scenario
    def incorrect(*args):
        result = execute(*args)
        result.results.loc[result.results.Metric == 'Underlying RCOP', 'Value'] += 1
        return result
    monkeypatch.setattr(service, 'execute_scenario', incorrect)
    with pytest.raises(ValueError, match='objective does not reconcile'):
        service.optimise(*objective_portfolio, OptimisationSpec(objective='underlying_rcop'))


@pytest.fixture
def control_portfolio(mix_portfolio):
    profiles, raw, cases, rates = mix_portfolio
    return profiles, raw, cases.assign(Country=['Country A', 'Country A', 'Country B']), rates


def test_region_country_case_precedence_and_explicit_optional(control_portfolio):
    from scenario_modeller.domain.optimisation import RegionRule, CountryRule, CaseRule
    from dataclasses import replace
    spec = OptimisationSpec(2026, 2027, region_rules=(RegionRule('North', 'mandatory'),),
                            country_rules=(CountryRule('North', 'Country B', 'excluded'),))
    assert service.optimise(*control_portfolio, spec)['selected_case_ids'] == [1, 2]
    # A case override can re-include a case excluded by its country.
    included = replace(spec, case_rules=(CaseRule(3, 'mandatory'),))
    assert service.optimise(*control_portfolio, included)['selected_case_ids'] == [1, 2, 3]
    # Country names are scoped to their region: South / Country A stays optional.
    scoped = replace(spec, country_rules=(CountryRule('North', 'Country A', 'excluded'),))
    assert service.optimise(*control_portfolio, scoped)['selected_case_ids'] == [2, 3]
    # Explicit optional clears mandatory inheritance for the loss-making case.
    optional_case = replace(spec, country_rules=(), case_rules=(CaseRule(3, 'optional'),))
    assert service.optimise(*control_portfolio, optional_case)['selected_case_ids'] == [1, 2]
    optional_country = replace(spec, country_rules=(CountryRule('North', 'Country B', 'optional'),))
    assert service.optimise(*control_portfolio, optional_country)['selected_case_ids'] == [1, 2]
    # Removing an override restores its parent's instruction.
    inherited = replace(optional_case, case_rules=())
    assert service.optimise(*control_portfolio, inherited)['selected_case_ids'] == [1, 2, 3]


@pytest.mark.parametrize('kind', ['unknown_country', 'wrong_region', 'duplicate_country', 'unknown_case', 'duplicate_case'])
def test_invalid_hierarchy_rules_rejected(control_portfolio, kind):
    from scenario_modeller.domain.optimisation import CountryRule, CaseRule
    options = {
        'unknown_country': dict(country_rules=(CountryRule('North', 'Unknown Country', 'excluded'),)),
        'wrong_region': dict(country_rules=(CountryRule('South', 'Country B', 'excluded'),)),
        'duplicate_country': dict(country_rules=(CountryRule('North', 'Country A', 'mandatory'), CountryRule('North', 'Country A', 'excluded'))),
        'unknown_case': dict(case_rules=(CaseRule(999, 'excluded'),)),
        'duplicate_case': dict(case_rules=(CaseRule(1, 'mandatory'), CaseRule(1, 'excluded'))),
    }
    with pytest.raises(ValueError, match='Unknown or duplicate'):
        service.optimise(*control_portfolio, OptimisationSpec(**options[kind]))


@pytest.mark.parametrize('controls', [
    dict(mandatory_case_ids=[1]), dict(excluded_case_ids=[1]),
    dict(case_rules=[dict(case_id=1, rule='excluded')]),
    dict(country_rules=[dict(region='North', country='Country A', rule='excluded')]),
])
def test_standard_rejects_advanced_controls(controls):
    with pytest.raises(ValueError, match='Advanced mode'):
        OptimisationRequest(mode='full', **controls)


def test_hierarchy_api_with_country_and_case_overrides(control_portfolio, monkeypatch):
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], control_portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    response = TestClient(app).post('/api/optimisation/solve', json={
        'mode': 'mix', 'objective': 'post_tax_fcf',
        'region_rules': [dict(region='North', rule='mandatory')],
        'country_rules': [dict(region='North', country='Country B', rule='excluded')],
        'case_rules': [dict(case_id=3, rule='mandatory')],
    })
    assert response.status_code == 200, response.text
    assert response.json()['selected_case_ids'] == [1, 2, 3]
    assert response.json()['reconciled']

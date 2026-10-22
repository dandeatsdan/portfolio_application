"""Pure timing alternatives: independent optima, bounds and normal scenario replay."""
from itertools import product
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.state import app_state
from backend.routers.optimisation import OptimisationRequest
from scenario_modeller.domain.optimisation import Constraint, OptimisationSpec, MixConstraint, RegionRule, CaseRule
from scenario_modeller.engine.financials import calculate_post_tax
from scenario_modeller.services import optimisation_service as service


@pytest.fixture
def portfolio():
    cases = pd.DataFrame([{'ID': i, 'Case': f'Case {i}', 'Case Name': f'Project {i}',
        'Country Key': '1', 'Country': 'Example', 'Region': 'North', 'Group Entity': entity}
        for i, entity in [(1, 'Oil'), (2, 'Gas')]])
    raw = pd.DataFrame([{'ID': i, 'Case': f'Case {i}', 'Metric': metric, 'Year': year, 'Value': value}
        for i in [1, 2]
        for metric, year, value in [('Cash Capex', 2028, -100), ('Pre Tax Cash Flow', 2028, -100),
            ('Underlying RCOP', 2028, 0), ('Pre Tax Cash Flow', 2029, 300),
            ('Underlying RCOP', 2029, 300), ('Total Production (mboed)', 2029, i * 10)]])
    rates = pd.DataFrame([{'Country': 'Example', 'Country Key': '1', 'Year': year,
                          'ETR': .1 + (year - 2026) * .05, 'CTR': .1 + (year - 2026) * .05}
                         for year in range(2026, 2041)])
    profiles, _ = calculate_post_tax(raw, cases, rates)
    return profiles, raw, cases, rates


def budget(value=100):
    return Constraint('annual-budget', 'capex', 'each_year', 2026, 2030, 'max', value)


def manual_objective(i, shift, objective):
    # Source cash flows -100 in 2028 and +300 in 2029; tax only the latter.
    cost_year, profit_year = 2028 + shift, 2029 + shift
    cash = 300 * (1 - (.1 + (profit_year - 2026) * .05))
    return {'post_tax_npv': -100 / 1.08 ** (cost_year - 2025) + cash / 1.08 ** (profit_year - 2025),
            'post_tax_fcf': cash - 100, 'underlying_rcop': 300, 'production': i * 10 * .36525}[objective]


@pytest.mark.parametrize('objective', ['post_tax_npv', 'post_tax_fcf', 'underlying_rcop', 'production'])
def test_timing_matches_independent_enumeration_and_preserves_inputs(portfolio, objective):
    before = [frame.copy(deep=True) for frame in portfolio]
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030, (budget(),),
        objective=objective, max_delay_years=1, max_acceleration_years=1))
    feasible = [choices for choices in product([None, -1, 0, 1], repeat=2)
                if all(sum(100 for shift in choices if shift is not None and 2028 + shift == year) <= 100
                       for year in range(2026, 2031))]
    best = max(sum(manual_objective(i, shift, objective) for i, shift in enumerate(choices, 1) if shift is not None)
               for choices in feasible)
    assert result['status'] == 'optimal' and result['reconciled']
    assert result['objective_value'] == pytest.approx(best)
    assert len(result['selected_case_ids']) == len(set(result['selected_case_ids']))
    assert result['reference_objective_value'] == pytest.approx(sum(manual_objective(i, 0, objective) for i in [1, 2]))
    assert result['reference_npv'] == pytest.approx(sum(manual_objective(i, 0, 'post_tax_npv') for i in [1, 2]))
    for original, after in zip(before, portfolio):
        pd.testing.assert_frame_equal(original, after)


def test_delay_avoids_exclusion_under_annual_budget(portfolio):
    base = service.optimise(*portfolio, OptimisationSpec(2026, 2030, (budget(),)))
    assert len(base['selected_case_ids']) == 1
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030, (budget(),), max_delay_years=1))
    assert result['selected_case_ids'] == [1, 2]
    assert {c['year_shift'] for c in result['cases']} == {0, 1}
    assert result['capex'] == 200  # No penalty or additional Capex.
    assert result['objective_value'] > base['objective_value']


def test_acceleration_uses_destination_tax_year_and_fixed_discount_origin(portfolio):
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030, max_acceleration_years=2))
    assert all(c['operation'] == 'Accelerate' and c['year_shift'] == -2 for c in result['cases'])
    assert result['objective_value'] == pytest.approx(2 * (-100 / 1.08 + 300 * .85 / 1.08**2))
    assert result['capex'] == 200


def test_include_exclude_controls_apply_to_cases_not_individual_alternatives(portfolio):
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030,
        region_rules=(RegionRule('North', 'mandatory'),), case_rules=(CaseRule(2, 'excluded'),),
        max_delay_years=1, max_acceleration_years=1))
    assert result['selected_case_ids'] == [1]
    assert result['excluded_case_ids'] == [2]
    assert result['cases'][0]['year_shift'] == -1
    assert result['cases'][1]['year_shift'] == 0


def test_alternatives_cannot_double_count_one_cases_production(portfolio):
    floor = Constraint('floor', 'production', 'total', 2026, 2030, 'min', 11 * .36525, case_ids=(1,))
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030, (floor,),
        max_delay_years=1, max_acceleration_years=1))
    assert result['status'] == 'infeasible'
    assert result['cases'] == []


def test_timing_preserves_flexibility_first_feasible_step(portfolio):
    from dataclasses import replace
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030,
        (replace(budget(99), flexibility_pct=5),), mandatory_case_ids=(1, 2), max_delay_years=1))
    assert result['reconciled'] and result['relaxation_pct'] == 2
    assert [a['status'] for a in result['attempts']] == ['infeasible', 'infeasible', 'optimal']


def test_mix_uses_shifted_production_in_objective_period(portfolio):
    floor = Constraint('gas', 'production', 'total', 2028, 2028, 'min', 20 * .36525, case_ids=(2,))
    result = service.optimise(*portfolio, OptimisationSpec(2028, 2028, (floor,), objective='production',
        max_delay_years=1, max_acceleration_years=1,
        mix_constraints=(MixConstraint('group_entity', 'Oil', 100/3, 0), MixConstraint('group_entity', 'Gas', 200/3, 0))))
    assert result['reconciled']
    assert [c['year_shift'] for c in result['cases']] == [-1, -1]
    assert result['production'] == pytest.approx(30 * .36525)
    assert [c['actual_share_pct'] for c in result['mix_checks']] == pytest.approx([100/3, 200/3])


@pytest.mark.parametrize('boundary,metric,value,delay,acceleration', [
    (2026, 'Cash Capex', -500, 0, 1), (2040, 'Pre Tax Cash Flow', -500, 1, 0),
])
def test_shifts_allow_clipping_nonzero_rows_and_reconcile(portfolio, boundary, metric, value, delay, acceleration):
    _, raw, cases, rates = portfolio
    raw = pd.concat([raw, pd.DataFrame([{'ID': 1, 'Case': 'Case 1', 'Metric': metric, 'Year': boundary, 'Value': value}])], ignore_index=True)
    profiles, _ = calculate_post_tax(raw, cases, rates)
    result = service.optimise(profiles, raw, cases, rates, OptimisationSpec(2026, 2040,
        mandatory_case_ids=(1,), excluded_case_ids=(2,), max_delay_years=delay, max_acceleration_years=acceleration))
    assert result['timing_options_omitted'] == 0
    shift = delay - acceleration
    assert result['cases'][0]['year_shift'] == shift
    assert result['objective_value'] == pytest.approx(manual_objective(1, shift, 'post_tax_npv'))
    assert result['capex'] == 100
    assert result['reconciled']


def test_zero_padding_at_horizon_does_not_block_a_shift(portfolio):
    _, raw, cases, rates = portfolio
    raw = pd.concat([raw, pd.DataFrame([{'ID': 1, 'Case': 'Case 1', 'Metric': 'Cash Capex', 'Year': 2026, 'Value': 0}])], ignore_index=True)
    profiles, _ = calculate_post_tax(raw, cases, rates)
    result = service.optimise(profiles, raw, cases, rates, OptimisationSpec(2026, 2040, max_acceleration_years=1))
    assert result['timing_options_omitted'] == 0
    assert result['cases'][0]['year_shift'] == -1


def test_timing_budget_exhaustion_does_not_publish_partial_alternatives(portfolio, monkeypatch):
    def timeout(*args):
        raise TimeoutError()
    monkeypatch.setattr(service, 'prepare_timing_options', timeout)
    result = service.optimise(*portfolio, OptimisationSpec(max_delay_years=1))
    assert result['status'] == 'time_limit'
    assert not result['reconciled'] and result['cases'] == [] and result['attempts'] == []


def test_shifted_replay_mismatch_withholds_recommendation(portfolio, monkeypatch):
    execute = service.execute_scenario
    calls = 0
    def wrong(*args):
        nonlocal calls
        calls += 1
        result = execute(*args)
        if calls == 2:  # After the one candidate batch, corrupt the final replay only.
            result.results.loc[result.results.Metric == 'Post-Tax Cash Flow', 'Value'] += 100
        return result
    monkeypatch.setattr(service, 'execute_scenario', wrong)
    with pytest.raises(ValueError, match='does not reconcile'):
        service.optimise(*portfolio, OptimisationSpec(max_acceleration_years=1))


@pytest.mark.parametrize('field', ['max_delay_years', 'max_acceleration_years'])
@pytest.mark.parametrize('value', [-1, 15, 1.5, True, '2'])
def test_invalid_timing_limits_rejected(field, value):
    with pytest.raises(ValueError):
        OptimisationRequest(**{field: value})


def test_api_timing_recommendation_replays_as_ordinary_scenario(portfolio, monkeypatch):
    monkeypatch.setattr(app_state, 'baseline_diagnostics', [], raising=False)
    for field, value in zip(['profiles', 'raw_profiles', 'case_listing', 'tax_rates'], portfolio):
        monkeypatch.setattr(app_state, field, value, raising=False)
    client = TestClient(app)
    response = client.post('/api/optimisation/solve', json={'mode': 'mix', 'max_acceleration_years': 1})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['reconciled']
    instructions = [{'id': c['id'], 'case': f"Case {c['id']}", 'include': c['selected'],
                     'operation': c['operation'], 'param1': abs(c['year_shift']),
                     'param2': 0, 'param3': 0, 'param4': 0, 'param5': 0} for c in result['cases']]
    response = client.post('/api/scenario/run', json={'instructions': instructions})
    assert response.status_code == 200, response.text
    assert response.json()['valid']
    output = pd.DataFrame(response.json()['results']).rename(columns={'id': 'ID', 'metric': 'Metric', 'year': 'Year', 'value': 'Value'})
    assert service.npv_by_case(output).NPV.sum() == pytest.approx(result['objective_value'])
    assert sorted(output.loc[output.Metric == 'Cash Capex', 'Value']) == [-100, -100]
    assert set(output.loc[output.Metric == 'Cash Capex', 'Year']) == {2027}
    assert all(all(i[f'param{p}'] == 0 for p in range(2, 6)) for i in response.json()['instructions'])


def test_constraint_case_values_use_selected_shift_and_reconcile_with_portfolio_checks(portfolio):
    total = Constraint('total', 'capex', 'total', 2028, 2028, 'max', 1000)
    annual = Constraint('annual', 'production', 'each_year', 2028, 2029, 'min', 0)
    scoped = Constraint('scoped', 'production', 'total', 2028, 2029, 'min', 0, case_ids=(1,))
    result = service.optimise(*portfolio, OptimisationSpec(2026, 2030, (total, annual, scoped),
        max_acceleration_years=1))
    assert result['reconciled']
    assert all(c['year_shift'] == -1 for c in result['cases'])
    for check in result['constraint_checks']:
        key = (check['id'], check['year_from'], check['year_to'])
        contributions = [v['value'] for c in result['cases'] if c['selected']
                         for v in c['constraint_contributions'] if (v['id'], v['year_from'], v['year_to']) == key]
        assert sum(contributions) == pytest.approx(check['actual'])
    first, second = result['cases']
    assert [v['value'] for v in first['constraint_contributions']] == pytest.approx([0, 10, 0, 10*.36525])
    assert [v['value'] for v in second['constraint_contributions']] == [0, 20, 0, 0]
    assert first['capex'] == 100  # Objective-period total differs from the 2028 constraint value.

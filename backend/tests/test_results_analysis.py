import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.state import app_state
from scenario_modeller.services.comparison_service import build_waterfall


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as client:
        yield client


def data(client):
    cases = client.get('/api/cases').json()[:2]
    def row(i, metric, value, year=2026):
        return dict(id=cases[i]['id'], case=cases[i]['case'], metric=metric, year=year, value=value)
    baseline = [row(0, 'Cash Capex', -100), row(1, 'Cash Capex', -50), row(0, 'Post-Tax Cash Flow', 108), row(0, 'Post-Tax Cash Flow', 116.64, 2027)]
    scenario = [row(0, 'Cash Capex', -120), row(0, 'Post-Tax Cash Flow', 216), row(0, 'Post-Tax Cash Flow', 233.28, 2027)]
    return dict(baseline=baseline, scenario=scenario, metric='Cash Capex')


@pytest.mark.parametrize('group', ['case_name', 'region', 'country', 'plan_type', 'group_entity'])
def test_display_waterfall_reconciles(client, group):
    body = {**data(client), 'kind': 'waterfall', 'group_by': group}
    response = client.post('/api/scenario/analysis', json=body)
    assert response.status_code == 200, response.text
    rows = response.json()['rows']
    assert rows[0]['value'] == 150
    assert rows[-1]['value'] == 120
    assert rows[0]['value'] + sum(r['value'] for r in rows[1:-1]) == pytest.approx(rows[-1]['value'])


def test_profiles_kpis_impacts_share_display_signs(client):
    body = data(client)
    kpis = client.post('/api/scenario/analysis', json={**body, 'kind': 'kpis'}).json()
    assert kpis[1]['baseline'] == .15 and kpis[1]['scenario'] == .12
    assert kpis[1]['unit'] == '$bn'
    profile = client.post('/api/scenario/analysis', json={**body, 'kind': 'profile'}).json()
    assert profile['rows'][0] == dict(year=2026, reference=150, primary=120)
    impact = client.post('/api/scenario/analysis', json={**body, 'kind': 'impact'}).json()
    assert sorted(r['delta'] for r in impact['rows']) == [-50, 20]
    assert sum(r['delta'] for r in impact['rows']) == -30
    assert client.post('/api/scenario/analysis', json={**body, 'kind': 'waterfall', 'year_from': 2028}).json()['rows'][0]['value'] == 0
    empty = client.post('/api/scenario/analysis', json={**body, 'kind': 'kpis', 'case_ids': []}).json()
    assert all(k['scenario'] == 0 and k['delta_pct'] is None for k in empty)


def test_npv_uses_fixed_origin(client):
    body = {**data(client), 'kind': 'impact', 'metric': 'Post-tax NPV', 'year_from': 2027, 'year_to': 2027}
    response = client.post('/api/scenario/analysis', json=body)
    assert response.status_code == 200, response.text
    assert response.json()['rows'][0]['delta'] == pytest.approx(100)
    assert client.post('/api/scenario/analysis', json={**body, 'average': True}).status_code == 422
    assert client.post('/api/scenario/analysis', json={**body, 'kind': 'profile'}).status_code == 422


def test_invalid_settings_rejected(client):
    for overrides in [{'group_by': 'arbitrary'}, {'year_from': 2041}, {'year_from': 2030, 'year_to': 2026}, {'metric': 'invented'}]:
        assert client.post('/api/scenario/analysis', json={**data(client), 'kind': 'waterfall', **overrides}).status_code == 422


def test_case_ids_not_duplicate_display_names():
    listing = pd.DataFrame({'ID': [1, 2], 'Case Name': ['Same', 'Same']})
    baseline = pd.DataFrame({'ID': [1, 2], 'Metric': ['X', 'X'], 'Year': [2026, 2026], 'Value': [100, 50]})
    scenario = baseline.copy(); scenario['Value'] = [120, 0]
    rows = build_waterfall(baseline, scenario, listing, 'X')
    assert rows.Label.tolist() == ['Reference', 'Same (1)', 'Same (2)', 'Scenario']
    assert rows.Value.tolist() == [150, 20, -50, 120]


def test_run_response_keeps_exclusions(client):
    cases = client.get('/api/cases').json()
    response = client.post('/api/scenario/run', json={'instructions': [dict(id=c['id'], case=c['case'], include=i != 0, operation='NoChange') for i, c in enumerate(cases)]})
    assert response.status_code == 200
    rows = response.json()['instructions']
    assert len(rows) == len(cases)
    assert next(r for r in rows if r['id'] == cases[0]['id'])['include'] is False


def test_metrics_helper_controls_all_presentation_without_mutating_raw_values(client, monkeypatch):
    before = app_state.profiles.copy(deep=True)
    raw_before = app_state.raw_profiles.copy(deep=True)
    body = data(client)
    # Changing metadata changes presentation, not hard-coded React sign lists.
    monkeypatch.setattr(app_state, 'invert_metrics', {'Post-Tax Cash Flow'})
    rows = client.post('/api/scenario/analysis', json={**body, 'kind': 'profile', 'metric': 'Post-Tax Cash Flow', 'comparison': body['baseline']}).json()['rows']
    assert rows[0]['reference'] == -108 and rows[0]['primary'] == -216 and rows[0]['comparison'] == -108
    references = client.get('/api/portfolio/reference_measure', params={'metric': 'Post-Tax Cash Flow', 'year_from': 2026, 'year_to': 2026}).json()
    expected = before.loc[(before.Metric == 'Post-Tax Cash Flow') & (before.Year == 2026)].groupby('ID').Value.sum()
    for row in references:
        assert row['value'] == pytest.approx(-expected.loc[row['id']])
    pd.testing.assert_frame_equal(before, app_state.profiles)
    pd.testing.assert_frame_equal(raw_before, app_state.raw_profiles)


def test_production_units_total_vs_average_vs_annual(client):
    body = data(client)
    for rows in [body['baseline'], body['scenario']]:
        for r in rows: r['metric'] = 'Total Production (mboed)'
    body['metric'] = 'Total Production (mboed)'
    total = client.post('/api/scenario/analysis', json={**body, 'kind': 'impact'}).json()
    annual = client.post('/api/scenario/analysis', json={**body, 'kind': 'impact', 'year_to': 2026}).json()
    avg = client.post('/api/scenario/analysis', json={**body, 'kind': 'impact', 'year_to': 2030, 'average': True}).json()
    assert total['unit'] == 'mmboe'
    assert annual['unit'] == avg['unit'] == 'mboed'
    assert sum(r['delta'] for r in total['rows']) == pytest.approx(sum(r['delta'] for r in avg['rows']) * 5 * .36525)

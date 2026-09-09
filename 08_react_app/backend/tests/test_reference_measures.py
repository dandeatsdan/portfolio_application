"""Per-case reference screening reconciled to existing baseline endpoints."""
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.state import app_state

@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client

@pytest.mark.parametrize('metric,column', [('Total Production (mboed)', 'Production'), ('Cash Capex', 'Capex'), ('Post-Tax Cash Flow', 'FCF'), ('Post-tax NPV', 'NPV')])
def test_reference_matches_case_summary(client, metric, column):
    before = app_state.profiles.copy(deep=True)
    for start, end in [(2026, 2040), (2030, 2035)]:
        params = {'year_from': start, 'year_to': end}
        summary = client.get('/api/portfolio/entity_summary', params=params).json()
        response = client.get('/api/portfolio/reference_measure', params={**params, 'metric': metric})
        assert response.status_code == 200, response.text
        values = {row['id']: row['value'] for row in response.json()}
        for row in summary:
            assert values[row['ID']] == pytest.approx(row[column])
    pd.testing.assert_frame_equal(before, app_state.profiles)

@pytest.mark.parametrize('metric', ['Total Production (mboed)', 'Cash Capex', 'Post-Tax RCOP', 'Post-Tax Cash Flow'])
def test_annual_and_five_year_average_match_existing_totals(client, metric):
    totals = {r['case']: r for r in client.get('/api/totals').json() if r['metric'] == metric}
    cases = client.get('/api/cases').json()
    for end, average, column in [(2026, False, 'y2026'), (2030, True, 'average_5y')]:
        response = client.get('/api/portfolio/reference_measure', params={'metric': metric, 'year_to': end, 'average': average})
        assert response.status_code == 200
        values = {r['id']: r['value'] for r in response.json()}
        for case in cases:
            assert values[case['id']] == pytest.approx(totals[case['case']][column])

def test_duplicate_display_names_and_missing_metric(client, monkeypatch):
    listing = app_state.case_listing.copy()
    listing['Case Name'] = 'Same name'
    monkeypatch.setattr(app_state, 'case_listing', listing)
    missing_id = listing.iloc[0]['ID']
    profiles = app_state.profiles
    monkeypatch.setattr(app_state, 'profiles', profiles.loc[~((profiles.ID == missing_id) & (profiles.Metric == 'Cash Capex'))].copy())
    response = client.get('/api/portfolio/reference_measure', params={'metric': 'Cash Capex'})
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == len(listing)
    assert len({r['id'] for r in rows}) == len(listing)
    assert next(r for r in rows if r['id'] == missing_id)['value'] is None
    assert any(r['value'] is not None for r in rows)

@pytest.mark.parametrize('params', [{'metric': 'unknown'}, {'metric': 'Post-tax NPV', 'average': True}, {'metric': 'Cash Capex', 'year_from': 2041}, {'metric': 'Cash Capex', 'year_from': 2035, 'year_to': 2030}])
def test_invalid_requests(client, params):
    assert client.get('/api/portfolio/reference_measure', params=params).status_code == 422

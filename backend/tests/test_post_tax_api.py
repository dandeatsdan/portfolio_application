"""Integration checks against committed representative CSVs, not production data."""
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.state import app_state
from scenario_modeller.engine.financials import DERIVED_METRICS


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def payload(client):
    cases = client.get("/api/cases").json()
    return {"scenario_name": "Parity test", "scenario_description": "NoChange reconciliation",
            "instructions": [{"id": c["id"], "case": c["case"], "include": True, "operation": "NoChange"} for c in cases]}


def test_baseline_metrics_and_totals_exist_before_run(client):
    assert set(DERIVED_METRICS).issubset(client.get("/api/metrics").json())
    totals = client.get("/api/totals").json()
    assert set(DERIVED_METRICS).issubset({r["metric"] for r in totals})
    # Helpers invert display only, preserving negative cash tax in calculation data.
    analytical = app_state.profiles.query('Metric == "Cash Tax Payment"').Value.sum()
    response = client.get("/api/portfolio/kpis", params={"metrics": "Cash Tax Payment"})
    assert response.json()[0]["total"] == pytest.approx(-analytical)


def test_nochange_baseline_scenario_and_npv_agree(client):
    raw = app_state.raw_profiles.copy(deep=True)
    response = client.post("/api/scenario/run", json=payload(client))
    assert response.status_code == 200, response.text
    run = response.json()
    assert run["valid"] and run["scenario_description"] == "NoChange reconciliation"
    cols = ["id", "metric", "year", "value"]
    a = pd.DataFrame(run["baseline"])[cols].sort_values(cols[:3]).reset_index(drop=True)
    b = pd.DataFrame(run["results"])[cols].sort_values(cols[:3]).reset_index(drop=True)
    pd.testing.assert_frame_equal(a, b)
    assert all(f"param{i}" in run["instructions"][0] for i in range(1,6))
    for start in [2026, 2030]:
        valuation = client.post("/api/scenario/valuation", json={"baseline": run["baseline"],
            "scenario": run["results"], "year_from": start}).json()
        assert valuation["delta"] == pytest.approx(0)
        entities = client.get("/api/portfolio/entity_summary", params={"year_from": start}).json()
        assert valuation["scenario"] == pytest.approx(sum(r["NPV"] for r in entities))
    pd.testing.assert_frame_equal(raw, app_state.raw_profiles)


def test_npv_rankings_creaming_and_entity_table_agree(client):
    for start in [2026, 2030]:
        for rate in [0, 8, 12]:
            params = {"year_from": start, "discount_rate": rate}
            ranks = client.get("/api/portfolio/ranked/Post-tax%20NPV", params={**params, "top_n": 9999}).json()
            entities = client.get("/api/portfolio/entity_summary", params=params).json()
            cream = client.get("/api/portfolio/creaming", params=params).json()
            total = sum(r["NPV"] for r in entities)
            assert sum(r["Total"] for r in ranks) == pytest.approx(total)
            assert cream[-1]["Cum NPV"] == pytest.approx(total)
            assert [r["Total"] for r in ranks] == sorted([r["Total"] for r in ranks], reverse=True)
            for dimension in ["country", "region", "group_entity", "plan_type"]:
                grouped = client.get("/api/portfolio/ranked/Post-tax%20NPV",
                                     params={**params, "rank_by": dimension, "top_n": 9999}).json()
                assert sum(r["Total"] for r in grouped) == pytest.approx(total)


def test_failed_run_returns_no_partial_results_or_baseline_mutation(client):
    request = payload(client)
    before = app_state.profiles.copy(deep=True)
    request["instructions"][-1].update(operation="Delay", param1=-1)
    response = client.post("/api/scenario/run", json=request)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["valid"] is False and detail["diagnostics"]
    assert "results" not in detail
    pd.testing.assert_frame_equal(before, app_state.profiles)
    assert client.post("/api/scenario/run", json=payload(client)).status_code == 200


def test_tax_failure_and_reload_preserve_previous_baseline(client, monkeypatch):
    before = app_state.profiles.copy(deep=True)
    from backend import state
    broken = app_state.tax_rates.copy()
    broken.loc[0, "ETR"] = 2
    monkeypatch.setattr(state, "load_tax_rates", lambda _: broken)
    with pytest.raises(ValueError): app_state.load()
    pd.testing.assert_frame_equal(before, app_state.profiles)


@pytest.mark.parametrize("params", [{"discount_rate": -100}, {"discount_rate": "nan"},
                                   {"year_from": 2035, "year_to": 2030}])
def test_invalid_valuation_requests(client, params):
    assert client.get("/api/portfolio/ranked/Post-tax%20NPV", params=params).status_code == 422


def test_empty_selection_and_unknown_case(client):
    assert client.post("/api/scenario/run", json={"instructions": []}).status_code == 422
    request = payload(client)
    request["instructions"][0]["id"] = 999999
    assert client.post("/api/scenario/run", json=request).status_code == 422


def test_filters_and_waterfall_shape(client):
    country = client.get("/api/cases").json()[0]["country"]
    params = {"countries": country, "year_from": 2028}
    entities = client.get("/api/portfolio/entity_summary", params=params).json()
    ranks = client.get("/api/portfolio/ranked/Post-tax%20NPV", params={**params, "top_n":9999}).json()
    assert sum(r["NPV"] for r in entities) == pytest.approx(sum(r["Total"] for r in ranks))
    run = client.post("/api/scenario/run", json=payload(client)).json()
    wf = client.post("/api/scenario/waterfall", json={"baseline":run["baseline"], "scenario":run["results"], "metric":"Post-Tax Cash Flow"})
    assert wf.status_code == 200
    assert {"label", "value", "type"}.issubset(wf.json()[0])

"""Explicit Excel-rule examples plus shared baseline/scenario regression checks."""

import pandas as pd
import pytest

from scenario_modeller.data.loaders import validate_tax_rates
from scenario_modeller.engine.financials import calculate_post_tax, DERIVED_METRICS
from scenario_modeller.services.scenario_service import execute_scenario
from scenario_modeller.services.valuation_service import npv_by_case
from scenario_modeller.services.portfolio_service import add_derived_totals


@pytest.fixture
def inputs():
    cases = pd.DataFrame([{"ID": 1, "Case": "A", "Country Key": " C "},
                          {"ID": 2, "Case": "B", "Country Key": "C"}])
    profiles = pd.DataFrame([
        {"ID": i, "Case": name, "Metric": m, "Year": y, "Value": v}
        for i, name, rcop in [(1, "A", 100.0), (2, "B", -100.0)]
        for y in [2026, 2027]
        for m, v in [("Underlying RCOP", rcop), ("Pre Tax Cash Flow", 100.0)]
    ])
    rates = pd.DataFrame([{"Country": "Example", "Country Key": "C", "Year": 2026, "ETR": .3, "CTR": .2},
                          {"Country": "Example", "Country Key": "C", "Year": 2027, "ETR": .4, "CTR": .25}])
    return profiles, cases, rates


def instruction(case_id=1, operation="NoChange", params=None):
    return {"Scenario": 1, "ID": case_id, "Case": "client label", "Include": True,
            "Operation": operation, **{f"Param{i+1}": p for i, p in enumerate(params or [0]*5)}}


def value(df, metric, case_id=1, year=2026):
    return df.loc[(df.ID == case_id) & (df.Year == year) & (df.Metric == metric), "Value"].item()


def test_excel_arithmetic_and_no_portfolio_netting(inputs):
    profiles, cases, rates = inputs
    out, warnings = calculate_post_tax(*inputs)
    assert not warnings
    assert value(out, "Tax Charge") == -30
    assert value(out, "Cash Tax Payment") == -20
    assert value(out, "Post-Tax RCOP") == 70
    assert value(out, "Post-Tax Cash Flow") == 80
    assert value(out, "Tax Charge", 2) == 0
    assert value(out, "Post-Tax RCOP", 2) == -100
    # RCOP nets to zero, but tax must still be charged to profitable case A.
    assert out.query('Metric == "Tax Charge" and Year == 2026').Value.sum() == -30


def test_zero_rcop_no_tax(inputs):
    profiles, cases, rates = inputs
    profiles.loc[profiles.Metric == "Underlying RCOP", "Value"] = 0
    out, _ = calculate_post_tax(profiles, cases, rates)
    assert value(out, "Cash Tax Payment") == 0
    assert value(out, "Post-Tax Cash Flow") == 100


def test_repeat_safe_and_inputs_unchanged(inputs):
    snapshots = [df.copy(deep=True) for df in inputs]
    first, _ = calculate_post_tax(*inputs)
    second, _ = calculate_post_tax(first, inputs[1], inputs[2])
    keys = ["ID", "Metric", "Year"]
    pd.testing.assert_frame_equal(first.sort_values(keys).reset_index(drop=True),
                                  second.sort_values(keys).reset_index(drop=True))
    assert not second.duplicated(keys).any()
    for before, after in zip(snapshots, inputs):
        pd.testing.assert_frame_equal(before, after)


def test_unmatched_cash_tax_preserves_excel_fallback(inputs):
    profiles, cases, rates = inputs
    profiles = profiles.loc[~((profiles.ID == 1) & (profiles.Year == 2027)
                              & (profiles.Metric == "Underlying RCOP"))]
    out, warnings = calculate_post_tax(profiles, cases, rates)
    assert value(out, "Post-Tax Cash Flow", year=2027) == 100
    assert warnings[0]["code"] == "UNMATCHED_CASH_TAX"
    assert warnings[0]["ID"] == 1 and warnings[0]["Year"] == 2027


@pytest.mark.parametrize("problem", ["missing_rate", "missing_mapping", "duplicate_profile", "duplicate_case", "infinite"])
def test_financial_validation(inputs, problem):
    profiles, cases, rates = inputs
    if problem == "missing_rate": rates = rates.iloc[:1]
    if problem == "missing_mapping": cases = cases.iloc[:1]
    if problem == "duplicate_profile": profiles = pd.concat([profiles, profiles.iloc[:1]])
    if problem == "duplicate_case": cases = pd.concat([cases, cases.iloc[:1]])
    if problem == "infinite": profiles.loc[0, "Value"] = float("inf")
    with pytest.raises(ValueError): calculate_post_tax(profiles, cases, rates)


@pytest.mark.parametrize('metric', ['Underlying RCOP', 'Pre Tax Cash Flow', 'Total Production (mboed)'])
def test_sparse_financial_inputs_derive_only_from_present_source_rows(inputs, metric):
    profiles, cases, rates = inputs
    sparse = profiles.query('ID == 1 and Year == 2026').iloc[:1].copy()
    sparse['Metric'] = metric
    sparse['Value'] = 100.0
    original = sparse.copy(deep=True)
    out, diagnostics = calculate_post_tax(sparse, cases, rates)
    assert set(out.Year) == {2026} and set(out.ID) == {1}
    if metric == 'Underlying RCOP':
        assert value(out, 'Tax Charge') == -30
        assert value(out, 'Post-Tax RCOP') == 70
        assert 'Post-Tax Cash Flow' not in set(out.Metric)
    elif metric == 'Pre Tax Cash Flow':
        assert value(out, 'Post-Tax Cash Flow') == 100
        assert diagnostics[0]['code'] == 'UNMATCHED_CASH_TAX'
        assert 'Post-Tax RCOP' not in set(out.Metric)
    else:
        assert list(out.Metric) == [metric]
        assert not diagnostics
    pd.testing.assert_frame_equal(original, sparse)


@pytest.mark.parametrize("column,bad", [("ETR", 1.5), ("CTR", -0.1), ("CTR", float("inf")),
                                       ("ETR", None), ("Country Key", " "), ("Year", 2026.5), ("Year", None)])
def test_tax_validation(inputs, column, bad):
    rates = inputs[2].astype(object)
    rates.loc[0, column] = bad
    with pytest.raises(ValueError): validate_tax_rates(rates)


def test_tax_duplicate_after_normalisation(inputs):
    rates = inputs[2].copy()
    rates.loc[1, "Year"] = 2026
    rates.loc[1, "Country Key"] = " C "
    with pytest.raises(ValueError, match="duplicate"): validate_tax_rates(rates)


def test_nochange_scenario_equals_baseline(inputs):
    profiles, cases, rates = inputs
    baseline, _ = calculate_post_tax(*inputs)
    run = execute_scenario(profiles, pd.DataFrame([instruction(1), instruction(2)]), cases, rates)
    assert run.valid
    keys = ["ID", "Metric", "Year", "Value"]
    pd.testing.assert_frame_equal(baseline[keys].sort_values(keys[:3]).reset_index(drop=True),
                                  run.results[keys].sort_values(keys[:3]).reset_index(drop=True))
    assert npv_by_case(baseline).NPV.sum() == pytest.approx(npv_by_case(run.results).NPV.sum())


def test_delay_recalculates_using_destination_rate(inputs):
    profiles, cases, rates = inputs
    source = profiles.query('Year == 2026')
    run = execute_scenario(source, pd.DataFrame([instruction(1, "Delay", [1,0,0,0,0])]), cases, rates)
    assert run.valid
    assert value(run.results, "Tax Charge", year=2027) == -40
    assert value(run.results, "Post-Tax Cash Flow", year=2027) == 75


def test_accelerate_recalculates_using_destination_rate(inputs):
    profiles, cases, rates = inputs
    run = execute_scenario(profiles.query('Year == 2027'),
                           pd.DataFrame([instruction(1, "Accelerate", [1,0,0,0,0])]), cases, rates)
    assert run.valid
    assert value(run.results, "Post-Tax Cash Flow") == 80


@pytest.mark.parametrize("rows", [[], [instruction(1), instruction(2, "Delay", [-1,0,0,0,0])],
                                 [instruction(1), instruction(1)], [instruction(99)],
                                 [instruction(1, "TruncateBefore", [2041,0,0,0,0])]])
def test_invalid_run_has_no_publishable_output(inputs, rows):
    run = execute_scenario(inputs[0], pd.DataFrame(rows), inputs[1], inputs[2])
    assert not run.valid and run.results.empty and run.diagnostics


def test_financial_failure_withholds_operation_output(inputs):
    run = execute_scenario(inputs[0], pd.DataFrame([instruction()]), inputs[1], inputs[2].iloc[:1])
    assert not run.valid and run.results.empty


def test_nochange_clears_stale_parameters(inputs):
    run = execute_scenario(inputs[0], pd.DataFrame([instruction(params=[1,2,3,4,5])]), inputs[1], inputs[2])
    assert run.valid and run.instructions[[f"Param{i}" for i in range(1,6)]].eq(0).all(axis=None)
    assert run.instructions.Case.iloc[0] == "A"


def test_totals_keep_existing_metrics_and_fixed_five_year_denominator(inputs):
    enriched, _ = calculate_post_tax(*inputs)
    existing = pd.DataFrame([{"Metric": "Original", "Case": "A", "Total 5Y": 17}])
    totals = add_derived_totals(existing, enriched)
    assert totals.query('Metric == "Original"')["Total 5Y"].item() == 17
    row = totals.query('Metric == "Post-Tax Cash Flow" and Case == "A"').iloc[0]
    assert row["Total 5Y"] == 155 and row["Average 5Y"] == 31
    assert set(DERIVED_METRICS).issubset(totals.Metric)


def test_npv_excel_period_one_and_filter_does_not_rebase(inputs):
    out, _ = calculate_post_tax(*inputs)
    assert npv_by_case(out.query('ID==1')).NPV.item() == pytest.approx(80/1.08 + 75/1.08**2)
    assert npv_by_case(out.query('ID==1'), year_from=2027).NPV.item() == pytest.approx(75/1.08**2)
    assert npv_by_case(out.query('ID==1'), discount_rate=0).NPV.item() == 155


@pytest.mark.parametrize("kwargs", [{"discount_rate": -100}, {"discount_rate": float("nan")},
                                   {"year_from": 2030, "year_to": 2027}])
def test_invalid_valuation(inputs, kwargs):
    out, _ = calculate_post_tax(*inputs)
    with pytest.raises(ValueError): npv_by_case(out, **kwargs)

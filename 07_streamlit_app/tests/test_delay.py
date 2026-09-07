"""
Tests for apply_delay and apply_cash_cost_penalty.

Each test is reconciled to the documented operation behaviour in
004_operations_library.py from the validated Excel application.
"""

import pandas as pd
import pytest

from scenario_modeller.engine.operations import apply_delay, apply_cash_cost_penalty
from scenario_modeller.data.schemas import YEAR_MIN, YEAR_MAX


# ---------------------------------------------------------------------------
# Minimal profile fixture — a small representative case with the metrics
# that apply_cash_cost_penalty and apply_delay depend on.
# ---------------------------------------------------------------------------

CASH_COST_METRICS = [
    "Total Cash Costs",
    "EBITDA",
    "Underlying RCOP",
    "Operating Cashflow",
    "Pre Tax Cash Flow",
]


def _make_profile(years=None, extra_metrics=None):
    """Build a minimal case profile covering the required metrics."""
    if years is None:
        years = list(range(2026, 2031))
    metrics = CASH_COST_METRICS + (extra_metrics or [])
    rows = []
    for metric in metrics:
        for year in years:
            rows.append({"ID": 1, "Case": "TestCase", "Metric": metric, "Year": year, "Value": 100.0})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# apply_delay — basic year shifting
# ---------------------------------------------------------------------------

def test_delay_shifts_years_forward():
    profile = _make_profile(years=[2026, 2027, 2028])
    result = apply_delay(profile, param1=2)
    assert set(result["Year"].unique()) == {2028, 2029, 2030}


def test_delay_zero_returns_copy():
    profile = _make_profile()
    result = apply_delay(profile, param1=0)
    pd.testing.assert_frame_equal(result.reset_index(drop=True), profile.reset_index(drop=True))


def test_delay_clips_rows_beyond_year_max():
    # 2038+2=2040 (kept), 2039+2=2041 (clipped), 2040+2=2042 (clipped)
    profile = _make_profile(years=[2038, 2039, 2040])
    result = apply_delay(profile, param1=2)
    assert result["Year"].max() <= YEAR_MAX
    assert set(result["Year"].unique()) == {2040}


def test_delay_partial_clip():
    profile = _make_profile(years=[2038, 2039, 2040])
    result = apply_delay(profile, param1=1)
    # 2038+1=2039, 2039+1=2040 are kept; 2040+1=2041 is clipped
    assert set(result["Year"].unique()) == {2039, 2040}


def test_delay_row_count_unchanged_when_no_clip():
    profile = _make_profile(years=[2026, 2027, 2028])
    result = apply_delay(profile, param1=3)
    assert len(result) == len(profile)


def test_delay_negative_raises():
    profile = _make_profile()
    with pytest.raises(ValueError, match="positive whole number"):
        apply_delay(profile, param1=-1)


def test_delay_fractional_raises():
    profile = _make_profile()
    with pytest.raises(ValueError, match="whole number"):
        apply_delay(profile, param1=1.5)


def test_delay_none_param1_treated_as_zero():
    profile = _make_profile()
    result = apply_delay(profile, param1=None)
    pd.testing.assert_frame_equal(result.reset_index(drop=True), profile.reset_index(drop=True))


# ---------------------------------------------------------------------------
# apply_cash_cost_penalty — helper function
# ---------------------------------------------------------------------------

def test_penalty_applied_to_existing_year():
    profile = _make_profile(years=[2026, 2027])
    result = apply_cash_cost_penalty(profile, penalty_amount=50, penalty_year=2026)
    for metric in CASH_COST_METRICS:
        penalised = result.loc[(result["Metric"] == metric) & (result["Year"] == 2026), "Value"].iloc[0]
        assert penalised == pytest.approx(100.0 - 50.0)


def test_penalty_creates_new_row_for_missing_year():
    # Profile only has 2028 onwards; penalty booked in 2026 (pre-delay horizon)
    profile = _make_profile(years=[2028, 2029])
    result = apply_cash_cost_penalty(profile, penalty_amount=30, penalty_year=2026)
    for metric in CASH_COST_METRICS:
        new_rows = result.loc[(result["Metric"] == metric) & (result["Year"] == 2026)]
        assert len(new_rows) == 1
        assert new_rows["Value"].iloc[0] == pytest.approx(-30.0)


def test_penalty_zero_amount_no_change():
    profile = _make_profile()
    result = apply_cash_cost_penalty(profile, penalty_amount=0, penalty_year=2026)
    pd.testing.assert_frame_equal(result.reset_index(drop=True), profile.reset_index(drop=True))


def test_penalty_none_amount_no_change():
    profile = _make_profile()
    result = apply_cash_cost_penalty(profile, penalty_amount=None, penalty_year=2026)
    pd.testing.assert_frame_equal(result.reset_index(drop=True), profile.reset_index(drop=True))


def test_penalty_year_outside_horizon_no_change():
    profile = _make_profile()
    result = apply_cash_cost_penalty(profile, penalty_amount=50, penalty_year=2050)
    pd.testing.assert_frame_equal(result.reset_index(drop=True), profile.reset_index(drop=True))


def test_penalty_missing_metric_raises():
    # Profile is missing "EBITDA"
    rows = [{"ID": 1, "Case": "TC", "Metric": "Total Cash Costs", "Year": 2026, "Value": 100.0}]
    profile = pd.DataFrame(rows)
    with pytest.raises(ValueError, match="EBITDA"):
        apply_cash_cost_penalty(profile, penalty_amount=10, penalty_year=2026)


# ---------------------------------------------------------------------------
# apply_delay with penalty — combined path
# ---------------------------------------------------------------------------

def test_delay_with_penalty_end_to_end():
    profile = _make_profile(years=[2026, 2027, 2028])
    result = apply_delay(profile, param1=2, param2=50, param3=2026)
    # Years should shift to 2028, 2029, 2030
    assert set(result["Year"].unique()) >= {2028, 2029, 2030}
    # Penalty year 2026 is outside the shifted profile — new rows created
    for metric in CASH_COST_METRICS:
        penalty_rows = result.loc[(result["Metric"] == metric) & (result["Year"] == 2026)]
        assert len(penalty_rows) == 1
        assert penalty_rows["Value"].iloc[0] == pytest.approx(-50.0)

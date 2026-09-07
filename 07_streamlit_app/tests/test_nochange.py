"""End-to-end tests for the NoChange operation."""

import pandas as pd
import pytest

from scenario_modeller.data.loaders import load_case_listing, load_profiles
from scenario_modeller.engine.scenario_engine import run_scenario


def _all_cases_instructions(case_listing, scenario_id=1):
    instructions = case_listing[["ID", "Case"]].copy()
    instructions["Scenario"] = scenario_id
    instructions["Include"] = True
    instructions["Operation"] = "NoChange"
    for p in ["Param1", "Param2", "Param3", "Param4", "Param5"]:
        instructions[p] = 0.0
    return instructions


def test_nochange_preserves_all_rows(sample_profiles_path, sample_case_listing_path):
    profiles = load_profiles(sample_profiles_path)
    case_listing = load_case_listing(sample_case_listing_path)

    instructions = _all_cases_instructions(case_listing)
    results, errors = run_scenario(profiles, instructions)

    # Only count cases that have profile rows for IDs present in the instruction set
    valid_ids = set(case_listing["ID"])
    expected_rows = len(profiles[profiles["ID"].isin(valid_ids)])

    assert errors == [], f"Unexpected errors: {errors}"
    assert len(results) == expected_rows, (
        f"Row count mismatch: expected {expected_rows}, got {len(results)}"
    )


def test_nochange_values_unchanged(sample_profiles_path, sample_case_listing_path):
    profiles = load_profiles(sample_profiles_path)
    case_listing = load_case_listing(sample_case_listing_path)

    # Use the first case that has profile rows
    ids_with_profiles = set(profiles["ID"].unique())
    first_row = case_listing[case_listing["ID"].isin(ids_with_profiles)].iloc[0]
    first_id = int(first_row["ID"])

    instructions = pd.DataFrame([{
        "Scenario": 1, "ID": first_id, "Case": first_row["Case"],
        "Include": True, "Operation": "NoChange",
        "Param1": 0.0, "Param2": 0.0, "Param3": 0.0, "Param4": 0.0, "Param5": 0.0,
    }])

    results, errors = run_scenario(profiles, instructions)
    assert errors == []

    expected = profiles[profiles["ID"] == first_id]["Value"].sort_values().reset_index(drop=True)
    actual = results["Value"].sort_values().reset_index(drop=True)
    pd.testing.assert_series_equal(actual, expected, check_names=False)


def test_nochange_excluded_case_produces_no_output(sample_profiles_path, sample_case_listing_path):
    profiles = load_profiles(sample_profiles_path)
    case_listing = load_case_listing(sample_case_listing_path)

    first_row = case_listing.iloc[0]
    instructions = pd.DataFrame([{
        "Scenario": 1, "ID": int(first_row["ID"]), "Case": first_row["Case"],
        "Include": False, "Operation": "NoChange",
        "Param1": 0.0, "Param2": 0.0, "Param3": 0.0, "Param4": 0.0, "Param5": 0.0,
    }])

    results, errors = run_scenario(profiles, instructions)
    assert len(results) == 0
    assert errors == []

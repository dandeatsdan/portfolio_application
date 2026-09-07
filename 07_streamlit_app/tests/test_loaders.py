"""Tests for the data loading layer."""

import io
import pytest
import pandas as pd

from scenario_modeller.data.loaders import load_case_listing, load_profiles, load_tax_rates


# ---------------------------------------------------------------------------
# load_case_listing
# ---------------------------------------------------------------------------

def test_load_case_listing_happy_path(sample_case_listing_path):
    df = load_case_listing(sample_case_listing_path)
    assert "ID" in df.columns
    assert "Case" in df.columns
    assert len(df) > 0
    assert df["ID"].is_unique


def test_load_case_listing_missing_column(tmp_path):
    csv = tmp_path / "bad.csv"
    csv.write_text("[Case],[Group Entity]\nA,B\n")
    with pytest.raises(ValueError, match="missing required columns"):
        load_case_listing(csv)


def test_load_case_listing_duplicate_id(tmp_path):
    csv = tmp_path / "dup.csv"
    csv.write_text(
        "[Index],[Case],[Group Entity],[Segment],[Region],[Country],[Plan Type],[Case Name],[Country Key]\n"
        "1,CaseA,GE1,SEG,REG,CNTRY,PT,Case A,CK1\n"
        "1,CaseB,GE1,SEG,REG,CNTRY,PT,Case B,CK1\n"
    )
    with pytest.raises(ValueError, match="duplicate IDs"):
        load_case_listing(csv)


# ---------------------------------------------------------------------------
# load_profiles
# ---------------------------------------------------------------------------

def test_load_profiles_happy_path(sample_profiles_path):
    df = load_profiles(sample_profiles_path)
    assert list(df.columns) == ["ID", "Case", "Metric", "Year", "Value"]
    assert len(df) > 0
    assert not df.duplicated(subset=["ID", "Metric", "Year"]).any()


def test_load_profiles_missing_column(tmp_path):
    csv = tmp_path / "bad.csv"
    csv.write_text("[Year],[Metric],[Case]\n2026,Prod,CaseA\n")  # Value column missing
    with pytest.raises(ValueError, match="missing required columns"):
        load_profiles(csv)


def test_load_profiles_duplicate_key(tmp_path):
    csv = tmp_path / "dup.csv"
    csv.write_text(
        "[Index],[Case],[Metric],[Year],[Value]\n"
        "1,CaseA,Production,2026,100\n"
        "1,CaseA,Production,2026,200\n"
    )
    with pytest.raises(ValueError, match="duplicate ID"):
        load_profiles(csv)


def test_load_profiles_near_zero_reset(tmp_path):
    csv = tmp_path / "nearzero.csv"
    csv.write_text(
        "[Index],[Case],[Metric],[Year],[Value]\n"
        "1,CaseA,Production,2026,1e-10\n"
    )
    df = load_profiles(csv)
    assert df.loc[0, "Value"] == 0.0


# ---------------------------------------------------------------------------
# load_tax_rates
# ---------------------------------------------------------------------------

def test_load_tax_rates_happy_path(sample_tax_rates_path):
    df = load_tax_rates(sample_tax_rates_path)
    assert "Country Key" in df.columns
    assert "ETR" in df.columns
    assert not df.duplicated(subset=["Country Key", "Year"]).any()


def test_load_tax_rates_duplicate_key(tmp_path):
    csv = tmp_path / "dup.csv"
    csv.write_text(
        "[Country],[Country Key],[Year],[ETR],[CTR]\n"
        "CountryA,CK1,2026,0.3,0.25\n"
        "CountryA,CK1,2026,0.3,0.25\n"
    )
    with pytest.raises(ValueError, match="duplicate Country Key"):
        load_tax_rates(csv)

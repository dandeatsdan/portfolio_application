"""Shared test fixtures."""

from pathlib import Path
import pandas as pd
import pytest

SAMPLE_DIR = Path(__file__).parent.parent / "data" / "sample"


@pytest.fixture
def sample_case_listing_path():
    return SAMPLE_DIR / "001_case_listing.csv"


@pytest.fixture
def sample_profiles_path():
    return SAMPLE_DIR / "002_profiles.csv"


@pytest.fixture
def sample_tax_rates_path():
    return SAMPLE_DIR / "003_taxrates.csv"

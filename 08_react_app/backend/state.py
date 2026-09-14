# ========================================================================
# BACKEND REFERENCE STATE — LOAD ONCE, REUSE IN MEMORY
# ========================================================================
#
# Purpose
# -------
# AppState holds the reference datasets needed by API requests. main.py
# calls load during application startup. The data directory is discovered
# from the candidate sibling sample-data paths defined below.
#
# Loading sequence
# ----------------
# 1. Load the case listing and source profile CSVs.
# 2. Strip stale derived financial rows and load country/year tax rates.
# 3. Calculate a fresh post-tax reference portfolio and its diagnostics.
# 4. Load operation metadata and refresh derived five-year totals.
# 5. Read the metrics-helper CSV's Invert=Yes entries for presentation.
# 6. Assign the prepared tables to the shared app_state instance.
# The expensive baseline preparation is done before replacing its stored
# fields, so a failed candidate calculation does not replace the baseline.
#
# The two profile tables are deliberately different
# ------------------------------------------------
# raw_profiles contains the source metrics used for scenario operations.
# profiles includes the freshly derived post-tax reference metrics used
# for portfolio analysis and optimiser coefficients. Both retain analytical
# signs. invert_metrics is a separate set of metric names, used later when
# formatting reporting values on copies of the data.
#
# Memory is not scenario persistence
# ----------------------------------
# This state belongs to one Python process and is rebuilt on restart.
# CSV edits are picked up when load runs again, not on every API request.
# Scenario run inputs arrive in requests; saved definitions live in the
# separate JSON repository. Multiple backend worker processes would each
# have their own AppState instance and in-memory baseline.
# Read data/loaders.py and engine/financials.py to follow data preparation;
# read scenario_repository.py for durable saved scenario definitions.

"""
Application-level state loaded once at startup.

DataFrames are loaded from the sample data directory and held in memory.
The backend is stateless for scenario runs — all inputs come in via POST body.
"""

from pathlib import Path
import pandas as pd

from scenario_modeller.data.loaders import (
    load_case_listing,
    load_profiles,
    load_operations_library,
    load_totals_avgs,
    load_tax_rates,
)
from scenario_modeller.engine.financials import calculate_post_tax, source_profiles
from scenario_modeller.services.portfolio_service import add_derived_totals

# Data lives in the sibling Streamlit app's sample directory.
# Adjust this path if the folder is renamed or moved.
_HERE = Path(__file__).parent
_DATA_CANDIDATES = [
    _HERE.parent.parent / "data" / "real",
    _HERE.parent.parent / "07_streamlit_app" / "data" / "sample",
    _HERE.parent.parent / "07_software_project" / "data" / "sample",
]


def _find_data_dir() -> Path:
    for candidate in _DATA_CANDIDATES:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "Cannot locate sample data directory. "
        "Expected at 07_streamlit_app/data/sample/ or 07_software_project/data/sample/."
    )


class AppState:
    case_listing: pd.DataFrame
    profiles: pd.DataFrame
    ops_library: pd.DataFrame
    totals_avgs: pd.DataFrame
    invert_metrics: set

    def load(self):
        data_dir = _find_data_dir()
        # Build a complete candidate before replacing an existing valid baseline.
        cases = load_case_listing(data_dir / "001_case_listing.csv")
        raw = source_profiles(load_profiles(data_dir / "002_profiles.csv"))
        tax_rates = load_tax_rates(data_dir / "003_taxrates.csv")
        enriched, diagnostics = calculate_post_tax(raw, cases, tax_rates)
        ops = load_operations_library(data_dir / "005_operations_library.csv")
        totals = add_derived_totals(load_totals_avgs(data_dir / "004_totals_avgs.csv"), enriched)
        metrics_helper       = pd.read_csv(data_dir / "006_metrics_helper.csv", dtype=str)
        metrics_helper.columns = metrics_helper.columns.str.strip()
        metrics_helper["Metric"] = metrics_helper["Metric"].str.strip()
        metrics_helper["Invert"] = metrics_helper["Invert"].str.strip()
        self.invert_metrics  = set(
            metrics_helper.loc[metrics_helper["Invert"] == "Yes", "Metric"]
        )
        self.case_listing = cases
        self.raw_profiles = raw
        self.tax_rates = tax_rates
        self.profiles = enriched
        self.baseline_diagnostics = diagnostics
        self.ops_library = ops
        self.totals_avgs = totals


app_state = AppState()

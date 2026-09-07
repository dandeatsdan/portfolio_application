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
)

# Data lives in the sibling Streamlit app's sample directory.
# Adjust this path if the folder is renamed or moved.
_HERE = Path(__file__).parent
_DATA_CANDIDATES = [
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

    def load(self):
        data_dir = _find_data_dir()
        self.case_listing = load_case_listing(data_dir / "001_case_listing.csv")
        self.profiles     = load_profiles(data_dir / "002_profiles.csv")
        self.ops_library  = load_operations_library(data_dir / "005_operations_library.csv")
        self.totals_avgs  = load_totals_avgs(data_dir / "004_totals_avgs.csv")


app_state = AppState()

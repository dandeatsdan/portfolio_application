# ========================================================================
# DATA LOADERS — CSV FILES INTO THE TABLES USED BY PYTHON
# ========================================================================
#
# Purpose and flow
# ----------------
# Read reference CSV files into pandas DataFrames (tables in memory),
# normalise column names and apply the dataset-specific checks below.
# backend/state.py calls these loaders when the React API starts.
# The loaders do not run a scenario or apply presentation sign inversion.
#
# The main datasets
# -----------------
# - Case listing: identities and descriptive dimensions; ID must be unique.
# - Profiles: tall rows with ID, Case, Metric, Year, Value. Each
#   ID / Metric / Year combination must occur at most once.
# - Tax rates: Country Key / Year with ETR and CTR fractions in [0, 1].
#   The country/year key must be unique.
# - Operations library: operation descriptions and labelled input slots.
# - Totals/averages: a wide table containing year and aggregation columns.
# Required column lists are defined in data/schemas.py.
#
# Cleaning is specific to each loader
# ----------------------------------
# The core loaders remove surrounding whitespace and DAX-style column
# brackets, and the case/profile loaders accept Index as an alias for ID.
# The case loader drops rows with nonnumeric IDs before converting to int.
# The profile loader coerces invalid/blank Values to zero and resets tiny
# absolute values below TOLERANCE to zero. That is a deliberate existing
# input convention, not evidence that the original CSV contained a zero.
# The operations and totals loaders are lighter wrappers; they do not
# perform all the checks used by the profile or tax loaders.
# Financialisation adds further identity, finite-value and horizon checks.
#
# Helper functions
# ----------------
# get_param_spec reads active labels and Required flags from the operations
# CSV, skipping empty/n/a slots. It supplies form metadata, not all the
# business validation rules for an operation.
# lookup_value finds a Case/Metric row and reads a requested year or total,
# returning None when no value is available. It resembles an Excel lookup.
# validate_tax_rates also accepts an in-memory table, allowing callers to
# apply the same country/year/rate checks without reading another file.
#
# When investigating unexpected values, start with the CSV, then these
# cleaning steps, then engine/financials.py. A successful CSV read alone
# does not establish that the complete portfolio can be financialised.

"""
CSV loaders for the three core input datasets.

Each function validates structure and data quality, raising ValueError with a
descriptive message on failure. Logic mirrors 002_dataframe_setup.py from the
validated Excel application but has no Excel dependencies.
"""

from pathlib import Path

import pandas as pd
import numpy as np

from scenario_modeller.data.schemas import (
    CASE_LISTING_REQUIRED,
    PROFILES_REQUIRED,
    TAX_RATES_REQUIRED,
)

TOLERANCE = 1e-9


def _strip_brackets(df: pd.DataFrame) -> pd.DataFrame:
    """Remove DAX-style [ ] brackets from column names."""
    df.columns = [c.strip().strip("[]") for c in df.columns]
    return df


def load_case_listing(path: str | Path) -> pd.DataFrame:
    """
    Load and validate the modelling case listing.

    Returns a DataFrame with columns matching CASE_LISTING_REQUIRED.
    Raises ValueError if required columns are missing or IDs are not unique.
    """
    df = pd.read_csv(path)
    df = _strip_brackets(df)

    if "Index" in df.columns and "ID" not in df.columns:
        df = df.rename(columns={"Index": "ID"})

    missing = [c for c in CASE_LISTING_REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"case_listing: missing required columns: {missing}")

    df = df[CASE_LISTING_REQUIRED + [c for c in df.columns if c not in CASE_LISTING_REQUIRED]]

    df["ID"] = pd.to_numeric(df["ID"], errors="coerce")
    df = df.dropna(subset=["ID"])
    df["ID"] = df["ID"].astype(int)

    duplicates = df[df.duplicated(subset=["ID"], keep=False)]
    if not duplicates.empty:
        ids = duplicates["ID"].unique().tolist()
        raise ValueError(f"case_listing: duplicate IDs found: {ids}")

    return df.reset_index(drop=True)


def load_profiles(path: str | Path) -> pd.DataFrame:
    """
    Load and validate the financial/production profiles.

    Returns a tall DataFrame with columns: ID, Case, Metric, Year, Value.
    Raises ValueError if required columns are missing or ID×Metric×Year is not unique.
    """
    df = pd.read_csv(path)
    df = _strip_brackets(df)

    if "Index" in df.columns and "ID" not in df.columns:
        df = df.rename(columns={"Index": "ID"})

    missing = [c for c in PROFILES_REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"profiles: missing required columns: {missing}")

    df = df[PROFILES_REQUIRED].copy()

    df["ID"] = pd.to_numeric(df["ID"], errors="coerce").astype("Int64")
    df["Year"] = pd.to_numeric(df["Year"], errors="coerce").astype("Int64")
    df["Value"] = pd.to_numeric(df["Value"], errors="coerce").fillna(0.0)

    # Reset near-zero floats to exactly 0
    df.loc[df["Value"].abs() < TOLERANCE, "Value"] = 0.0

    duplicates = df[df.duplicated(subset=["ID", "Metric", "Year"], keep=False)]
    if not duplicates.empty:
        count = len(duplicates)
        raise ValueError(f"profiles: {count} duplicate ID×Metric×Year rows found")

    return df.reset_index(drop=True)


def load_operations_library(path: str | Path) -> pd.DataFrame:
    """
    Load the operations reference library.

    Returns a DataFrame with one row per operation containing its category,
    description, and up to five labelled parameter slots.
    """
    return pd.read_csv(path)


def get_param_spec(ops_library: pd.DataFrame, operation_name: str) -> list[dict]:
    """
    Return the active parameter slots for a given operation.

    Filters out n/a slots and returns a list of dicts:
        [{"label": str, "required": bool}, ...]

    Returns an empty list for No Change or unknown operations.
    """
    row = ops_library[ops_library["Operation"] == operation_name]
    if row.empty:
        return []

    row = row.iloc[0]
    params = []
    for i in range(1, 6):
        label_raw = row.get(f"Input {i} Label", None)
        required_raw = str(row.get(f"Input {i} Required", "-")).strip()
        # Skip slots where the label is missing, NaN, "n/a", or "-"
        if label_raw is None:
            continue
        label = str(label_raw).strip()
        if label.lower() in ("n/a", "nan", "-", ""):
            continue
        params.append({"label": label, "required": required_raw == "Yes"})
    return params


def load_totals_avgs(path: str | Path) -> pd.DataFrame:
    """
    Load the totals and averages reference dataset.

    Returns a DataFrame with columns: Metric, Case, Total 5Y, Average 5Y,
    and one column per planning year (2026–2030).
    """
    df = pd.read_csv(path)
    df.columns = [c.strip().strip("[]") for c in df.columns]
    return df


def lookup_value(
    totals_avgs: pd.DataFrame,
    case_name: str,
    metric: str,
    year_or_agg: str,
) -> float | None:
    """
    Return a single value from the totals/avgs dataset.

    Equivalent to the Excel XLOOKUP helper cells on the scenario configuration sheet.

    Parameters
    ----------
    case_name : str
        The Case column value (e.g. "Project Blue Horizon |Main Plan").
    metric : str
        The Metric column value (e.g. "Pre Tax Cash Flow").
    year_or_agg : str
        Either a specific year string ("2026") or an aggregation ("Total 5Y", "Average 5Y").

    Returns None if no matching row is found or the column does not exist.
    """
    mask = (totals_avgs["Case"] == case_name) & (totals_avgs["Metric"] == metric)
    rows = totals_avgs.loc[mask]
    if rows.empty or year_or_agg not in rows.columns:
        return None
    val = rows.iloc[0][year_or_agg]
    return None if pd.isna(val) else float(val)


def load_tax_rates(path: str | Path) -> pd.DataFrame:
    """
    Load and validate tax rates.

    Returns a DataFrame with columns matching TAX_RATES_REQUIRED.
    Raises ValueError if required columns are missing or Country Key×Year is not unique.
    """
    df = pd.read_csv(path)
    df = _strip_brackets(df)

    return validate_tax_rates(df)


def validate_tax_rates(df: pd.DataFrame) -> pd.DataFrame:
    """Validate CSV or in-memory tax assumptions without changing the input."""

    missing = [c for c in TAX_RATES_REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"tax_rates: missing required columns: {missing}")

    df = df[TAX_RATES_REQUIRED].copy()

    for col in ["Country", "Country Key"]:
        df[col] = df[col].astype("string").str.strip().replace("", pd.NA)
    years = pd.to_numeric(df["Year"], errors="coerce")
    if years.isna().any() or not np.isfinite(years).all() or (years % 1 != 0).any():
        raise ValueError("tax_rates: Year must contain finite whole years")
    df["Year"] = years.astype(int)
    df["ETR"] = pd.to_numeric(df["ETR"], errors="coerce")
    df["CTR"] = pd.to_numeric(df["CTR"], errors="coerce")

    if df[["Country Key", "Year", "ETR", "CTR"]].isna().any(axis=None):
        raise ValueError("tax_rates: incomplete country/year/rate records")
    if not df["ETR"].between(0, 1).all() or not df["CTR"].between(0, 1).all():
        raise ValueError("tax_rates: ETR and CTR must be between 0 and 1")

    duplicates = df[df.duplicated(subset=["Country Key", "Year"], keep=False)]
    if not duplicates.empty:
        count = len(duplicates)
        raise ValueError(f"tax_rates: {count} duplicate Country Key×Year rows found")

    return df.reset_index(drop=True)

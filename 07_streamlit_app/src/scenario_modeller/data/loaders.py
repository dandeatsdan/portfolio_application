"""
CSV loaders for the three core input datasets.

Each function validates structure and data quality, raising ValueError with a
descriptive message on failure. Logic mirrors 002_dataframe_setup.py from the
validated Excel application but has no Excel dependencies.
"""

from pathlib import Path

import pandas as pd

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

    missing = [c for c in TAX_RATES_REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"tax_rates: missing required columns: {missing}")

    df = df[TAX_RATES_REQUIRED].copy()

    df["Year"] = pd.to_numeric(df["Year"], errors="coerce").astype("Int64")
    df["ETR"] = pd.to_numeric(df["ETR"], errors="coerce")
    df["CTR"] = pd.to_numeric(df["CTR"], errors="coerce")

    duplicates = df[df.duplicated(subset=["Country Key", "Year"], keep=False)]
    if not duplicates.empty:
        count = len(duplicates)
        raise ValueError(f"tax_rates: {count} duplicate Country Key×Year rows found")

    return df.reset_index(drop=True)

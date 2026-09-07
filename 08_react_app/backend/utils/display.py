"""
Display-layer utilities.

Inversion is applied only when shaping data for reporting endpoints.
Raw app_state.profiles must never be mutated.
"""

import pandas as pd


def to_display(df: pd.DataFrame, invert_metrics: set) -> pd.DataFrame:
    """Return a copy of df with sign-inverted values for reporting metrics."""
    out = df.copy()
    mask = out["Metric"].isin(invert_metrics)
    out.loc[mask, "Value"] = out.loc[mask, "Value"] * -1
    return out

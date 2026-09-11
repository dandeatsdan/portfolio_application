# ========================================================================
# DISPLAY SIGN CONVERSION — FORMAT A COPY, KEEP THE FINANCIALS INTACT
# ========================================================================
#
# The metrics-helper CSV identifies metrics whose chart/table signs should
# be reversed. to_display copies the supplied DataFrame and multiplies
# Value by -1 only for matching Metric names.
#
# Example: analytical Cash Capex of -100 can be displayed as +100 of spend.
# The original -100 stays available for financial calculations. A positive
# Capex credit becomes negative spend; this is sign inversion, not abs().
#
# Apply this once at the reporting boundary. Applying it twice reverses the
# first conversion. It does not change units, calculate tax, discount cash
# flows or infer whether an increase is good. Callers must pass raw signed
# profiles to financialisation and valuation instead of this display copy.

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

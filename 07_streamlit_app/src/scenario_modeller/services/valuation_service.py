# ========================================================================
# VALUATION SERVICE — ONE CONSISTENT NPV CALCULATION
# ========================================================================
#
# Purpose
# -------
# Convert annual Post-Tax Cash Flow into a net present value for each case.
# This shared function keeps the Portfolio Viewer, scenario analysis and
# optimiser on the same valuation basis.
#
# Inputs and output
# -----------------
# npv_by_case takes a profile DataFrame, discount rate and inclusive year
# range. It returns ID and NPV, also grouped by Scenario when that column
# is present. Values are in the cash-flow source units (normally $m).
# The rate is entered as a percentage: 8 means 8%, not 0.08%.
# valuation_basis returns metadata describing the calculation for callers.
#
# The formula, step by step
# -------------------------
# For each selected year's cash flow:
#   period = Year - 2026 + 1
#   present value = cash flow / (1 + discount_rate / 100) ** period
# Then sum those present values for each case (and scenario, if supplied).
# At 8%, $108m in 2026 contributes $100m of NPV: 108 / 1.08.
#
# The valuation origin stays fixed
# -------------------------------
# 2026 is period 1, not period 0. If the user selects 2028–2030, the
# calculation uses periods 3–5. Changing the visible year range does not
# reset 2028 to period 1. This matters when comparing filtered results.
# The default discount rate is 8%; callers can supply another valid rate.
#
# Checks and edge cases
# ---------------------
# Years must be within the model horizon and in order. The rate must be
# finite and greater than -100%. Duplicate case/year cash-flow rows and
# non-finite cash flows or calculated values are rejected.
# Missing years make no contribution; the service does not invent a cash
# flow for them. An empty selected dataset returns an empty result table.
#
# Financial signs and responsibilities
# -----------------------------------
# Supply the true signed post-tax cash flows. This service neither applies
# CSV display inversion nor calculates tax. It does not sum a pre-existing
# Excel NPV column, and NPV is not an annual average metric.
# Read engine/financials.py for how Post-Tax Cash Flow is derived, then
# npv_by_case below for the discounting and grouping steps.

"""One post-tax valuation basis for rankings, creaming, and scenario comparisons."""

import math
import numpy as np
import pandas as pd

from scenario_modeller.data.schemas import YEAR_MIN, YEAR_MAX
from scenario_modeller.engine.financials import POST_TAX_FCF

NPV_METRIC = "Post-tax NPV"
DEFAULT_DISCOUNT_RATE = 8.0  # percentage, like the API
VALUATION_BASE_YEAR = 2026


def valuation_basis(discount_rate: float = DEFAULT_DISCOUNT_RATE) -> dict:
    if not math.isfinite(discount_rate) or discount_rate <= -100:
        raise ValueError("Discount rate must be finite and greater than -100%")
    return {"metric": POST_TAX_FCF, "discount_rate": discount_rate,
            "base_year": VALUATION_BASE_YEAR, "first_period": 1}


def npv_by_case(profiles: pd.DataFrame, discount_rate: float = DEFAULT_DISCOUNT_RATE,
                year_from: int = YEAR_MIN, year_to: int = YEAR_MAX) -> pd.DataFrame:
    """Sum selected annual cash flows discounted to a fixed 2026 period-1 basis."""
    valuation_basis(discount_rate)
    if not YEAR_MIN <= year_from <= year_to <= YEAR_MAX:
        raise ValueError("Invalid valuation year range")
    keys = (["Scenario"] if "Scenario" in profiles else []) + ["ID"]
    fcf = profiles.loc[(profiles["Metric"] == POST_TAX_FCF)
                       & profiles["Year"].between(year_from, year_to)].copy()
    if fcf.duplicated([*keys, "Year"]).any():
        raise ValueError("Duplicate post-tax cash-flow rows for valuation")
    if not np.isfinite(fcf["Value"]).all():
        raise ValueError("Non-finite post-tax cash flow")
    periods = fcf["Year"] - VALUATION_BASE_YEAR + 1
    fcf["NPV"] = fcf["Value"] / ((1 + discount_rate / 100) ** periods)
    if not np.isfinite(fcf["NPV"]).all():
        raise ValueError("Non-finite discounted cash flow")
    return fcf.groupby(keys, as_index=False)["NPV"].sum()

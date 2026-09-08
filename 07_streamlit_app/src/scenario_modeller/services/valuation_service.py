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

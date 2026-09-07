"""
Scenario operation functions.

Each function receives a DataFrame slice for one modelling case (columns:
ID, Case, Metric, Year, Value) and returns a transformed copy. Parameters
map to Param1–Param5 from the scenario instructions.

Source: 004_operations_library.py from the validated Excel application.
All operations reconciled to the validated implementation.
"""

import pandas as pd

from scenario_modeller.data.schemas import YEAR_MAX, YEAR_MIN


# ── NoChange ──────────────────────────────────────────────────────────────

def apply_nochange(df: pd.DataFrame, *_) -> pd.DataFrame:
    return df.copy()


# ── Delay helpers ─────────────────────────────────────────────────────────

def apply_cash_cost_penalty(
    df: pd.DataFrame,
    penalty_amount=None,
    penalty_year=None,
) -> pd.DataFrame:
    """Apply a one-off cash-cost penalty to a delayed profile."""
    result = df.copy()

    if pd.isna(penalty_amount) or float(penalty_amount) == 0:
        return result
    if pd.isna(penalty_year) or int(penalty_year) == 0:
        return result

    penalty_year = int(penalty_year)
    if penalty_year < YEAR_MIN or penalty_year > YEAR_MAX:
        return result

    penalty_delta = -abs(float(penalty_amount))

    impacted_metrics = [
        "Total Cash Costs",
        "EBITDA",
        "Underlying RCOP",
        "Operating Cashflow",
        "Pre Tax Cash Flow",
    ]

    new_rows = []
    for metric in impacted_metrics:
        metric_mask = result["Metric"] == metric
        metric_rows = result.loc[metric_mask]
        if metric_rows.empty:
            raise ValueError(f"Metric '{metric}' does not exist in the case profile.")
        penalty_year_mask = metric_mask & (result["Year"] == penalty_year)
        matching = int(penalty_year_mask.sum())
        if matching > 1:
            raise ValueError(
                f"Expected no more than one '{metric}' row for {penalty_year}, but found {matching}."
            )
        if matching == 0:
            new_row = metric_rows.iloc[[0]].copy()
            new_row["Year"] = penalty_year
            new_row["Value"] = 0.0
            new_rows.append(new_row)

    if new_rows:
        result = pd.concat([result, *new_rows], ignore_index=True)

    impact_mask = result["Metric"].isin(impacted_metrics) & (result["Year"] == penalty_year)
    result.loc[impact_mask, "Value"] = result.loc[impact_mask, "Value"].fillna(0) + penalty_delta
    return result


# ── Delay ─────────────────────────────────────────────────────────────────

def apply_delay(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Delay the profile and optionally apply a one-off Cash Costs penalty."""
    result = df.copy()
    delay_years = float(param1) if pd.notna(param1) else 0
    if delay_years < 0:
        raise ValueError("Delay years must be zero or a positive whole number.")
    if not delay_years.is_integer():
        raise ValueError("Delay years must be entered as a whole number.")
    delay_years = int(delay_years)
    result["Year"] = result["Year"] + delay_years
    result = result.loc[result["Year"] <= YEAR_MAX].copy()
    result = apply_cash_cost_penalty(df=result, penalty_amount=param2, penalty_year=param3)
    return result


# ── Accelerate helpers ────────────────────────────────────────────────────

def apply_acceleration_capex(
    df: pd.DataFrame,
    capex_amount=None,
    capex_year=None,
) -> pd.DataFrame:
    """Apply a one-off incremental CAPEX associated with accelerating a case."""
    result = df.copy()
    if pd.isna(capex_amount) or float(capex_amount) == 0:
        return result
    if pd.isna(capex_year) or int(capex_year) == 0:
        return result
    capex_year = int(capex_year)
    if capex_year < YEAR_MIN or capex_year > YEAR_MAX:
        return result

    capex_delta = -abs(float(capex_amount))
    impacted_metrics = ["Cash Capex", "Pre Tax Cash Flow"]
    new_rows = []

    for metric in impacted_metrics:
        metric_mask = result["Metric"] == metric
        metric_rows = result.loc[metric_mask]
        if metric_rows.empty:
            raise ValueError(f"Metric '{metric}' does not exist in the case profile.")
        capex_year_mask = metric_mask & (result["Year"] == capex_year)
        matching = int(capex_year_mask.sum())
        if matching > 1:
            raise ValueError(
                f"Expected no more than one '{metric}' row for {capex_year}, but found {matching}."
            )
        if matching == 0:
            new_row = metric_rows.iloc[[0]].copy()
            new_row["Year"] = capex_year
            new_row["Value"] = 0.0
            new_rows.append(new_row)

    if new_rows:
        result = pd.concat([result, *new_rows], ignore_index=True)

    impact_mask = result["Metric"].isin(impacted_metrics) & (result["Year"] == capex_year)
    result.loc[impact_mask, "Value"] = result.loc[impact_mask, "Value"].fillna(0) + capex_delta
    return result


# ── Accelerate ────────────────────────────────────────────────────────────

def apply_accelerate(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Accelerate the profile and optionally apply one-off incremental CAPEX."""
    result = df.copy()
    accelerate_years = float(param1) if pd.notna(param1) else 0
    if accelerate_years < 0:
        raise ValueError("Acceleration years must be zero or a positive whole number.")
    if not accelerate_years.is_integer():
        raise ValueError("Acceleration years must be entered as a whole number.")
    accelerate_years = int(accelerate_years)
    result["Year"] = result["Year"] - accelerate_years
    result = result.loc[result["Year"] >= YEAR_MIN].copy()
    result = apply_acceleration_capex(df=result, capex_amount=param2, capex_year=param3)
    return result


# ── Increase (Farm-In) helpers ────────────────────────────────────────────

def apply_farm_in_payment(
    df: pd.DataFrame,
    payment_amount=None,
    payment_year=None,
    template_df=None,
) -> pd.DataFrame:
    """Apply a one-off payment associated with a farm-in transaction."""
    result = df.copy()
    if pd.isna(payment_amount) or float(payment_amount) == 0:
        return result
    if pd.isna(payment_year) or int(payment_year) == 0:
        return result
    payment_year = int(payment_year)
    if payment_year < YEAR_MIN or payment_year > YEAR_MAX:
        return result

    payment_delta = -abs(float(payment_amount))
    impacted_metrics = ["Cash Capex", "Pre Tax Cash Flow"]
    template = template_df.copy() if template_df is not None else result.copy()
    if template.empty:
        raise ValueError("Cannot create farm-in payment rows: no case profile template available.")

    new_rows = []
    for metric in impacted_metrics:
        mask = (result["Metric"] == metric) & (result["Year"] == payment_year)
        matching = int(mask.sum())
        if matching > 1:
            raise ValueError(
                f"Expected no more than one '{metric}' row for {payment_year}, but found {matching}."
            )
        if matching == 0:
            metric_template = template.loc[template["Metric"] == metric]
            new_row = (metric_template.iloc[[0]] if not metric_template.empty else template.iloc[[0]]).copy()
            new_row["Metric"] = metric
            new_row["Year"] = payment_year
            new_row["Value"] = 0.0
            new_rows.append(new_row)

    if new_rows:
        result = pd.concat([result, *new_rows], ignore_index=True)

    impact_mask = result["Metric"].isin(impacted_metrics) & (result["Year"] == payment_year)
    result.loc[impact_mask, "Value"] = result.loc[impact_mask, "Value"].fillna(0) + payment_delta
    return result


# ── Increase ──────────────────────────────────────────────────────────────

def apply_increase(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Increase ownership-related profile and optionally apply a one-off farm-in payment."""
    original_profile = df.copy()
    result = df.copy()
    if pd.isna(param1):
        return result
    increase_fraction = float(param1)
    if increase_fraction < 0:
        raise ValueError("Farm-in percentage cannot be negative.")

    start_year = int(param2) if pd.notna(param2) and param2 != 0 else int(result["Year"].min())
    end_year   = int(param3) if pd.notna(param3) and param3 != 0 else int(result["Year"].max())
    if start_year > end_year:
        raise ValueError("Farm-in start year cannot be after the end year.")

    mask = (result["Year"] >= start_year) & (result["Year"] <= end_year)
    result.loc[mask, "Value"] = result.loc[mask, "Value"] * (1 + increase_fraction)
    result = apply_farm_in_payment(
        df=result, payment_amount=param4, payment_year=param5, template_df=original_profile
    )
    return result


# ── Dilution (Farm-Down) helpers ──────────────────────────────────────────

def apply_dilution_proceeds(
    df: pd.DataFrame,
    proceeds_amount=None,
    proceeds_year=None,
    template_df=None,
) -> pd.DataFrame:
    """Apply one-off proceeds from a farm-down or disposal."""
    result = df.copy()
    if pd.isna(proceeds_amount) or float(proceeds_amount) == 0:
        return result
    if pd.isna(proceeds_year) or int(proceeds_year) == 0:
        return result
    proceeds_year = int(proceeds_year)
    if proceeds_year < YEAR_MIN or proceeds_year > YEAR_MAX:
        return result

    proceeds_delta = abs(float(proceeds_amount))
    impacted_metrics = ["Cash Flow from Sale of Operations", "Pre Tax Cash Flow"]
    template = template_df.copy() if template_df is not None else result.copy()
    if template.empty:
        raise ValueError("Cannot create disposal proceeds rows: no case profile template available.")

    new_rows = []
    for metric in impacted_metrics:
        mask = (result["Metric"] == metric) & (result["Year"] == proceeds_year)
        matching = int(mask.sum())
        if matching > 1:
            raise ValueError(
                f"Expected no more than one '{metric}' row for {proceeds_year}, but found {matching}."
            )
        if matching == 0:
            metric_template = template.loc[template["Metric"] == metric]
            new_row = (metric_template.iloc[[0]] if not metric_template.empty else template.iloc[[0]]).copy()
            new_row["Metric"] = metric
            new_row["Year"] = proceeds_year
            new_row["Value"] = 0.0
            new_rows.append(new_row)

    if new_rows:
        result = pd.concat([result, *new_rows], ignore_index=True)

    impact_mask = result["Metric"].isin(impacted_metrics) & (result["Year"] == proceeds_year)
    result.loc[impact_mask, "Value"] = result.loc[impact_mask, "Value"].fillna(0) + proceeds_delta
    return result


# ── Dilution ──────────────────────────────────────────────────────────────

def apply_dilution(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Reduce ownership-related profile and optionally apply one-off disposal proceeds."""
    original_profile = df.copy()
    result = df.copy()
    if pd.isna(param1):
        return result
    dilution_fraction = float(param1)
    if dilution_fraction < 0 or dilution_fraction > 1:
        raise ValueError("Dilution percentage must be between 0 and 1 inclusive.")

    start_year = int(param2) if pd.notna(param2) and param2 != 0 else int(result["Year"].min())
    end_year   = int(param3) if pd.notna(param3) and param3 != 0 else int(result["Year"].max())
    if start_year > end_year:
        raise ValueError("Dilution start year cannot be after the end year.")

    mask = (result["Year"] >= start_year) & (result["Year"] <= end_year)
    if dilution_fraction == 1:
        result = result.loc[~mask].copy()
    else:
        result.loc[mask, "Value"] = result.loc[mask, "Value"] * (1 - dilution_fraction)

    result = apply_dilution_proceeds(
        df=result, proceeds_amount=param4, proceeds_year=param5, template_df=original_profile
    )
    return result


# ── TruncateBefore ────────────────────────────────────────────────────────

def apply_truncate_before(
    df: pd.DataFrame,
    param1=None,
    *_,
) -> pd.DataFrame:
    """Remove all profile records before the specified year."""
    result = df.copy()
    if pd.isna(param1):
        return result
    truncate_year = int(param1)
    return result.loc[result["Year"] >= truncate_year].copy()


# ── TruncateAfter ─────────────────────────────────────────────────────────

def apply_truncate_after(
    df: pd.DataFrame,
    param1=None,
    *_,
) -> pd.DataFrame:
    """Remove all profile records after the specified year."""
    result = df.copy()
    if pd.isna(param1):
        return result
    truncate_year = int(param1)
    return result.loc[result["Year"] <= truncate_year].copy()


# ── ProdnAdj ──────────────────────────────────────────────────────────────

def apply_ProdnAdj(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Apply a proportional production adjustment."""
    result = df.copy()
    if pd.isna(param1):
        return result
    production_change = float(param1)
    if production_change < -1:
        raise ValueError("Production reduction cannot be greater than 100%.")

    start_year = int(param2) if pd.notna(param2) and param2 != 0 else YEAR_MIN
    end_year   = int(param3) if pd.notna(param3) and param3 != 0 else YEAR_MAX
    if start_year > end_year:
        raise ValueError("Production adjustment start year cannot be after the end year.")

    production_metrics = [
        "Equity Accounted Gas Production",
        "Equity Accounted NGL Production",
        "Equity Accounted Oil Production",
        "Equity Accounted Total Production (mboed)",
        "Gas - Non-Revenue Generating Prod (mmscfd)",
        "Gas Production (mmscf/d)",
        "Liquids Production (mboed)",
        "NGL - Non-Revenue Generating Prod (mbd)",
        "NGL Production (mb/d)",
        "Oil - Non-Revenue Generating Prod (mbd)",
        "Oil Production (mb/d)",
        "Revenue Generating Total Prod (mboe)",
        "Revenue Generating Total Prod (mboed)",
        "Total Production (mboed)",
    ]

    driver_metrics = ["Gross Margin", "Production Costs", "Total Cash Costs", "DD&A Charge"]

    year_mask = (result["Year"] >= start_year) & (result["Year"] <= end_year)

    driver_rows = result.loc[result["Metric"].isin(driver_metrics) & year_mask, ["Metric", "Year", "Value"]].copy()
    if driver_rows.duplicated(subset=["Metric", "Year"], keep=False).any():
        dupes = (
            driver_rows.loc[driver_rows.duplicated(subset=["Metric", "Year"], keep=False), ["Metric", "Year"]]
            .drop_duplicates().sort_values(["Metric", "Year"]).to_dict("records")
        )
        raise ValueError(f"Expected one row per financial driver and year. Duplicates found: {dupes}.")

    driver_rows["Delta"] = driver_rows["Value"].fillna(0) * production_change
    delta_table = (
        driver_rows.pivot(index="Year", columns="Metric", values="Delta")
        .reindex(columns=driver_metrics)
        .fillna(0)
    )

    production_mask = result["Metric"].isin(production_metrics) & year_mask
    result.loc[production_mask, "Value"] = result.loc[production_mask, "Value"] * (1 + production_change)

    driver_mask = result["Metric"].isin(driver_metrics) & year_mask
    result.loc[driver_mask, "Value"] = result.loc[driver_mask, "Value"] * (1 + production_change)

    calculated_metric_map = {
        "EBITDA":            ["Gross Margin", "Total Cash Costs"],
        "Underlying RCOP":   ["Gross Margin", "Total Cash Costs", "DD&A Charge"],
        "Operating Cashflow":["Gross Margin", "Total Cash Costs"],
        "Pre Tax Cash Flow": ["Gross Margin", "Total Cash Costs"],
    }

    for metric, delta_components in calculated_metric_map.items():
        metric_mask = (result["Metric"] == metric) & year_mask
        if not metric_mask.any():
            raise ValueError(f"Metric '{metric}' does not exist in the case profile.")
        metric_years = result.loc[metric_mask, "Year"]
        row_delta = pd.Series(0.0, index=metric_years.index)
        for component in delta_components:
            if component in delta_table.columns:
                row_delta = row_delta + metric_years.map(delta_table[component]).fillna(0)
        result.loc[metric_mask, "Value"] = result.loc[metric_mask, "Value"].fillna(0) + row_delta

    return result


# ── CostAdjOpex ───────────────────────────────────────────────────────────

def apply_CostAdjOpex(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Apply a percentage adjustment to Total Cash Costs and propagate to related metrics."""
    result = df.copy()
    if pd.isna(param1):
        return result
    opex_change = float(param1)
    if opex_change < -1:
        raise ValueError("OPEX reduction cannot be greater than 100%.")

    start_year = int(param2) if pd.notna(param2) and param2 != 0 else YEAR_MIN
    end_year   = int(param3) if pd.notna(param3) and param3 != 0 else YEAR_MAX
    if start_year > end_year:
        raise ValueError("OPEX adjustment start year cannot be after the end year.")

    base_metric = "Total Cash Costs"
    impacted_metrics = ["Total Cash Costs", "EBITDA", "Underlying RCOP", "Operating Cashflow", "Pre Tax Cash Flow"]

    base_rows = result.loc[result["Metric"] == base_metric, ["Year", "Value"]].copy()
    if base_rows.empty:
        raise ValueError(f"Metric '{base_metric}' does not exist in the case profile.")
    if base_rows["Year"].duplicated(keep=False).any():
        dupes = sorted(base_rows.loc[base_rows["Year"].duplicated(keep=False), "Year"].unique().tolist())
        raise ValueError(f"Expected one '{base_metric}' row per year, duplicates for years: {dupes}.")

    opex_delta_by_year = base_rows.set_index("Year")["Value"] * opex_change

    adjustment_mask = (
        result["Metric"].isin(impacted_metrics)
        & (result["Year"] >= start_year)
        & (result["Year"] <= end_year)
    )
    row_deltas = result.loc[adjustment_mask, "Year"].map(opex_delta_by_year).fillna(0)
    result.loc[adjustment_mask, "Value"] = result.loc[adjustment_mask, "Value"].fillna(0) + row_deltas
    return result


# ── CostAdjCapex ──────────────────────────────────────────────────────────

def apply_CostAdjCapex(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Apply a percentage adjustment to Cash Capex and propagate to Pre Tax Cash Flow."""
    result = df.copy()
    if pd.isna(param1):
        return result
    capex_change = float(param1)
    if capex_change < -1:
        raise ValueError("CAPEX reduction cannot be greater than 100%.")

    start_year = int(param2) if pd.notna(param2) and param2 != 0 else YEAR_MIN
    end_year   = int(param3) if pd.notna(param3) and param3 != 0 else YEAR_MAX
    if start_year > end_year:
        raise ValueError("CAPEX adjustment start year cannot be after the end year.")

    base_metric = "Cash Capex"
    impacted_metrics = ["Cash Capex", "Pre Tax Cash Flow"]

    base_rows = result.loc[result["Metric"] == base_metric, ["Year", "Value"]].copy()
    if base_rows.empty:
        raise ValueError(f"Metric '{base_metric}' does not exist in the case profile.")
    if base_rows["Year"].duplicated(keep=False).any():
        dupes = sorted(base_rows.loc[base_rows["Year"].duplicated(keep=False), "Year"].unique().tolist())
        raise ValueError(f"Expected one '{base_metric}' row per year, duplicates for years: {dupes}.")

    capex_delta_by_year = base_rows.set_index("Year")["Value"] * capex_change

    adjustment_mask = (
        result["Metric"].isin(impacted_metrics)
        & (result["Year"] >= start_year)
        & (result["Year"] <= end_year)
    )
    row_deltas = result.loc[adjustment_mask, "Year"].map(capex_delta_by_year).fillna(0)
    result.loc[adjustment_mask, "Value"] = result.loc[adjustment_mask, "Value"].fillna(0) + row_deltas
    return result


# ── CapexAbsolute ─────────────────────────────────────────────────────────

def apply_CapexAbsolute(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Apply up to two absolute Cash Capex adjustments."""
    result = df.copy()
    impacted_metrics = ["Cash Capex", "Pre Tax Cash Flow"]
    adjustments = [(param1, param2), (param3, param4)]

    for adjustment_amount, adjustment_year in adjustments:
        amount_missing = pd.isna(adjustment_amount) or float(adjustment_amount) == 0
        year_missing   = pd.isna(adjustment_year)   or int(adjustment_year) == 0
        if amount_missing and year_missing:
            continue
        if amount_missing or year_missing:
            raise ValueError("Each CAPEX adjustment requires both an adjustment amount and an adjustment year.")

        adjustment_amount = float(adjustment_amount)
        adjustment_year   = int(adjustment_year)
        if adjustment_year < YEAR_MIN or adjustment_year > YEAR_MAX:
            raise ValueError(
                f"CAPEX adjustment year {adjustment_year} falls outside the model horizon {YEAR_MIN}–{YEAR_MAX}."
            )
        capex_delta = -adjustment_amount  # positive input = additional CAPEX = negative sign

        for metric in impacted_metrics:
            mask = (result["Metric"] == metric) & (result["Year"] == adjustment_year)
            matching = int(mask.sum())
            if matching > 1:
                raise ValueError(
                    f"Expected no more than one '{metric}' row for {adjustment_year}, but found {matching}."
                )
            if matching == 0:
                raise ValueError(f"Metric '{metric}' is missing for {adjustment_year}.")
            result.loc[mask, "Value"] = result.loc[mask, "Value"].fillna(0) + capex_delta

    return result


# ── OpexAbsolute (CashCostAbsolute) ───────────────────────────────────────

def apply_OpexAbsolute(
    df: pd.DataFrame,
    param1=None,
    param2=None,
    param3=None,
    param4=None,
    param5=None,
) -> pd.DataFrame:
    """Apply up to two absolute Total Cash Costs adjustments."""
    result = df.copy()
    impacted_metrics = ["Total Cash Costs", "Underlying RCOP", "Operating Cashflow", "Pre Tax Cash Flow"]
    adjustments = [(param1, param2), (param3, param4)]

    for adjustment_amount, adjustment_year in adjustments:
        amount_missing = pd.isna(adjustment_amount) or float(adjustment_amount) == 0
        year_missing   = pd.isna(adjustment_year)   or int(adjustment_year) == 0
        if amount_missing and year_missing:
            continue
        if amount_missing or year_missing:
            raise ValueError("Each cash-cost adjustment requires both an adjustment amount and an adjustment year.")

        adjustment_amount = float(adjustment_amount)
        adjustment_year   = int(adjustment_year)
        if adjustment_year < YEAR_MIN or adjustment_year > YEAR_MAX:
            raise ValueError(
                f"Cash-cost adjustment year {adjustment_year} falls outside the model horizon {YEAR_MIN}–{YEAR_MAX}."
            )
        cash_cost_delta = -adjustment_amount  # positive input = additional cost = negative

        for metric in impacted_metrics:
            mask = (result["Metric"] == metric) & (result["Year"] == adjustment_year)
            matching = int(mask.sum())
            if matching > 1:
                raise ValueError(
                    f"Expected no more than one '{metric}' row for {adjustment_year}, but found {matching}."
                )
            if matching == 0:
                raise ValueError(f"Metric '{metric}' is missing for {adjustment_year}.")
            result.loc[mask, "Value"] = result.loc[mask, "Value"].fillna(0) + cash_cost_delta

    return result


# ── Dispatch table ────────────────────────────────────────────────────────

operation_functions: dict = {
    "NoChange":      apply_nochange,
    "Delay":         apply_delay,
    "Accelerate":    apply_accelerate,
    "Increase":      apply_increase,
    "Dilution":      apply_dilution,
    "TruncateBefore":apply_truncate_before,
    "TruncateAfter": apply_truncate_after,
    "ProdnAdj":      apply_ProdnAdj,
    "CostAdjOpex":   apply_CostAdjOpex,
    "CostAdjCapex":  apply_CostAdjCapex,
    "CapexAbsolute": apply_CapexAbsolute,
    "OpexAbsolute":  apply_OpexAbsolute,
}

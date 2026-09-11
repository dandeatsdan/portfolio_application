# ========================================================================
# DATA CONTRACTS — REQUIRED COLUMNS AND THE MODEL YEAR HORIZON
# ========================================================================
#
# These constants give the CSV loaders and calculation modules a common
# vocabulary. A schema here is simply a list of expected column names;
# it is not a database schema and does not create or store any tables.
#
# CASE_LISTING_REQUIRED describes case identity and classification data.
# PROFILES_REQUIRED describes a tall annual metric observation.
# TAX_RATES_REQUIRED describes a country's tax assumptions for one year.
# YEAR_MIN and YEAR_MAX define the supported modelling horizon.
#
# Example: one profile row means "case ID 7, metric Cash Capex, year 2028,
# value -100". Multiple metrics and years therefore produce many rows per
# case. Case IDs join these observations to the descriptive case listing.
#
# The constants do not validate anything by themselves. data/loaders.py
# checks required columns, while financials and API validation perform
# additional checks. Changing the horizon here requires reviewing the
# fixed-year assumptions elsewhere, including five-year reference totals,
# NPV's valuation origin and frontend year controls.

CASE_LISTING_REQUIRED = ["ID", "Case", "Group Entity", "Segment", "Region", "Country", "Plan Type", "Case Name", "Country Key"]

PROFILES_REQUIRED = ["ID", "Case", "Metric", "Year", "Value"]

TAX_RATES_REQUIRED = ["Country", "Country Key", "Year", "ETR", "CTR"]

YEAR_MIN = 2026
YEAR_MAX = 2040

# Streamlit Portfolio Scenario Modeller

## Purpose and status

This application develops the original Upstream Portfolio Scenario Modelling Framework into a conventional Python package with a Streamlit interface. It explores how the modelling logic can operate independently of Excel while supporting the Horizon X four-screen user journey.

It is **subsequent software development** building on the original DT603 implementation. The original [Excel application](../01_excel_application/README.md) and its [validation evidence](../03_testing_and_validation/README.md) remain separately documented. The Streamlit application should be assessed against its own current code paths and test coverage.

The `scenario-modeller` Python package in this directory is also consumed by the [React application's FastAPI backend](../08_react_app/README.md). As a result, some shared services are more advanced than the active Streamlit interface itself.

## Quick start

Use Python 3.10 or later in an activated virtual environment. From the repository root:

```bash
cd 07_streamlit_app
python -m pip install -e ".[dev]"
python -m pip install --upgrade streamlit
python -m streamlit run app.py
```

Open the local address printed by Streamlit. The upgrade step helps avoid an older installation that satisfies the package minimum but lacks the `st.navigation` and `st.Page` APIs used by `app.py`.

Run these commands with `07_streamlit_app` as the working directory. No Excel session, Power BI connection or React server is required.

## Active Streamlit workflow

| Screen | Current role |
| --- | --- |
| Home | Introduces the application and provides navigation and scenario-run status. |
| Portfolio Viewer | Filters the baseline portfolio, displays KPIs and charts, ranks contributors, shows cumulative contribution and supports case shortlisting. |
| Build a Scenario | Provides reference financial screening, case inclusion, operation selection, parameter entry and scenario execution. |
| Scenario Results | Compares the latest run with its reference baseline through KPI differences, charts, an impact waterfall and an applied-changes table. |

The active navigation is defined in `app.py` and uses `app_pages/`. The older `pages/` directory remains in the repository but is not the four-screen navigation configured by the current entry point.

## Shared Python package

The reusable package under `src/scenario_modeller` separates data loading, domain models, scenario operations, financial calculations and analytical services from the Streamlit UI.

| Path | Purpose |
| --- | --- |
| `src/scenario_modeller/data/` | CSV loading, column normalisation and schema validation. |
| `src/scenario_modeller/domain/` | Lightweight domain models. |
| `src/scenario_modeller/engine/operations.py` | Reusable case-level modelling operations. |
| `src/scenario_modeller/engine/scenario_engine.py` | Low-level scenario orchestration and operation dispatch. |
| `src/scenario_modeller/engine/financials.py` | Shared post-tax financial calculation logic. |
| `src/scenario_modeller/services/scenario_service.py` | Higher-level scenario execution and financialisation service. |
| `src/scenario_modeller/services/portfolio_service.py` | Portfolio aggregation and derived totals. |
| `src/scenario_modeller/services/comparison_service.py` | Reference/scenario comparison and waterfall preparation. |
| `src/scenario_modeller/services/valuation_service.py` | Discounted cash-flow / NPV calculations. |
| `src/scenario_modeller/ui/` | Streamlit-specific state helpers and theme. |

This separation is deliberate: the React/FastAPI application can reuse the modelling and analytical services without depending on Streamlit as a runtime.

## Current engine operations

| Operation | Engine key |
| --- | --- |
| No Change | `NoChange` |
| Delay | `Delay` |
| Accelerate | `Accelerate` |
| Farm In (Increase) | `Increase` |
| Farm Down (Dilution) | `Dilution` |
| Truncate Before | `TruncateBefore` |
| Truncate After | `TruncateAfter` |
| Production Change % | `ProdnAdj` |
| OPEX Change % | `CostAdjOpex` |
| CAPEX Change % | `CostAdjCapex` |
| CAPEX Change $m | `CapexAbsolute` |
| OPEX Change $m | `OpexAbsolute` |

Instructions specify a scenario, modelling case, inclusion flag, one operation and up to five parameters. The low-level engine dispatches included cases to the operation library, clips results to the 2026–2040 horizon and returns a tall results table alongside case-level errors.

Operation parameter meanings are defined by the operation metadata and implementation. Percentage operations use the established fractional convention; for example, `0.10` represents 10% where that operation expects a fraction.

## Data organisation

| Path | Purpose |
| --- | --- |
| `app.py` and `app_pages/` | Streamlit entry point and active screens. |
| `data/sample/` | Six sanitised representative CSV datasets used by the web prototypes. |
| `tests/` | Automated tests for loaders, scenario operations and financial services. |
| `design_decks/` | Horizon X design reference in PDF and PowerPoint formats. |

The sample files contain the case listing, tall profiles, tax rates, totals/averages, operations library and metrics helper.

Profiles use `ID`, `Case`, `Metric`, `Year` and `Value`, with uniqueness checked at `ID × Metric × Year`. Case-listing IDs must be unique.

These are sanitised demonstration inputs and must not be interpreted as genuine current portfolio forecasts.

## Important Streamlit / shared-service distinction

The shared package now contains reusable post-tax and valuation services, and these are used by the React/FastAPI implementation. The active Streamlit Build page, however, continues to invoke the lower-level `run_scenario()` path directly.

This means the existence of a service in `src/scenario_modeller` does **not** automatically mean that the active Streamlit interface exposes or applies that capability.

In particular:

- the tax-rate file and post-tax coordinator are available within the shared package;
- the React backend uses the shared post-tax and valuation services;
- the active Streamlit scenario execution path has not been fully migrated to that higher-level coordinator; and
- the shared engine still does not implement a price operation.

The Streamlit UI and the shared Python package should therefore be evaluated as related but distinct layers.

## Automated tests

From `07_streamlit_app`:

```bash
python -m pytest tests/
```

Current committed tests cover more than the original loader / No Change / Delay prototype. They include checks for:

- representative data loading and schema validation;
- baseline-preserving No Change behaviour;
- Delay behaviour and modelling-horizon clipping;
- post-tax arithmetic;
- tax-rate validation and case/rate joins;
- repeat-safe derived-metric calculation;
- handling of unmatched cash-tax situations;
- scenario-versus-baseline reconciliation; and
- shared discounted cash-flow / NPV behaviour.

These are software tests for specific behaviours. They do not establish complete coverage of all 12 operations, full browser/UI verification, or business equivalence with the original Excel application.

The original business validation evidence is documented separately in [`03_testing_and_validation`](../03_testing_and_validation/README.md).

## Current application boundaries

Scenario configuration and results in the active Streamlit interface are held in Streamlit session state; there is no durable scenario store in this application.

The reference run is constructed using No Change across the full case listing, so differences can include the effect of cases omitted from a shortlisted scenario. Review case-level errors before interpreting totals because successful cases may still return results when other cases fail.

The Streamlit implementation remains a prototype and is not the current target for the later scenario-persistence and comparison-workspace work. Those capabilities are being developed in the React/FastAPI application.

## Relationship to React

The React implementation does **not** run the Streamlit server. Instead, its FastAPI backend imports this package and reads the representative sample datasets from `data/sample`.

That architecture allows the later interface to reuse core modelling behaviour while adding capabilities that are not present in the active Streamlit UI, including explicit saved-scenario persistence, stronger operation-input validation and a richer scenario-comparison workspace.

See the [React README](../08_react_app/README.md) for the current implementation status.

[Return to repository overview](../README.md)

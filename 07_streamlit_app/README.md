# Streamlit Portfolio Scenario Modeller

## Purpose and status

This application develops the original Upstream Portfolio Scenario Modelling Framework into a conventional Python package with a Streamlit interface. It explores how the modelling logic can operate independently of Excel while supporting the Horizon X four-screen user journey.

It is subsequent software development building on the original DT603 implementation. The original [Excel application](../01_excel_application/README.md) and its [validation evidence](../03_testing_and_validation/README.md) remain separately documented. The web application should be assessed against its own test coverage and current capabilities.

The `scenario-modeller` Python package in this directory is also used by the [React application's FastAPI backend](../08_react_app/README.md).

## Setup and launch

Use Python 3.10 or later in an activated virtual environment. From the repository root:

```bash
cd 07_streamlit_app
python -m pip install -e ".[dev]"
python -m pip install --upgrade streamlit
python -m streamlit run app.py
```

Open the local address printed by Streamlit. The upgrade step helps avoid an older installation that satisfies the current package minimum but lacks the `st.navigation` and `st.Page` APIs used by `app.py`.

Run these commands with `07_streamlit_app` as the working directory. No Excel session, Power BI connection, or React server is required.

## User workflow

| Screen | Current role |
| --- | --- |
| Home | Introduces the application and provides navigation and scenario-run status. |
| Portfolio Viewer | Filters the baseline portfolio, displays KPIs and charts, ranks contributors, shows cumulative contribution, and supports case shortlisting. |
| Build a Scenario | Provides reference financial screening, case inclusion, operation selection, parameter entry, and scenario execution. |
| Scenario Results | Compares the run with its reference baseline through KPI differences, charts, an impact waterfall, and an applied-changes table. |

The active navigation is defined in `app.py` and uses `app_pages/`. The older `pages/` directory remains in the repository but is not the four-screen navigation configured by this entry point.

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

Instructions specify a scenario, modelling case, inclusion flag, one operation, and up to five parameters. The engine dispatches included cases to the operation library, clips results to 2026–2040, and returns a tall results table alongside case-level errors. Results retain scenario, case, operation, parameter, and run-time metadata.

Operation parameter meanings are defined by the reference library and implementation. Do not assume that every percentage field uses whole-number percentages; confirm the expected input convention before running a case.

## Data and code organisation

| Path | Purpose |
| --- | --- |
| `app.py` and `app_pages/` | Streamlit entry point and active screens. |
| `src/scenario_modeller/data/` | CSV loading, column normalisation, and schema checks. |
| `src/scenario_modeller/domain/` | Domain models. |
| `src/scenario_modeller/engine/` | Operation functions and scenario orchestration. |
| `src/scenario_modeller/services/` | Portfolio aggregation and scenario comparison. |
| `src/scenario_modeller/ui/` | Session-state helpers and visual theme. |
| `data/sample/` | Six representative CSV datasets. |
| `tests/` | Automated loader, NoChange, and Delay tests. |
| `design_decks/` | Horizon X design reference in PDF and PowerPoint formats. |

The sample files contain the case listing, tall profiles, tax rates, totals/averages, operations library, and metrics helper. Profiles use `ID`, `Case`, `Metric`, `Year`, and `Value`, with uniqueness checked at `ID × Metric × Year`. Case-listing IDs must be unique.

These are sanitised demonstration inputs. The active web engine does not currently use the tax-rate file to recalculate post-tax results, and its dispatch table does not include a price operation. The presence of supporting CSVs does not establish that every Excel calculation has been ported.

## Tests and current boundaries

From `07_streamlit_app`:

```bash
python -m pytest tests/
```

The committed tests cover data loading, baseline-preserving NoChange behaviour, and Delay behaviour including horizon clipping and cost penalties. They do not establish complete coverage of all 12 operations or the user interface.

Scenario configuration and results are held in Streamlit session state; there is no durable scenario store in this application. The reference run is constructed using NoChange across the full case listing, so differences can include the effect of cases omitted from a shortlisted scenario. Review case-level errors before interpreting totals, because successful cases may still return results when other cases fail.

[Return to repository overview](../README.md)

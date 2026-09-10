# React Portfolio Scenario Modeller

## Purpose and architecture

This application explores a React implementation of the Horizon X portfolio scenario-modelling interface. A FastAPI backend supplies portfolio data and executes scenarios using the shared Python package in `07_streamlit_app`.

React handles navigation, filters, case selection, and visual presentation. FastAPI loads the representative CSV inputs, provides analytical endpoints, and calls the Python engine. The separation enables interface development while retaining the shared modelling implementation.

This is subsequent development building on the original DT603 framework. Original Excel validation evidence does not establish full validation of the React interface, API, or ported engine.

## Prerequisites

- Python 3.10 or later, preferably in an activated virtual environment.
- Node.js and npm compatible with the Vite version in `frontend/package.json`.
- Both `07_streamlit_app` and `08_react_app` retained in their existing sibling locations.
- `04_user_guides/operations_user_guide.pdf` retained at the repository root's guide location; the frontend bundles it for the Operations guide link.

The Streamlit server does not need to run. Its directory supplies the shared Python package and sample data.

## Install dependencies

From the repository root, install the shared engine and backend dependencies:

```bash
python -m pip install -e ./07_streamlit_app
python -m pip install -r ./08_react_app/backend/requirements.txt
```

Install frontend dependencies using the committed lockfile:

```bash
cd 08_react_app/frontend
npm ci
```

## Start the application

Use two terminals. In the first, with the Python environment activated, start from the repository root:

```bash
cd 08_react_app
python -m uvicorn backend.main:app --reload --port 8000
```

The module path is important: `backend/main.py` uses relative imports, so it must be loaded as part of the `backend` package.

In the second terminal, start from the repository root:

```bash
cd 08_react_app/frontend
npm run dev
```

Open [the frontend](http://localhost:5173). The Vite development server forwards `/api` requests to the backend on port 8000. Both processes must remain running.

Use the [health endpoint](http://localhost:8000/api/health) to check that the API has loaded its data, and the [interactive API documentation](http://localhost:8000/docs) to inspect endpoints.

## Screens and routes

| Screen | Route | Purpose |
| --- | --- | --- |
| Home | `/` | Application entry point and navigation. |
| Portfolio Viewer | `/portfolio` | Baseline exploration, filters, KPIs, charts, rankings, creaming analysis, and case selection. |
| Build a Scenario | `/build` | Configure included cases, operations, and parameters, then run the scenario. |
| Scenario Results | `/results` | Compare reference and scenario outputs, including KPI differences, charts, waterfall analysis, and applied changes. |

Filters, shortlisted case IDs, and the latest scenario result are managed through React context. They are in-memory application state, not a saved scenario database.

All loaded cases are included using their **reference profiles** by default. The shortlist identifies cases to modify, explicitly exclude, or keep handy for review. Cases in **Available cases** remain included using their reference profiles. Removing a case from the shortlist restores its reference profile and includes it in the scenario; internally, this resets inclusion to yes, operation to No Change, and all five parameters to zero. Run instructions cover all loaded cases, using overrides only for shortlisted cases; an empty shortlist runs the full unchanged portfolio. Running with every case explicitly excluded is disabled. This contract applies to React; active Streamlit behaviour is unchanged by this correction.

The **Operations guide** button beside the shortlist opens a help panel with the four operation categories, expandable descriptions, required/optional inputs and examples. It supports keyboard navigation, Escape and a close button, and restores focus on dismissal. Opening help does not change scenario configuration. The dedicated operations PDF opens separately from its first page.

Guide text is maintained in `frontend/src/components/operationGuideContent.js`, with input contracts checked against the sample operations CSV and selectable frontend operations. Examples follow the shared engine's fraction inputs and negative cash-outflow values. The operations PDF remains unchanged; its page 5 transaction summary differs from both the Excel and shared Python implementation for farm-in payments, which affect Cash Capex rather than sale proceeds. The case configuration panel exposes all relevant inputs together, including all five for scale operations. Percentage inputs retain the library’s fractional convention (0.10 means 10%).

Build a Scenario has three independently configurable **reference measures**, shared by its shortlisted and available tables. Defaults are Production, Cash Capex and Post-tax NPV for 2026–2040. Periods include individual years through 2040, total 2026–2030, average 2026–2030 and total 2026–2040. NPV supports totals only, using the shared 8% fixed-2026, period-1 valuation service. Multi-year production totals use mmboe, matching Portfolio Viewer’s case table; annual and average production use mboed. Other metrics retain their source units and analytical signs, matching the previous reference table (cash outflows remain negative). Period totals sum annual values and five-year averages divide by five, as in the existing totals feed. Values remain baseline values regardless of scenario adjustments, and are joined by case ID, not display name. Each reference column is sortable; missing values sort last. Selector changes clear stale values while loading, and failed requests offer Retry. Settings remain page-local. Both pages share the same native dropdown styling.

**Run Scenario** opens a confirmation dialog before submitting. It shows the scenario name, counts of reference/modified/excluded cases and each modified or excluded case by name and ID. Modified cases show the operation and all labelled saved inputs; excluded cases do not list retained operations as applied changes. Cancel or Escape returns to editing without running. Only **Confirm and run** submits, with a guard against repeated confirmation clicks. An empty shortlist can still confirm a full reference run.

Each shortlisted row has a **Configure** button and a compact summary. The right-hand panel retains the selected case’s name, ID, plan type, region and country, while highlighting its row. Inclusion is the first decision, followed by one operation and its labelled inputs. Edits remain a draft until **Apply changes**; Cancel, Escape, the close button and backdrop dismissal discard the draft. Switching operations clears the previous draft inputs. Applying exclusion preserves the last applied operation settings, and re-inclusion makes them editable again. **Reset** restores the draft to an included reference profile with all parameters cleared; Apply saves the reset and Cancel preserves the previously saved configuration. Reset keeps the case shortlisted.

The editor checks required values, finite numbers, whole-year inputs, fraction limits, paired amounts/years and explicit year ordering before applying. The existing engine remains responsible for profile-specific calculation validation when running the scenario. This panel does not calculate a live impact preview or change backend calculations.

## Code and data

| Path | Responsibility |
| --- | --- |
| `backend/main.py` | FastAPI application, startup loading, CORS, and health endpoint. |
| `backend/state.py` | Locates and loads the sibling sample-data directory. |
| `backend/schemas.py` | API data models. |
| `backend/routers/data.py` | Reference data endpoints. |
| `backend/routers/portfolio.py` | Portfolio KPIs, charts, rankings, creaming analysis, and entity summaries. |
| `backend/routers/scenario.py` | Scenario execution, waterfall, and KPI-difference endpoints. |
| `backend/utils/display.py` | Display-value transformations. |
| `frontend/src/pages/` | Four application screens. |
| `frontend/src/components/` | Shared layout, filter rail, charts, and interface components. |
| `frontend/src/hooks/` and `frontend/src/api/` | Frontend data access and scenario interactions. |
| `frontend/vite.config.js` | Development server and API proxy. |

The backend loads the case listing, profiles, operations library, totals/averages, and metrics helper from `../07_streamlit_app/data/sample`. These are representative demonstration datasets, with no live Power BI or enterprise data connection.

Scenario requests carry their instructions in the request body. The backend retains loaded reference data in memory, but it does not persist scenario runs. The engine operation list and current calculation scope are documented in the [Streamlit README](../07_streamlit_app/README.md).

## Analytical scope and interpretation

The React API calculates the baseline's post-tax metrics at startup, before any scenario is run. After scenario operations, the same shared `engine/financials.py` calculation generates `Tax Charge`, `Cash Tax Payment`, `Post-Tax RCOP`, and `Post-Tax Cash Flow`. Raw inputs remain separate; recalculation replaces derived rows rather than taxing them twice. The metrics-helper CSV includes all four metrics, and their Total/Avg5y values are derived in memory.

`services/valuation_service.py` calculates NPV from post-tax cash flow using a fixed 2026 base, with 2026 as period 1. The default rate is 8%; API valuation endpoints accept a rate in percent. Filtering years never resets the discount origin. Entity summaries, the creaming curve, scenario NPV, and the ranking chart's **Post-tax NPV** option share this calculation. NPV is a calculated ranking measure, not an annual profile row to sum again. Creaming ranks by NPV/capex; zero-capex cases have undefined PI, sort last, and remain in cumulative NPV totals.

Tax uses non-negative RCOP with ETR for charges and CTR for cash payments. Tax outputs have negative analytical signs; display inversion is metadata-driven. Missing/invalid RCOP tax rates block publication. As in the Excel source, cash-flow rows without matching RCOP use zero cash tax with diagnostics. Representative tax rates are examples, not production fiscal assumptions.

The scenario reference includes all loaded cases, so differences may reflect both operations and explicitly excluded cases. Invalid runs return diagnostics without partial results; React retains the previous successful result and labels it after a failed attempt. State remains in memory. There is still no price operation, and the active Streamlit UI is not wired to the new financial coordinator in this change.

## Verification and deployment status

To run shared-package and API regression tests, start from the repository root:

```bash
python -m pip install -e "./07_streamlit_app[dev]"
python -m pip install -r 08_react_app/backend/requirements-dev.txt
python -m pytest 07_streamlit_app/tests 08_react_app/backend/tests -q
```

From `08_react_app/frontend`, check the frontend build with:

```bash
npm run build
```

Check Operations guide coverage and input metadata with:

```bash
node --test src/components/operationGuideContent.test.js src/components/caseConfiguration.test.js
```

Verification on this feature: 70 Python/API tests passed and the frontend production build passed. Tests cover tax signs/rates/joins, repeat calculation, invalid-run withholding, baseline preservation, NoChange reconciliation, fixed-origin discounting and cross-endpoint NPV agreement. The build reports a large-bundle warning. Browser verification was blocked by the preview environment; manually check metric selectors, NPV ranking, year filters, scenario results and previous-result preservation after a failed run before merging. These checks do not establish full workbook parity or validate business tax assumptions.

The checked-in configuration supports local development. A frontend build does not package or host the Python backend; deployment must provide the API, production request routing, and fallback routing for React's browser routes. The Vite development proxy does not configure those production services.

[Return to repository overview](../README.md)

## Operation input validation

The configuration panel now validates calendar years as whole numbers within 2026–2040, rejects negative transaction magnitudes, and preserves signed CAPEX/OPEX $m adjustments. Percentage increases remain uncapped; reductions cannot exceed 100%, using the existing operation-specific fraction conventions. Optional zero/blank defaults remain supported. Field hints and errors appear on blur and Apply, with related fields rechecked when correcting errors.

`POST /api/scenario/validate` checks configurations against case-profile data without running or publishing a scenario. The panel waits for these checks before allowing Apply and offers Retry if checking fails. It shows non-blocking warnings for partial/full timing clipping, complete truncation and combined absolute adjustments that turn costs into inflows. Same-year adjustments still accumulate, and either year order is permitted. Run repeats backend validation and publishes warnings with successful results. Existing calculation failures and empty-portfolio result checks still apply.

Required parameters must be explicitly present on included non-reference instructions. In particular, absolute operations require their first non-zero amount/year pair. Legacy callers that omitted required parameters and relied on API zero defaults now receive validation errors; explicit valid zeros still work. Unused non-reference positions must be zero. No Change continues to clear parameters, and excluded configurations remain stored but inactive. Unknown non-empty operation labels are passed through for backend rejection rather than silently becoming No Change. Existing negative transaction values must be corrected; they are not silently rewritten.

The implementation is limited to React/FastAPI input handling; shared Python calculation functions and the active Streamlit application are unchanged. The [operation matrix](Operation-Parameter-Validation-Matrix.md) records the agreed decisions and the original validation review. Browser checks should include stale validation responses, Retry, warning-only Apply, keyboard navigation, exclusion/re-inclusion and retaining the last successful result after a failed run.

# React Portfolio Scenario Modeller

## Purpose and architecture

This application explores a React implementation of the Horizon X portfolio scenario-modelling interface. A FastAPI backend supplies portfolio data and executes scenarios using the shared Python package in `07_streamlit_app`.

React handles navigation, filters, case selection, and visual presentation. FastAPI loads the representative CSV inputs, provides analytical endpoints, and calls the Python engine. The separation enables interface development while retaining the shared modelling implementation.

This is subsequent development building on the original DT603 framework. Original Excel validation evidence does not establish full validation of the React interface, API, or ported engine.

## Prerequisites

- Python 3.10 or later, preferably in an activated virtual environment.
- Node.js and npm compatible with the Vite version in `frontend/package.json`.
- Both `07_streamlit_app` and `08_react_app` retained in their existing sibling locations.

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

The React portfolio API includes discounted pre-tax cash-flow calculations for entity NPV and creaming analysis. Its creaming curve ranks aggregated units by NPV/capex and plots cumulative capex against cumulative NPV. This differs from the Streamlit screen's cumulative-contribution presentation.

The shared engine currently has no price operation or post-tax recalculation stage. The scenario API constructs its reference baseline using all cases in the loaded listing, so differences may reflect both operations and omitted cases. Inspect returned case-level errors before relying on aggregate results.

## Verification and deployment status

To run the existing shared-package tests, start from the repository root:

```bash
python -m pip install -e "./07_streamlit_app[dev]"
cd 07_streamlit_app
python -m pytest tests/
```

From `08_react_app/frontend`, check the frontend build with:

```bash
npm run build
```

The committed shared tests cover loaders, NoChange, and Delay. There is no dedicated React or API test suite in this directory. A successful frontend build alone does not establish analytical correctness or end-to-end behaviour.

The checked-in configuration supports local development. A frontend build does not package or host the Python backend; deployment must provide the API, production request routing, and fallback routing for React's browser routes. The Vite development proxy does not configure those production services.

[Return to repository overview](../README.md)

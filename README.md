# Upstream Portfolio Scenario Modelling — Software Engineering Extension

## What this repository is

This repository is a **software engineering extension** of the validated Upstream Portfolio Scenario Modelling Framework, which was originally delivered as the DT603 academic submission. That original work — the governed Power BI semantic model, the Excel/Python scenario engine, architecture documentation, business-validation evidence, and user guides — is held in the companion repository:

**[dandeatsdan/Upstream-Portfolio-Scenario-Modelling](https://github.com/dandeatsdan/Upstream-Portfolio-Scenario-Modelling)**

The project scope is the same as the original: support expert-led Upstream portfolio scenario analysis through a controlled, transparent, and reproducible modelling process. The difference here is architectural. The original submission was constrained by the Excel/Power BI platform, which is the right tool for the intended business audience. This repository explores what the same methodology looks like when expressed in a more conventional software stack — a Python package, a FastAPI backend, and a React frontend — as a personal learning exercise and as a way to better communicate technical requirements to an engineering team.

Users remain responsible for scenario assumptions, interpretation, and subsequent business decisions.

---

## Repository structure

```
Portfolio_Application/
├── src/
│   └── scenario_modeller/      # Shared Python analytical package
│       ├── data/               # CSV loaders and schemas
│       ├── domain/             # Domain models and optimisation spec
│       ├── engine/             # Operations, scenario execution, financials
│       └── services/           # Portfolio, scenario, valuation, comparison, optimisation
├── tests/                      # Unit and integration tests for the Python package
├── data/
│   ├── sample/                 # Representative synthetic CSVs (committed)
│   └── real/                   # Local real data (git-ignored, optional)
├── docs/                       # Design references, gap review, planning notes
├── 08_react_app/
│   ├── backend/                # FastAPI application
│   └── frontend/               # React (Vite) application
└── pyproject.toml              # Single package install at root
```

The `data/real/` directory is excluded from version control. When present, the backend loads it automatically in preference to `data/sample/`. All committed sample data is synthetic and representative only — no production planning data is held in this repository.

---

## Design context

The `docs/` folder contains the Horizon X design reference (PDF and PowerPoint) that was created to communicate an analytical interface concept to the Horizon X engineering team. This repository is the author's own implementation of that concept, built independently for learning purposes using a similar technology stack. It is not the Horizon X product itself.

---

## What this extension adds beyond the original submission

| Capability | Notes |
| --- | --- |
| Shared Python package (`scenario_modeller`) | Clean src-layout package separating data loading, engine operations, and services from any UI layer |
| FastAPI backend | Typed request/response schemas, startup state loading, publication gate, scenario persistence as JSON |
| React frontend | Four-screen analytical workflow matching the design intent: Home, Portfolio Viewer, Build a Scenario, Scenario Results |
| Post-tax financial processing | Shared engine: ETR/CTR join, Tax Charge, Cash Tax Payment, Post-Tax RCOP, Post-Tax Cash Flow |
| Discounting and NPV | Mid-year convention, configurable rate, fixed 2026 origin regardless of year filter |
| Portfolio optimisation | Prescriptive analytics layer: budget/capex/production constraints, timing flexibility, multi-objective |
| Automated tests | 237 passing Python and API tests covering loaders, operations, financials, valuation, optimisation |

---

## Running the application

Install the Python package from the repository root:

```bash
python -m pip install -e ".[optimisation,dev]"
python -m pip install -r backend/requirements.txt
```

Start the FastAPI backend (from the repository root):

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

Start the React frontend (in a separate terminal, from the repository root):

```bash
cd frontend
npm ci
npm run dev
```

React is served at `http://localhost:5173`. The development proxy forwards `/api` to port 8000. API documentation is at `http://localhost:8000/docs`.

## Running the tests

From the repository root:

```bash
python -m pytest tests/ 08_react_app/backend/tests/ -q
```

---

## Status and limitations

This is a learning experiment, not a production system. The analytical engine reuses the validated modelling methodology from the original DT603 implementation but has not undergone equivalent business validation. See the [gap review](docs/Excel-Python-to-Web-Application-Gap-Review.md) for a detailed comparison of what has and has not been reconciled to the validated Excel behaviour.

Do not present this application as an official BP product or treat its outputs as authoritative planning data.

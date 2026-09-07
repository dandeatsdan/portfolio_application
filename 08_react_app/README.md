# 08 React App — Horizon X Scenario Modeller

React + FastAPI implementation of the Upstream Portfolio Scenario Modelling application.
White-canvas design with BP Deep Green sidebar and BP Light Green accents,
following the Horizon X design reference.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.10+ | Already installed |
| Node.js | LTS (20+) | **Must install from nodejs.org** |
| npm | Comes with Node.js | |

---

## 1. Install the Python engine

The FastAPI backend reuses the validated `scenario-modeller` package from the
sibling Streamlit app. Run this once from the `backend/` directory:

```bash
cd 08_react_app/backend

# Install the scenario-modeller package (editable)
pip install -e ../../07_streamlit_app
# If you have not yet renamed the folder:
# pip install -e ../../07_software_project

# Install backend dependencies
pip install -r requirements.txt
```

## 2. Start the FastAPI backend

```bash
cd 08_react_app/backend
uvicorn main:app --reload --port 8000
```

- API root:      http://localhost:8000
- OpenAPI docs:  http://localhost:8000/docs
- Health check:  http://localhost:8000/api/health

## 3. Install frontend dependencies (requires Node.js)

```bash
cd 08_react_app/frontend
npm install
```

## 4. Start the React dev server

```bash
cd 08_react_app/frontend
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies all `/api/*` requests to the FastAPI backend on port 8000.
Both servers must be running simultaneously.

---

## Project structure

```
08_react_app/
├── backend/
│   ├── main.py             # FastAPI entry point (uvicorn main:app)
│   ├── state.py            # Data loaded once at startup
│   ├── schemas.py          # Pydantic response models
│   ├── requirements.txt
│   └── routers/
│       ├── data.py         # /api/cases, /api/operations, /api/totals, /api/metrics
│       ├── portfolio.py    # /api/portfolio/kpis|stacked|ranked|creaming
│       └── scenario.py     # /api/scenario/run|waterfall|kpi-delta
└── frontend/
    ├── package.json
    ├── vite.config.js      # Proxy /api → localhost:8000
    ├── index.html
    └── src/
        ├── App.jsx         # Router + shared context (selection, scenario result)
        ├── theme.js        # BP colour palette constants
        ├── index.css       # CSS custom properties + global reset
        ├── api/client.js   # Axios wrapper
        ├── hooks/
        │   ├── usePortfolio.js
        │   └── useScenario.js
        ├── components/
        │   ├── AppShell.jsx
        │   ├── KpiCard.jsx
        │   ├── JourneyStrip.jsx
        │   └── ChartPanel.jsx
        └── pages/
            ├── Home.jsx
            ├── PortfolioViewer.jsx
            ├── BuildScenario.jsx
            └── ScenarioResults.jsx
```

---

## Workflow

1. **Home** — confirm backend is connected, navigate to a destination.
2. **Portfolio Viewer** — review baseline KPIs, production and financial charts,
   ranked contributors. Click rows to select cases. Click **Build a Scenario**.
3. **Build a Scenario** — selected cases carry in. Set operations and parameters.
   Click **Run Scenario** — navigates automatically to Results.
4. **Scenario Results** — KPI delta tiles, reference vs scenario charts,
   impact waterfall, applied changes table.

---

## Notes

- Sanitised representative data only. No production BP planning data.
- The analytical engine is the validated Python operations library from `07_streamlit_app`.
- The backend is stateless: every `/api/scenario/run` POST receives full instructions
  and returns full results. No server-side session state.
- The folder `07_software_project` should be renamed to `07_streamlit_app` manually
  via Windows Explorer (close VS Code first to release the file lock).

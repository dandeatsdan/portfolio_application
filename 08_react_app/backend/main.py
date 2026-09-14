# ========================================================================
# FASTAPI ENTRY POINT — CONNECT THE REACT APP TO PYTHON
# ========================================================================
#
# From 08_react_app, start with:
#   python -m uvicorn backend.main:app --reload
# Uvicorn serves the FastAPI app object defined below. React runs separately
# and calls its /api routes. This does not start the Streamlit interface.
#
# On startup, lifespan calls app_state.load to read the reference files
# and prepare the baseline. An invalid baseline prevents normal startup.
# The router registrations then connect URL groups to their handlers:
#   data              case lists, operations and filter choices
#   portfolio         reference portfolio tables and chart measures
#   scenario          input checks, scenario runs and supporting analysis
#   saved_scenarios   versioned scenario definitions stored as JSON
#   results_analysis  filtered analysis of supplied result rows
#   optimisation      include/exclude portfolio optimisation
#
# This file wires the application together; the calculations live in the
# shared scenario_modeller package. CORS lists the browser origins allowed
# to call the API. The health endpoint reports the loaded case/profile row
# counts, not the outcome of a particular scenario or optimisation run.
# Start reading state.py for data loading, then the router for the feature
# you are following, and finally the service that router calls.

"""
Scenario Modeller — FastAPI entry point.

Serves the analytical engine over a REST API consumed by the React frontend.
Run with:
    uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .state import app_state
from .routers import data, portfolio, scenario, saved_scenarios, results_analysis, optimisation


@asynccontextmanager
async def lifespan(app: FastAPI):
    app_state.load()
    yield


app = FastAPI(
    title="Scenario Modeller API",
    description="Upstream Portfolio Scenario Modelling — learning experiment",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://portfolio-application-lime.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router)
app.include_router(portfolio.router)
app.include_router(scenario.router)
app.include_router(saved_scenarios.router)
app.include_router(results_analysis.router)
app.include_router(optimisation.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "cases":   len(app_state.case_listing),
        "profiles":len(app_state.profiles),
    }

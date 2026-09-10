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
from .routers import data, portfolio, scenario, saved_scenarios, results_analysis


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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router)
app.include_router(portfolio.router)
app.include_router(scenario.router)
app.include_router(saved_scenarios.router)
app.include_router(results_analysis.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "cases":   len(app_state.case_listing),
        "profiles":len(app_state.profiles),
    }

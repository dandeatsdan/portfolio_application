# Scenario Modeller — Software Learning Experiment

Post-project software experiment re-expressing the validated DT603 Upstream Portfolio Scenario Modelling Framework as a conventional Python package with a Streamlit UI.

## Status

**Experimental.** The validated degree submission is in `01_excel_application/`. This directory is a learning exercise and must not be treated as a replacement production system.

## Setup

```bash
cd 07_software_project
pip install -e ".[dev]"
```

## Run tests

```bash
pytest tests/
```

## Run app

```bash
streamlit run app.py
```

## Current capability

- Loads sanitised case listing, profiles, and tax rates from `data/sample/`
- Executes `NoChange` scenario operation end-to-end
- Displays case listing and run confirmation in a minimal Streamlit UI

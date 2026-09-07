# Upstream Portfolio Scenario Modelling Framework

## Project overview

This repository contains the working applications, source code, architecture, sanitised representative datasets, validation evidence, and user documentation for an Upstream portfolio scenario modelling framework.

The framework supports long-term planning by allowing users to select modelling cases, configure assumptions, and compare alternative financial and production outcomes. It addresses the need for a controlled, transparent, and reproducible modelling process while retaining the flexibility required by expert portfolio and finance users.

The original implementation combines a governed Power BI semantic model with an Excel application and a modular Python-in-Excel engine. Subsequent development explores the same modelling approach through a standalone Python package, a Streamlit interface, and a React interface supported by a FastAPI backend.

Users remain responsible for scenario assumptions, interpretation, and subsequent business decisions.

## Applications and development status

| Component | Purpose | Starting point |
| --- | --- | --- |
| Power BI semantic model | Governed data preparation, manual-profile integration, and Financial Entity to Modelling Case translation. | [Semantic model README](00_semantic_model/README.md) |
| Excel application | Original DT603 implementation, including scenario configuration, Python calculations, VBA workflow controls, and Power Pivot analysis. | [Excel application README](01_excel_application/README.md) |
| Streamlit application | Subsequent software development exploring a packaged Python engine and a four-screen analytical workflow. | [Streamlit README](07_streamlit_app/README.md) |
| React application | Further interface development separating the React frontend from a Python analytical API. | [React README](08_react_app/README.md) |

The testing and business-validation evidence in `03_testing_and_validation` relates to the original framework. The web applications build on that work, but their implementation and interfaces require their own verification. Reuse of the modelling methodology does not establish full numerical or functional equivalence across applications.

The shared web-app engine currently resides in `07_streamlit_app/src/scenario_modeller`. The React backend imports this package and reads the sample datasets in `07_streamlit_app/data/sample`; retain both directories when running the React application. The Streamlit server itself does not need to be running for React.

## Repository navigation

| Directory | Contents |
| --- | --- |
| [00_semantic_model](00_semantic_model/) | Sanitised source CSVs, Power Query implementation, and the working `.pbix` semantic model. |
| [01_excel_application](01_excel_application/) | Sanitised application CSVs, VBA, DAX, Power Query, extracted Python code, and the working `.xlsm` application. |
| [02_architecture](02_architecture/) | Nine SVG architecture diagrams and the editable master draw.io source. |
| [03_testing_and_validation](03_testing_and_validation/) | Business-validation, performance, technical-walkthrough, and business-walkthrough evidence. |
| [04_user_guides](04_user_guides/) | Excel application user guide. |
| [05_project_management](05_project_management/) | Project management plan. |
| [06_project_diary_evidence](06_project_diary_evidence/) | E01–E11 supporting exhibits for the DT603 project diary. |
| [07_streamlit_app](07_streamlit_app/) | Streamlit application, shared Python package, sample data, automated tests, and Horizon X design references. |
| [08_react_app](08_react_app/) | React frontend and FastAPI backend. |

## Getting started

For an overview of the original solution, start with the [overall architecture](02_architecture/svg/001_overall_solution_architecture.svg), then the [application user guide](04_user_guides/application_user_guide.pdf) and [validation overview](03_testing_and_validation/README.md).

The working artefacts are the [Power BI semantic model](00_semantic_model/02_working_solution/data_pipeline.pbix) and [Excel scenario modelling application](01_excel_application/05_working_solution/scenario_modelling_application.xlsm). Their folder READMEs explain the implementation and sanitisation arrangements.

For the browser-based applications, follow the setup instructions in the [Streamlit README](07_streamlit_app/README.md) or [React README](08_react_app/README.md). These routes use local Python and representative CSV inputs without requiring the Excel workbook or a running Power BI model.

## Modelling approach

The framework separates data preparation, case definition, scenario configuration, calculation, and analytical presentation. Users configure operations against modelling cases; the engine applies those instructions to copies of baseline financial and production profiles.

The original solution includes timing, participation, truncation, production, cost, capital, and price operations, with financial calculations and embedded validation. The shared web-app engine currently implements 12 operations covering no change, timing, participation, truncation, production, and cost/capital adjustments. See the Streamlit README for the exact operation list and current scope.

Both web applications provide Home, Portfolio Viewer, Build a Scenario, and Scenario Results screens. Their interfaces and analytical presentations are evolving independently, so features should be assessed against each application's current implementation.

## Data and sanitisation

The repository versions of the original solution replace enterprise connections with sanitised representative datasets. The documented approach includes reducing the source population, using historic representative data, replacing identifiers with synthetic labels and keys, shifting periods to the demonstration horizon, rounding values, and removing production connection details.

The datasets support inspection and demonstration of modelling structures and behaviour. They must not be interpreted as genuine current portfolio forecasts. The web applications use the sample CSVs under `07_streamlit_app/data/sample` and do not establish a live enterprise connection.

Confidential planning data, credentials, access tokens, and production infrastructure details must remain outside this repository. Detailed confidential validation material remains within controlled enterprise locations.

## Design principles

- **Transparency and traceability:** keep assumptions, case mappings, operations, parameters, and outputs inspectable.
- **Human oversight:** retain explicit user control over configuration and interpretation.
- **Baseline preservation:** transform copies of source profiles for scenario analysis.
- **Consistent treatment:** apply reusable modelling operations across comparable cases.
- **Separation of concerns:** distinguish data preparation, business logic, interface, and presentation.
- **Proportionate validation:** assess each implementation using evidence appropriate to its scope and maturity.

The Excel workbook uses worksheet protection without a password to reduce accidental changes to formulas, shapes, and controls. This is an interface and model-integrity safeguard, not an access-control mechanism.

## Technology and project context

The original solution uses Power BI, DAX, OLE DB, Excel, Power Query, Python in Excel, pandas, VBA, and Power Pivot. The subsequent application work adds a packaged Python engine, pytest, Streamlit, Plotly, FastAPI, Pydantic, React, Vite, and Recharts.

The framework was developed for a real Upstream portfolio-planning requirement as part of a Digital & Technology Solutions Professional degree project. This repository also records subsequent software development exploring how the modelling approach can support alternative application architectures and user experiences.

Recommended editor extensions are listed in [`.vscode/extensions.json`](.vscode/extensions.json). They are development conveniences rather than application runtime dependencies.

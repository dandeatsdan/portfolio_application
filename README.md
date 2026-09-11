# Upstream Portfolio Scenario Modelling Framework

## Project overview

This repository contains the working applications, source code, architecture, sanitised representative datasets, validation evidence and user documentation for an Upstream portfolio scenario modelling framework.

The framework supports long-term planning by allowing users to inspect a reference portfolio, select modelling cases, configure alternative assumptions and compare financial and production outcomes. The design objective is a **controlled, transparent and reproducible modelling process** that retains the flexibility required by expert portfolio and finance users.

The original DT603 implementation combines a governed Power BI semantic model with an Excel application and a modular Python-in-Excel scenario engine. Subsequent software development explores the same modelling methodology through a standalone Python package, a Streamlit interface and a React interface supported by a FastAPI backend.

Users remain responsible for scenario assumptions, interpretation and subsequent business decisions.

## Project and development status

The repository intentionally contains two related but distinct bodies of work.

### Original DT603 implementation and evidence

The original project comprises the governed semantic-model layer, Excel/Python modelling application, architecture documentation, testing and business-validation evidence, user guides, project-management material and project-diary evidence.

### Subsequent software development

Later work explores how the validated modelling concepts can evolve into more conventional software architectures and richer analytical workflows. This includes the shared Python package, Streamlit prototype and React/FastAPI application. These later implementations reuse the modelling approach but have their own implementation boundaries and verification requirements.

| Component | Purpose | Status / starting point |
| --- | --- | --- |
| Power BI semantic model | Governed data preparation, manual-profile integration and Financial Entity to Modelling Case translation. | Original DT603 implementation — [Semantic model README](00_semantic_model/README.md) |
| Excel application | Scenario configuration, Python calculations, VBA workflow controls and Power Pivot analysis. | Original DT603 implementation — [Excel application README](01_excel_application/README.md) |
| Streamlit application | Subsequent software development exploring a packaged Python engine and four-screen analytical workflow. | Implemented prototype — [Streamlit README](07_streamlit_app/README.md) |
| React / FastAPI application | Further separation of user interface, API, scenario state, persistence and comparative analysis. | Active subsequent development — [React README](08_react_app/README.md) |
| Portfolio Optimiser | Prescriptive-analysis workspace selecting reference cases under Capex and production constraints. | Initial React/FastAPI implementation with NPV optimisation, bounded flexibility and editable scenario hand-off |

The testing and business-validation evidence in `03_testing_and_validation` relates to the original framework. The later web applications build on that work, but reuse of the methodology does **not** by itself establish full numerical, functional or user-interface equivalence.

## Repository navigation

| Directory | Contents |
| --- | --- |
| [00_semantic_model](00_semantic_model/) | Sanitised source CSVs, Power Query implementation and the working `.pbix` semantic model. |
| [01_excel_application](01_excel_application/) | Sanitised application CSVs, VBA, DAX, Power Query, extracted Python code and the working `.xlsm` application. |
| [02_architecture](02_architecture/) | Nine SVG architecture diagrams and the editable master draw.io source. |
| [03_testing_and_validation](03_testing_and_validation/) | Business validation, performance, technical walkthrough and business walkthrough evidence for the original framework. |
| [04_user_guides](04_user_guides/) | Application user guide and operations user guide. |
| [05_project_management](05_project_management/) | Project management plan. |
| [06_project_diary_evidence](06_project_diary_evidence/) | E01–E11 supporting exhibits for the DT603 project diary. |
| [07_streamlit_app](07_streamlit_app/) | Streamlit application, shared Python package, sample data, automated tests and Horizon X design references. |
| [08_react_app](08_react_app/) | React frontend, FastAPI backend, local JSON scenario persistence, automated tests and implementation/design briefs. |

## Getting started

For an overview of the original solution, start with the [overall architecture](02_architecture/svg/001_overall_solution_architecture.svg), then review the [application user guide](04_user_guides/application_user_guide.pdf) and [validation overview](03_testing_and_validation/README.md).

The principal original working artefacts are the [Power BI semantic model](00_semantic_model/02_working_solution/data_pipeline.pbix) and [Excel scenario modelling application](01_excel_application/05_working_solution/scenario_modelling_application.xlsm). Their folder READMEs explain the implementation and sanitisation arrangements.

For the browser-based applications, follow the setup instructions in the [Streamlit README](07_streamlit_app/README.md) or [React README](08_react_app/README.md). These applications use local Python and sanitised representative CSV inputs and do not require a running Excel workbook or Power BI model.

The shared web-application engine resides in `07_streamlit_app/src/scenario_modeller`. The React backend imports that package and currently reads the representative sample datasets under `07_streamlit_app/data/sample`; retain both directories when running the React application locally. The Streamlit server itself does not need to be running for React.

## Modelling approach

The framework separates data preparation, case definition, scenario configuration, calculation and analytical presentation. Users configure controlled operations against modelling cases; the engine applies those instructions to copies of baseline financial and production profiles so the source baseline remains unchanged.

The committed operation library contains 12 controlled treatments covering:

- No Change;
- Delay and Accelerate;
- Farm In and Farm Down;
- Truncate Before and Truncate After;
- Production Change %;
- OPEX Change % and OPEX Change $m; and
- CAPEX Change % and CAPEX Change $m.

The original Excel implementation and the later shared Python package use the same core scenario concepts, although exact implementation and interface behaviour should always be assessed against the current code in each application.

## React development status

The React/FastAPI implementation has moved beyond a simple interface prototype. Current implemented capabilities include:

- Portfolio Viewer analysis, filtering, ranking, creaming analysis and shortlisting;
- configurable reference measures in Build a Scenario;
- operation-specific input validation and warning handling;
- explicit scenario run confirmation;
- persistent, reloadable and editable scenario definitions stored as local JSON files for the single-process prototype;
- stable saved-scenario URLs using `/build?scenario=<uuid>`;
- redesigned Scenario Results with four reference-aligned KPI cards;
- Primary and optional Comparison scenario selection;
- two configurable profile / variance analytical plots;
- waterfall breakdown by case, region, country, group entity or plan type; and
- a business-readable changes table with configurable impact metric and period.

The initial Portfolio Optimiser is available at `/optimise`. It selects reference cases to maximise NPV under user-defined constraints; see `08_react_app/Portfolio-Optimiser-Implementation-Brief.md` for the agreed scope and deferred features.

## Data and sanitisation

The repository versions of the original solution replace enterprise connections with sanitised representative datasets. The documented approach includes reducing the source population, using historic representative data, replacing identifiers with synthetic labels and keys, shifting periods to the demonstration horizon, rounding values and removing production connection details.

The datasets support inspection and demonstration of modelling structures and behaviour. They must not be interpreted as genuine current portfolio forecasts. The web applications use the sample CSVs under `07_streamlit_app/data/sample` and do not establish a live enterprise connection.

Confidential planning data, credentials, access tokens and production infrastructure details must remain outside this repository. Detailed confidential validation material remains within controlled enterprise locations.

## Design principles

- **Transparency and traceability:** keep assumptions, case mappings, operations, parameters and outputs inspectable.
- **Human oversight:** retain explicit user control over configuration and interpretation.
- **Baseline preservation:** transform copies of source profiles for scenario analysis.
- **Consistent treatment:** apply reusable modelling operations across comparable cases.
- **Separation of concerns:** distinguish data preparation, business logic, interface, persistence and presentation.
- **Proportionate validation:** assess each implementation using evidence appropriate to its scope and maturity.

The Excel workbook uses worksheet protection without a password to reduce accidental changes to formulas, shapes and controls. This is an interface and model-integrity safeguard, not an access-control mechanism.

## Technology and project context

The original solution uses Power BI, DAX, OLE DB, Excel, Power Query, Python in Excel, pandas, VBA and Power Pivot. Subsequent application work adds a packaged Python engine, pytest, Streamlit, Plotly, FastAPI, Pydantic, React, Vite and Recharts.

The framework was developed for a real Upstream portfolio-planning requirement as part of a Digital & Technology Solutions Professional degree project. This repository also records subsequent software development exploring how the modelling approach can support alternative application architectures, persistent scenario workflows, richer comparative analytics and portfolio optimisation.

Recommended editor extensions are listed in [`.vscode/extensions.json`](.vscode/extensions.json). They are development conveniences rather than application runtime dependencies.

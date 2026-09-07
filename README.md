# Upstream Portfolio Scenario Modelling Framework

## Project Overview

This repository contains the **working solution, source code, technical architecture, sanitised representative datasets, validation evidence, and user documentation** for an Upstream portfolio scenario modelling framework supporting long-term planning and portfolio analysis.

The project addresses a business need for a more **controlled, transparent, and reproducible approach to scenario modelling**, reducing reliance on repeated manual spreadsheet reconstruction while retaining the flexibility required by expert portfolio and finance users.

The implemented solution enables users to construct alternative portfolio scenarios by selecting modelling cases and applying controlled operations such as timing changes, participation changes, truncation, and financial or production adjustments. User selections are translated into standardised scenario instructions and executed through a modular Python-in-Excel modelling engine.

The framework combines a governed semantic data layer with a user-facing Excel application, allowing scenario assumptions to be applied consistently to financial and production profiles before outputs are aggregated and analysed interactively.

The solution is designed as **decision support rather than automated decision-making**. Users remain responsible for scenario assumptions, configuration, interpretation, and subsequent business decisions.

---

## Working Solution

The repository contains sanitised working versions of both principal solution components:

| Component | Working Artefact | Purpose |
| :-------- | :--------------- | :------ |
| Semantic Model | [Power BI Semantic Model](00_semantic_model/02_working_solution/data_pipeline.pbix) | Sanitised working semantic model providing the governed data-preparation layer and representative upstream datasets used by the modelling framework. |
| Excel Scenario Modeller | [Excel Scenario Modelling Application](01_excel_application/05_working_solution/scenario_modelling_application.xlsm) | Sanitised working Excel application containing the user interface, scenario configuration, Python modelling engine, validation controls, and analytical outputs. |

Production enterprise connections have been removed from these repository versions and replaced with representative sanitised datasets.

The objective of the repository artefacts is **functional and structural equivalence rather than numerical equivalence** with the production implementation.

The Excel application uses **worksheet protection** to preserve the intended interface and reduce the risk of accidental changes to formulas, shapes, controls, and other application components. Protection is intentionally applied **without a password**: it is a usability and model-integrity safeguard rather than a security control.

---

## Solution Architecture

The implemented framework combines:

- a governed semantic model providing standardised financial, production, and reference data;
- controlled integration of approved manual modelling profiles;
- Financial Entity to Modelling Case translation;
- purpose-specific interfaces between the semantic model and Excel;
- guided scenario configuration and embedded validation;
- a modular Python-in-Excel scenario modelling engine;
- timing, ownership, production, cost, and capital scenario operations;
- pre-tax, post-tax, and discounted cash-flow calculations;
- Power Pivot and DAX for interactive aggregation and scenario analysis;
- VBA controls for application navigation and execution;
- model-health logging and user-facing validation messages; and
- structured testing, business validation, and performance assessment.

The architecture applies principles including **data minimisation, purpose limitation, transparency, traceability, human oversight, consistent treatment, separation of concerns, and governance by design**.

---

## Repository Navigation

```text
Upstream-Portfolio-Scenario-Modelling/
│
├── .vscode/
│   └── extensions.json
│
├── 00_semantic_model/
│   ├── 00_sanitised_datasets/
│   │   ├── 001_controlled_manual_profile_integration/
│   │   │   ├── manual_metadata.csv
│   │   │   └── manual_profiles.csv
│   │   ├── 002_controlled_transaction_scope/
│   │   │   ├── accounts_calc_logics.csv
│   │   │   ├── accounts_derived_names.csv
│   │   │   ├── accounts_sorting.csv
│   │   │   ├── accounts_system.csv
│   │   │   └── transaction.csv
│   │   ├── 003_financial_entity_case_translation/
│   │   │   └── fin_entity_to_case.csv
│   │   └── 004_semantic_model_reference/
│   │       ├── financial_entity.csv
│   │       └── tax_rates.csv
│   │
│   ├── 01_power_query/
│   │   ├── 001_controlled_manual_profile_integration.pq
│   │   ├── 002_controlled_transaction_scope.pq
│   │   ├── 003_financial_entity_case_translation.pq
│   │   └── 004_semantic_model_reference.pq
│   │
│   ├── 02_working_solution/
│   │   └── data_pipeline.pbix
│   │
│   └── README.md
│
├── 01_excel_application/
│   ├── 00_sanitised_datasets/
│   │   ├── 001_case_listing.csv
│   │   ├── 002_profiles.csv
│   │   ├── 003_taxrates.csv
│   │   ├── 004_totals_avgs.csv
│   │   └── 005_operations_library.csv
│   │
│   ├── 01_vba/
│   │   ├── 001_refresh_inputs.bas
│   │   ├── 002_refresh_python_engine.bas
│   │   ├── 003_refresh_scenario_results.bas
│   │   └── 004_page_navigation.bas
│   │
│   ├── 02_DAX/
│   │   ├── oledb_queries/
│   │   │   ├── 001_case_listing.dax
│   │   │   ├── 002_profiles.dax
│   │   │   ├── 003_taxrates.dax
│   │   │   └── 004_totals_avgs.dax
│   │   └── power_pivot_measures/
│   │       └── 001_measures.dax
│   │
│   ├── 03_power_query/
│   │   └── 001_scenario_results_capture.pq
│   │
│   ├── 04_python/
│   │   ├── 001_init_timer_start.py
│   │   ├── 002_dataframe_setup.py
│   │   ├── 003_scenario_instructions.py
│   │   ├── 004_operations_library.py
│   │   ├── 005_model_engine.py
│   │   └── 006_timer_end.py
│   │
│   ├── 05_working_solution/
│   │   └── scenario_modelling_application.xlsm
│   │
│   └── README.md
│
├── 02_architecture/
│   ├── source/
│   │   └── 000_master_architecture_diagram.drawio
│   │
│   └── svg/
│       ├── 001_overall_solution_architecture.svg
│       ├── 002_semantic_model_data_integration.svg
│       ├── 003_controlled_transaction_scope.svg
│       ├── 004_controlled_manual_profile_integration.svg
│       ├── 005_financial_entity_case_translation.svg
│       ├── 006_semantic_model_to_excel_interface.svg
│       ├── 007_scenario_configuration_workflow.svg
│       ├── 008_python_engine_architecture.svg
│       └── 009_python_engine_dependency_map.svg
│
├── 03_testing_and_validation/
│   ├── evidence/
│   │   ├── 01_business_validation.pdf
│   │   ├── 02_performance-and-scalability.pdf
│   │   ├── 03_technical-sme-walkthrough.pdf
│   │   └── 04_business-sme-walkthrough.pdf
│   └── README.md
│
├── 04_user_guides/
│   └── application_user_guide.pdf
│
├── 05_project_management/
│   └── project_management_plan.pdf
│
├── 06_project_diary_evidence/
│   ├── E01_project_reengagement_terms_of_reference.svg
│   ├── E02_business_support_evaluation_request.svg
│   ├── E03_azure_devops_delivery_control.svg
│   ├── E04_financial_metric_definition.svg
│   ├── E05_case_translation_manual_profiles.svg
│   ├── E06_scenario_configuration_validation.svg
│   ├── E07_analytical_method_scope.svg
│   ├── E08_horizon_x_design_review.svg
│   ├── E09_business_validation_execution.svg
│   ├── E10_stakeholder_evaluation.svg
│   ├── E11_repository_sanitisation.svg
│   └── README.md
│
└── README.md
```

---

## Repository Areas

### [`00_semantic_model`](00_semantic_model/)

Contains the **working sanitised Power BI semantic model**, representative source datasets, and documented Power Query implementation supporting the governed data layer.

The semantic-model implementation covers:

- controlled manual-profile integration;
- transaction scoping and account derivation;
- Financial Entity to Modelling Case translation;
- Financial Entity and Plan Type reference structures;
- tax-rate integration; and
- preparation of the datasets exposed to the Excel application.

Detailed technical and sanitisation documentation is provided in the [Semantic Model README](00_semantic_model/README.md).

---

### [`01_excel_application`](01_excel_application/)

Contains the **working sanitised Scenario Modelling application** together with the extracted implementation artefacts supporting its operation.

The folder includes:

- **Sanitised datasets** — representative application inputs replacing live semantic-model connections;
- **VBA** — application navigation, input refresh, Python execution, and output-refresh controls;
- **DAX** — semantic-model OLE DB queries and Power Pivot analytical measures;
- **Power Query** — capture of Python-generated scenario results;
- **Python** — input preparation, scenario instruction generation, reusable operations, financial calculations, validation, and engine orchestration; and
- **Working solution** — the final sanitised `.xlsm` application.

Detailed implementation documentation is provided in the [Excel Application README](01_excel_application/README.md).

---

### [`02_architecture`](02_architecture/)

Contains the technical architecture and engineering diagrams documenting the framework from governed source data through scenario configuration, calculation, and analytical output.

The architecture set comprises:

1. [Overall Solution Architecture](02_architecture/svg/001_overall_solution_architecture.svg)
2. [Semantic Model Data Integration](02_architecture/svg/002_semantic_model_data_integration.svg)
3. [Controlled Transaction Scope](02_architecture/svg/003_controlled_transaction_scope.svg)
4. [Controlled Manual Profile Integration](02_architecture/svg/004_controlled_manual_profile_integration.svg)
5. [Financial Entity to Modelling Case Translation](02_architecture/svg/005_financial_entity_case_translation.svg)
6. [Semantic Model to Excel Interface](02_architecture/svg/006_semantic_model_to_excel_interface.svg)
7. [Scenario Configuration Workflow](02_architecture/svg/007_scenario_configuration_workflow.svg)
8. [Python Engine Architecture](02_architecture/svg/008_python_engine_architecture.svg)
9. [Python Engine Dependency Map](02_architecture/svg/009_python_engine_dependency_map.svg)

The editable master draw.io source is retained in [`02_architecture/source`](02_architecture/source/).

### Viewing the SVG diagrams

Individual architecture diagrams are provided as SVG files to preserve image quality and scalability.

GitHub's standard file preview may not render some SVG files correctly. If this occurs, the diagrams can be viewed by:

- opening the repository in **VS Code**;
- opening the repository in **GitHub Codespaces**; or
- opening the SVG file locally in a compatible browser or image viewer.

---

### [`03_testing_and_validation`](03_testing_and_validation/)

Contains the principal sanitised testing and validation evidence supporting the implemented solution.

| Evidence | Purpose |
| :------- | :------ |
| [Business Validation](03_testing_and_validation/evidence/01_business_validation.pdf) | Integrated evidence covering business replication checks, modelling-operation validation, manual-data integration, stakeholder feedback, and overall conclusions. |
| [Performance and Scalability](03_testing_and_validation/evidence/02_performance-and-scalability.pdf) | Controlled performance assessment across increasing modelling volumes and transformation complexity. |
| [Technical SME Walkthrough](03_testing_and_validation/evidence/03_technical-sme-walkthrough.pdf) | Evidence from the technical walkthrough covering architecture, integration, modelling logic, validation, and technical discussion. |
| [Business SME Walkthrough](03_testing_and_validation/evidence/04_business-sme-walkthrough.pdf) | Evidence from the business walkthrough covering usability, business relevance, governance, transparency, and scenario requirements. |

Further context is provided in the [Testing and Validation README](03_testing_and_validation/README.md).

Commercially sensitive detailed outputs and underlying planning information remain within controlled enterprise locations and are not reproduced in this repository.

---

### [`04_user_guides`](04_user_guides/)

Contains the user-facing guidance supporting operation of the Excel Scenario Modeller.

The [Application User Guide](04_user_guides/application_user_guide.pdf) covers:

- application navigation and workflow
- home-page model controls
- scenario configuration
- configurable input validation
- scenario-results analysis
- modelling operations
- Financial Entity to Modelling Case translation
- manual modelling-profile inputs

---

### [`05_project_management`](05_project_management/)

Contains the principal project-management artefact supporting delivery of the Upstream Portfolio Scenario Modelling Framework.

The [Project Management Plan](05_project_management/project_management_plan.pdf) covers:

- project objectives and scope
- delivery timeline and workstreams
- governance and delivery control
- stakeholder engagement and communication
- risk, dependencies, and mitigation
- success criteria, validation, and project closure

---

### [`06_project_diary_evidence`](06_project_diary_evidence/)

Contains high-resolution supporting evidence exhibits referenced in the DT603 Part B project diary.

The folder includes:

- E01–E11 evidence exhibits aligned to the six project-development themes
- supporting material covering governance, analytical development, validation, collaboration, and responsible publication
- higher-resolution versions provided to preserve readability where document conversion reduces image clarity
- a README index mapping each evidence exhibit to its purpose and corresponding file

---

## Data and Repository Sanitisation

The production solution operates with governed enterprise data and controlled organisational infrastructure that cannot be reproduced within this repository.

Separate sanitised working versions of the semantic model and Excel application were therefore created for technical inspection and demonstration.

The sanitisation approach includes:

- substantial reduction of the source population;
- use of representative historic rather than current planning data;
- replacement of Financial Entity, geography, and organisational identifiers with synthetic labels and keys;
- displacement of historic periods to the demonstration modelling horizon;
- deterministic material rounding of financial and production values;
- removal of genuine forward-looking portfolio forecasts;
- use of dummy representative manual modelling profiles;
- removal of production server, database, SharePoint, and other infrastructure details; and
- retention only of the data required to demonstrate application structure and behaviour.

The resulting repository datasets are **representative demonstration data**. They preserve the schemas, relationships, transformation logic, and behaviour required to inspect the solution but must not be interpreted as genuine historical or forecast portfolio information.

---

## Design and Governance Principles

The framework has been developed around several core principles:

- **Transparency** — assumptions, transformations, operations, and model status should remain inspectable.
- **Traceability** — source structures, case mappings, scenario operations, parameters, and outputs should remain identifiable through the modelling workflow.
- **Human oversight** — users explicitly configure scenarios and retain responsibility for interpreting results and making subsequent decisions.
- **Consistency** — common modelling operations apply standardised logic across comparable cases and scenarios.
- **Data minimisation** — only information required for the modelling purpose is selected and processed.
- **Purpose limitation** — data extraction and transformation are specifically aligned to the defined scenario-modelling requirement.
- **Separation of concerns** — data preparation, business mapping, user configuration, calculation, and analytical consumption remain logically distinct.
- **Embedded validation** — preventative input controls and execution-stage validation reduce the risk of invalid scenario outputs.
- **Baseline preservation** — scenario operations transform copies of source profiles rather than modifying the governed baseline.
- **Governance by design** — controlled inputs, mappings, validation, model logging, and standardised structures are embedded throughout the framework.

---

## Technology

The implemented solution uses a combination of:

**Power BI semantic modelling | DAX | OLE DB | Excel | Power Query | Python in Excel | pandas | VBA | Power Pivot | Git/GitHub**

The architecture deliberately separates responsibilities across these technologies rather than embedding the full solution within a single application layer.

This enables the underlying scenario methodology, data preparation, user interface, calculation logic, and analytical presentation to evolve independently where appropriate.

---

## Security and Confidentiality

This repository contains **sanitised working artefacts, representative datasets, implementation code, technical architecture, user documentation, and selected validation evidence**.

It must not contain:

- confidential planning or portfolio data;
- genuine current or forward-looking portfolio forecasts;
- identifiable Financial Entity or organisational information;
- commercially sensitive detailed case outputs;
- credentials, access tokens, or connection secrets;
- production server, database, or SharePoint connection details; or
- unrestricted copies of controlled enterprise source datasets.

Production data and infrastructure remain subject to the organisation's established information-classification, access-control, and governance requirements.

Detailed confidential validation evidence and business materials are retained separately within controlled enterprise locations.

---

## Project Context

The framework was developed as part of a **Digital & Technology Solutions Professional degree project** and in response to a real Upstream portfolio-planning requirement.

The preceding research examined whether a governed scenario modelling framework could improve **transparency, reproducibility, and trusted decision support** within an expert analytical environment.

The implemented solution provides a practical demonstration of those principles through:

- governed data preparation;
- structured modelling-case definition;
- standardised scenario operations;
- automated financial transformation;
- embedded validation;
- transparent scenario comparison; and
- professional technical documentation and testing.

The repository provides the principal technical evidence base for understanding, inspecting, maintaining, and potentially extending the implemented framework.

---

## Recommended VS Code Extensions

The repository contains Python, DAX, Power Query/M, draw.io, Markdown, CSV, and PDF artefacts.

A set of recommended VS Code extensions is provided in [`.vscode/extensions.json`](.vscode/extensions.json) to improve syntax highlighting and file-preview support.

These extensions are **developer conveniences only** and are not runtime dependencies of the modelling solution.

---
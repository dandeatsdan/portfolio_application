# Excel Scenario Modelling Application

> **Project status:** this is the principal user-facing application delivered through the original DT603 project. The later Streamlit and React implementations are subsequent software-development explorations and should not be treated as part of the original delivery.

This folder contains the **working sanitised Upstream Scenario Modelling Application, supporting implementation code and representative input datasets**.

The Excel application enables users to select modelling cases, configure alternative scenarios, apply controlled modelling operations, validate instructions, execute the Python scenario engine and analyse resulting financial and production profiles.

The application integrates Excel, Python-in-Excel, Power Query, Power Pivot, DAX and VBA within a single controlled modelling environment, supported upstream by the governed semantic model.

The repository version has been deliberately sanitised and decoupled from controlled enterprise data sources so that the implemented application, calculation logic and user workflow can be inspected without access to production infrastructure or confidential portfolio information.

## Contents

| Artefact | Purpose |
| :------- | :------ |
| [Sanitised Datasets](00_sanitised_datasets/) | Six representative CSV datasets used by the repository version of the application. These replace live semantic-model interfaces while preserving the structures required by the workbook and Python scenario engine. |
| [VBA](01_vba/) | Application-control code supporting input refresh, Python execution, scenario-output refresh and page navigation. |
| [DAX](02_DAX/) | DAX implementation supporting semantic-model-to-Excel interfaces and the Power Pivot analytical layer. |
| [Power Query](03_power_query/) | Power Query implementation used to capture Python-generated scenario results and make them available to the Excel analytical model. |
| [Python](04_python/) | Modular Python-in-Excel implementation covering input preparation, scenario instruction generation, reusable modelling operations, scenario execution and runtime logging. |
| [Working Excel Application](05_working_solution/scenario_modelling_application.xlsm) | Working sanitised macro-enabled application configured to use representative repository datasets rather than live semantic-model connections. |

## Sanitised application datasets

The repository version uses six representative CSV datasets corresponding to the purpose-specific data and metadata interfaces required by the application.

| Dataset | Purpose |
| :------ | :------ |
| [`001_case_listing.csv`](00_sanitised_datasets/001_case_listing.csv) | Modelling-case population and associated hierarchy and classification attributes used for scenario configuration and downstream analysis. |
| [`002_profiles.csv`](00_sanitised_datasets/002_profiles.csv) | Representative financial and production profiles used as the baseline input to the Python scenario engine. |
| [`003_taxrates.csv`](00_sanitised_datasets/003_taxrates.csv) | Country × Year tax-rate assumptions required for post-tax scenario calculations. |
| [`004_totals_avgs.csv`](00_sanitised_datasets/004_totals_avgs.csv) | Supporting aggregated reference values used by the application. |
| [`005_operations_library.csv`](00_sanitised_datasets/005_operations_library.csv) | User-facing operation definitions, descriptions and parameter requirements used to guide scenario configuration. |
| [`006_metrics_helper.csv`](00_sanitised_datasets/006_metrics_helper.csv) | Metric-level presentation metadata, including whether selected measures should be inverted for user-facing display without changing the underlying analytical sign. |

These datasets are derived from the sanitised semantic-model implementation and make the repository workbook self-contained for inspection and demonstration.

The objective is **functional and structural equivalence rather than numerical equivalence**. The datasets preserve the structures and representative behaviour required by the application but must not be interpreted as genuine portfolio information.

## Current committed operation library

The committed operation metadata contains 12 controlled treatments:

| Operation | Purpose |
| --- | --- |
| No Change | Retains the reference profile unchanged. |
| Delay | Moves the profile later, with optional delay penalty treatment. |
| Accelerate | Moves the profile earlier, with optional funding treatment. |
| Farm In (Increase) | Increases the selected profile over an optional effective period. |
| Farm Down (Dilution) | Reduces the selected profile over an optional effective period and can recognise disposal proceeds. |
| Truncate Before | Removes profile values before a specified retain-from year. |
| Truncate After | Removes profile values after a specified retain-until year. |
| Production Change % | Applies a percentage adjustment to production over an optional period. |
| OPEX Change % | Applies a percentage adjustment to OPEX over an optional period. |
| CAPEX Change % | Applies a percentage adjustment to CAPEX over an optional period. |
| CAPEX Change $m | Applies up to two absolute CAPEX adjustments by amount and year. |
| OPEX Change $m | Applies up to two absolute OPEX adjustments by amount and year. |

The operation library is the reference for user-facing labels and parameter requirements. Engine-facing implementation keys are documented in the later shared Python package under `07_streamlit_app`.

## VBA application controls

The VBA implementation provides the application-level controls required to coordinate Excel, Python and Power Query execution.

| Module | Purpose |
| :----- | :------ |
| [Refresh Inputs](01_vba/001_refresh_inputs.bas) | Controls refresh of the application input datasets used by the scenario modeller. |
| [Refresh Python Engine](01_vba/002_refresh_python_engine.bas) | Controls execution of the embedded Python scenario-modelling workflow from the Excel interface. |
| [Refresh Scenario Results](01_vba/003_refresh_scenario_results.bas) | Coordinates refresh of scenario outputs after successful Python execution. |
| [Page Navigation](01_vba/004_page_navigation.bas) | Provides controlled navigation between the Home page and scenario configuration interfaces. |

The VBA layer acts primarily as an **application orchestration and user-control layer**. Core scenario calculation logic remains within Python rather than being distributed across workbook macros.

**Worksheet protection** is used to preserve the intended application interface and reduce accidental changes to formulas, controls and shapes. Protection is intentionally applied **without a password** and is an application-integrity safeguard rather than a security control.

Key refresh and execution actions use **double-confirmation prompts** to reduce accidental model runs or output refreshes.

## DAX and semantic-model interfaces

The DAX implementation is separated between purpose-specific queries used to retrieve data from the governed semantic model and analytical measures used within the Excel Power Pivot model.

### OLE DB queries

| Query | Purpose |
| :---- | :------ |
| [Case Listing](02_DAX/oledb_queries/001_case_listing.dax) | Retrieves the modelling-case population and supporting classification attributes required by the application. |
| [Profiles](02_DAX/oledb_queries/002_profiles.dax) | Retrieves the financial and production profiles consumed by the Python scenario engine. |
| [Tax Rates](02_DAX/oledb_queries/003_taxrates.dax) | Retrieves the tax-rate structures required for post-tax calculations. |
| [Totals and Averages](02_DAX/oledb_queries/004_totals_avgs.dax) | Retrieves supporting aggregate values used by the application. |

In the sanitised working application, live semantic-model connections have been replaced by the corresponding representative CSV datasets in [`00_sanitised_datasets`](00_sanitised_datasets/).

### Power Pivot measures

| Module | Purpose |
| :----- | :------ |
| [Power Pivot Measures](02_DAX/power_pivot_measures/001_measures.dax) | Analytical DAX measures used to aggregate, compare and analyse scenario outputs within the Excel application. |

This separation retains the distinction between **data retrieval**, **scenario calculation** and **analytical consumption**.

## Power Query

| Module | Purpose |
| :----- | :------ |
| [Scenario Results Capture](03_power_query/001_scenario_results_capture.pq) | Captures Python-generated scenario output and makes the resulting dataset available to the Excel data model for downstream Power Pivot analysis. |

Power Query therefore provides the controlled interface between the Python execution layer and the Excel analytical model.

## Python scenario engine

The Python implementation is separated into purpose-specific modules reflecting the execution lifecycle of the application.

| Module | Purpose |
| :----- | :------ |
| [Initialise Timer](04_python/001_init_timer_start.py) | Initialises execution timing used to report scenario-engine runtime. |
| [DataFrame Setup](04_python/002_dataframe_setup.py) | Loads, standardises and validates the principal case, profile and tax input datasets before scenario execution. |
| [Scenario Instructions](04_python/003_scenario_instructions.py) | Converts user selections from the Excel scenario sheets into standardised and validated engine instructions. |
| [Operations Library](04_python/004_operations_library.py) | Contains reusable case-level modelling operations, including timing, participation, truncation and financial or production adjustments. |
| [Model Engine](04_python/005_model_engine.py) | Orchestrates scenario execution, operation routing, financial calculations, post-tax processing, discounted cash-flow calculation, output construction and publication controls. |
| [Complete Timer](04_python/006_timer_end.py) | Completes execution timing and supports runtime reporting to the application. |

The modular structure deliberately separates **input preparation, user instruction translation, reusable business transformations and engine orchestration** rather than implementing the scenario methodology as one monolithic calculation block.

## Scenario execution workflow

```text
Semantic-model inputs
        ↓
Excel application
        ↓
Scenario configuration
        ↓
Input and instruction validation
        ↓
Python scenario engine
        ↓
Case-level modelling operations
        ↓
Pre-tax and post-tax calculations
        ↓
Scenario output validation
        ↓
Power Query capture
        ↓
Power Pivot / DAX analysis
        ↓
User interpretation and decision support
```

The application supports scenario analysis rather than automated decision-making. Users retain responsibility for selecting cases, defining operations and parameters, interpreting outputs and making subsequent business decisions.

## Production implementation reference

The repository preserves the principal implementation artefacts used by the working application while separating them from controlled production connectivity.

The files in `01_vba`, `02_DAX`, `03_power_query` and `04_python` document the application logic used by the implemented solution. The working repository application [`scenario_modelling_application.xlsm`](05_working_solution/scenario_modelling_application.xlsm) replaces live semantic-model inputs with representative CSV datasets.

This deliberately separates two repository purposes:

- **Implementation evidence** — extracted VBA, DAX, Power Query and Python modules document principal logic and interfaces.
- **Working demonstration** — the sanitised `.xlsm` can be inspected without production semantic-model connectivity or confidential portfolio data.

The corresponding sanitised semantic-model implementation is documented in [`00_semantic_model`](../00_semantic_model/README.md).

## Architecture alignment

| Architecture diagram | Relevance to the Excel application |
| :------------------- | :--------------------------------- |
| [Overall Solution Architecture](../02_architecture/svg/001_overall_solution_architecture.svg) | Positions the Excel application within the wider modelling framework and its relationship with the semantic model, Python engine and analytical outputs. |
| [Semantic Model to Excel Interface](../02_architecture/svg/006_semantic_model_to_excel_interface.svg) | Documents the purpose-specific interfaces through which governed model data is supplied to the Excel application. |
| [Scenario Configuration Workflow](../02_architecture/svg/007_scenario_configuration_workflow.svg) | Describes the user configuration and instruction-generation workflow preceding scenario execution. |
| [Python Engine Architecture](../02_architecture/svg/008_python_engine_architecture.svg) | Documents the modular structure and principal processing stages of the Python scenario modelling engine. |
| [Python Engine Dependency Map](../02_architecture/svg/009_python_engine_dependency_map.svg) | Describes the execution sequence and dependencies between Python-in-Excel modules. |

Together, these diagrams create a traceable path between **architecture design, implementation code, representative data and the working application**.

## Design and governance principles

- **Human oversight** — users explicitly select modelling cases, operations and assumptions; the application does not determine a preferred scenario.
- **Transparency** — scenario assumptions, operation parameters, execution status and outputs remain visible to the user.
- **Traceability** — scenario, case, operation and parameter information is retained through the calculation workflow and published outputs.
- **Consistent treatment** — reusable modelling operations apply standardised transformation logic across comparable cases.
- **Embedded validation** — input, configuration and execution controls identify invalid or incomplete instructions before results are published.
- **Separation of concerns** — user configuration, data preparation, transformation logic, orchestration and analytical consumption remain logically distinct.
- **Baseline preservation** — scenario operations transform copies of underlying case profiles rather than modifying the source baseline.
- **Fail-safe publication** — refreshed scenario outputs are published only after the complete engine run has successfully completed.
- **Decision support** — the application supports expert analytical judgement rather than replacing accountable business decision-making.

## User and validation documentation

Supporting material is available here:

- [Application user guide](../04_user_guides/application_user_guide.pdf)
- [Operations user guide](../04_user_guides/operations_user_guide.pdf)
- [Testing and validation overview](../03_testing_and_validation/README.md)

## Subsequent software evolution

The later [Streamlit application and shared Python package](../07_streamlit_app/README.md) and [React/FastAPI application](../08_react_app/README.md) explore how the same scenario-modelling concepts can operate outside Excel.

These developments should be treated as **post-DT603 software evolution**, not as retrospective changes to the delivered Excel application. Their interfaces, persistence behaviour, analytical services and automated tests are documented separately.

## Security and confidentiality

The datasets, source code and working application in this folder are provided solely to demonstrate the technical implementation.

The repository must not contain confidential planning or portfolio data, genuine current or forward-looking forecasts, identifiable Financial Entity or organisational information, credentials or tokens, production connection details, or unrestricted copies of controlled enterprise datasets.

Production data and infrastructure remain subject to the organisation's established information-classification, access-control and governance requirements.

[Return to repository overview](../README.md)

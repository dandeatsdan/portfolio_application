# Excel Scenario Modelling Application

This folder contains the **working sanitised Upstream Scenario Modelling Application, supporting implementation code and representative input datasets**.

The Excel application is the principal user-facing implementation of the modelling framework. It enables users to select modelling cases, configure alternative scenarios, apply controlled modelling operations, validate their instructions, execute the Python scenario engine and analyse the resulting financial and production profiles.

The application integrates Excel, Python-in-Excel, Power Query, Power Pivot, DAX and VBA within a single controlled modelling environment, supported upstream by the governed semantic model.

The repository version has been deliberately sanitised and decoupled from controlled enterprise data sources so that the implemented application, calculation logic and user workflow can be inspected without access to production infrastructure or confidential portfolio information.

## Contents

| Artefact | Purpose |
| :------- | :------ |
| [Sanitised Datasets](00_sanitised_datasets/) | Representative CSV datasets used by the repository version of the Excel application. These replace the live semantic-model interfaces while preserving the structures required by the application and Python scenario engine. |
| [VBA](01_vba/) | Application-control code supporting input refresh, Python execution, scenario-output refresh and page navigation. |
| [DAX](02_DAX/) | DAX implementation supporting the semantic-model-to-Excel interfaces and Power Pivot analytical layer. |
| [Power Query](03_power_query/) | Power Query implementation used to capture Python-generated scenario results and make them available to the Excel analytical model. |
| [Python](04_python/) | Modular Python-in-Excel implementation covering input preparation, scenario instruction generation, reusable modelling operations, scenario execution and runtime logging. |
| [Working Excel Application](05_working_solution/scenario_modelling_application.xlsm) | Working sanitised macro-enabled Excel application configured to use the representative repository datasets rather than live semantic-model connections. |

## Sanitised Application Datasets

The repository version of the application uses five representative CSV datasets corresponding to the purpose-specific interfaces normally supplied by the governed semantic model.

| Dataset | Purpose |
| :------ | :------ |
| [`001_case_listing.csv`](00_sanitised_datasets/001_case_listing.csv) | Provides the modelling-case population and associated hierarchy and classification attributes used for scenario configuration and downstream analysis. |
| [`002_profiles.csv`](00_sanitised_datasets/002_profiles.csv) | Provides the representative financial and production profiles used as the baseline input to the Python scenario engine. |
| [`003_taxrates.csv`](00_sanitised_datasets/003_taxrates.csv) | Provides the Country × Year tax-rate assumptions required for post-tax scenario calculations. |
| [`004_totals_avgs.csv`](00_sanitised_datasets/004_totals_avgs.csv) | Provides supporting aggregated reference values used by the application. |
| [`005_operations_library.csv`](00_sanitised_datasets/005_operations_library.csv) | Provides the user-facing operation definitions, descriptions and parameter requirements used to guide scenario configuration. |

These datasets are derived from the sanitised semantic-model implementation and are provided to make the repository Excel application self-contained for inspection and demonstration.

The objective is **functional and structural equivalence rather than numerical equivalence**. The datasets preserve the structures and representative behaviour required by the application but must not be interpreted as genuine portfolio information.

## VBA Application Controls

The VBA implementation provides the application-level controls required to coordinate Excel, Python and Power Query execution.

| Module | Purpose |
| :----- | :------ |
| [Refresh Inputs](01_vba/001_refresh_inputs.bas) | Controls refresh of the application input datasets used by the scenario modeller. |
| [Refresh Python Engine](01_vba/002_refresh_python_engine.bas) | Controls execution of the embedded Python scenario-modelling workflow from the Excel interface. |
| [Refresh Scenario Results](01_vba/003_refresh_scenario_results.bas) | Coordinates refresh of the scenario outputs after successful Python execution. |
| [Page Navigation](01_vba/004_page_navigation.bas) | Provides controlled navigation between the Home page and scenario configuration interfaces. |

The VBA layer acts primarily as an **application orchestration and user-control layer**. Core scenario calculation logic remains within Python rather than being distributed across workbook macros. 

**Worksheet protection** is also used to preserve the intended application interface and reduce accidental changes to formulas, controls, and shapes. Protection is intentionally applied **without a password** and is an application-integrity safeguard rather than a security control.

Key refresh and execution actions use **double-confirmation prompts** to reduce accidental model runs or output refreshes.

## DAX and Semantic-Model Interfaces

The DAX implementation is separated between the purpose-specific queries used to retrieve data from the governed semantic model and the analytical measures used within the Excel Power Pivot model.

### OLE DB Queries

| Query | Purpose |
| :---- | :------ |
| [Case Listing](02_DAX/oledb_queries/001_case_listing.dax) | Retrieves the modelling-case population and supporting classification attributes required by the application. |
| [Profiles](02_DAX/oledb_queries/002_profiles.dax) | Retrieves the financial and production profiles consumed by the Python scenario engine. |
| [Tax Rates](02_DAX/oledb_queries/003_taxrates.dax) | Retrieves the tax-rate structures required for post-tax calculations. |
| [Totals and Averages](02_DAX/oledb_queries/004_totals_avgs.dax) | Retrieves supporting aggregate values used by the application. |

These files preserve the implemented semantic-model interface logic for technical inspection.

In the sanitised working application, the live semantic-model connections have been replaced by the corresponding representative CSV datasets contained in [`00_sanitised_datasets`](00_sanitised_datasets/).

### Power Pivot Measures

| Module | Purpose |
| :----- | :------ |
| [Power Pivot Measures](02_DAX/power_pivot_measures/001_measures.dax) | Contains the analytical DAX measures used to aggregate, compare and analyse scenario outputs within the Excel application. |

This separation retains the distinction between **data retrieval**, **scenario calculation** and **analytical consumption**.

## Power Query

| Module | Purpose |
| :----- | :------ |
| [Scenario Results Capture](03_power_query/001_scenario_results_capture.pq) | Captures the Python-generated scenario output and makes the resulting dataset available to the Excel data model for downstream Power Pivot analysis. |

Power Query therefore provides the controlled interface between the Python execution layer and the Excel analytical model.

## Python Scenario Engine

The Python implementation is separated into a sequence of purpose-specific modules reflecting the execution lifecycle of the application.

| Module | Purpose |
| :----- | :------ |
| [Initialise Timer](04_python/001_init_timer_start.py) | Initialises execution timing used to report scenario-engine runtime. |
| [DataFrame Setup](04_python/002_dataframe_setup.py) | Loads, standardises and validates the principal case, profile and tax input datasets before scenario execution. |
| [Scenario Instructions](04_python/003_scenario_instructions.py) | Converts user selections from the Excel scenario sheets into standardised and validated engine instructions. |
| [Operations Library](04_python/004_operations_library.py) | Contains the reusable case-level modelling operations, including timing, ownership, truncation and financial or production adjustments. |
| [Model Engine](04_python/005_model_engine.py) | Orchestrates scenario execution, operation routing, financial calculations, post-tax processing, discounted cash-flow calculation, output construction and publication controls. |
| [Complete Timer](04_python/006_timer_end.py) | Completes execution timing and supports runtime reporting to the application. |

The modular structure deliberately separates **input preparation, user instruction translation, reusable business transformations and engine orchestration** rather than implementing the scenario methodology as one monolithic calculation block.

## Scenario Execution Workflow

The implemented application follows a controlled user and processing workflow:

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

The application supports scenario analysis rather than automated decision-making. Users retain responsibility for selecting cases, defining operations and parameters, interpreting model outputs and making subsequent business decisions.

## Production Implementation Reference

The repository preserves the principal implementation artefacts used by the working application while separating them from controlled production connectivity.

The files contained within `01_vba`, `02_DAX`, `03_power_query` and `04_python` document the application logic used by the implemented solution.

The working repository application [`scenario_modelling_application.xlsm`](05_working_solution/scenario_modelling_application.xlsm) replaces live semantic-model inputs with the representative CSV datasets contained in [`00_sanitised_datasets`](00_sanitised_datasets/).

This deliberately separates two repository purposes:

- **Implementation evidence** — the extracted VBA, DAX, Power Query and Python modules document the principal logic and interfaces used by the implemented solution.
- **Working demonstration** — the sanitised `.xlsm` provides a representative application that can be inspected without production semantic-model connectivity or confidential portfolio data.

The corresponding sanitised semantic-model implementation is documented separately in [`00_semantic_model`](../00_semantic_model/).

## Architecture Alignment

The Excel application and its interfaces are documented through the technical architecture diagrams contained in [`02_architecture`](../02_architecture/).

| Architecture Diagram | Relevance to the Excel Application |
| :------------------- | :--------------------------------- |
| [Overall Solution Architecture](../02_architecture/svg/001_overall_solution_architecture.svg) | Positions the Excel application within the wider modelling framework and shows its relationship with the semantic model, Python engine and analytical outputs. |
| [Semantic Model to Excel Interface](../02_architecture/svg/006_semantic_model_to_excel_interface.svg) | Documents the purpose-specific data interfaces through which governed model data is supplied to the Excel application. |
| [Scenario Configuration Workflow](../02_architecture/svg/007_scenario_configuration_workflow.svg) | Describes the user configuration and instruction-generation workflow preceding scenario execution. |
| [Python Engine Architecture](../02_architecture/svg/008_python_engine_architecture.svg) | Documents the modular structure and principal processing stages of the Python scenario modelling engine. |
| [Python Engine Dependency Map](../02_architecture/svg/009_python_engine_dependency_map.svg) | Describes the execution sequence and dependencies between the Python-in-Excel modules supporting the application. |

Together, these diagrams provide the principal architectural documentation for the **Excel application, scenario configuration workflow, Python execution layer and interfaces with the semantic model**.

The organisation of the extracted VBA, DAX, Power Query and Python source files deliberately aligns with these architectural components, creating a traceable path between **architecture design, implementation code, representative data and the working application**.

## Design and Governance Principles

The Excel application applies several principles established for the wider modelling framework:

- **Human oversight** — users explicitly select modelling cases, operations and assumptions; the application does not determine a preferred scenario.
- **Transparency** — scenario assumptions, operation parameters, execution status and model outputs remain visible to the user.
- **Traceability** — scenario, case, operation and parameter information is retained through the calculation workflow and published outputs.
- **Consistent treatment** — reusable modelling operations apply standardised transformation logic across comparable cases.
- **Embedded validation** — input, configuration and execution controls identify invalid or incomplete instructions before results are published.
- **Separation of concerns** — user configuration, data preparation, transformation logic, orchestration and analytical consumption remain logically distinct.
- **Baseline preservation** — scenario operations transform copies of the underlying case profiles rather than modifying the source baseline.
- **Fail-safe publication** — refreshed scenario outputs are published only after the complete engine run has successfully completed.
- **Decision support** — the application supports expert analytical judgement rather than replacing accountable business decision-making.

## Relationship to the Semantic Model

The Excel application is the downstream scenario configuration and calculation layer of the wider framework.

The production implementation receives governed case, profile, tax and supporting reference data from the semantic model through purpose-specific interfaces. The Excel application then provides the user workflow, scenario configuration, validation, Python execution and interactive analytical layer.

The repository preserves this architectural separation while replacing the live interfaces with sanitised representative datasets.

The corresponding working sanitised Power BI semantic model and its supporting implementation artefacts are available in [`00_semantic_model`](../00_semantic_model/).

## Security and Confidentiality

The datasets, source code and working application contained in this folder are provided solely to demonstrate the technical implementation.

The repository must not contain:

- confidential planning or portfolio data;
- genuine current or forward-looking portfolio forecasts;
- identifiable Financial Entity or organisational information;
- production credentials, access tokens or secrets;
- production server, database or SharePoint connection details; or
- unrestricted copies of controlled enterprise source datasets.

Production data and infrastructure remain subject to the organisation's established information-classification, access-control and governance requirements.

---
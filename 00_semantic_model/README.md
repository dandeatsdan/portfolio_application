# Semantic Model

This folder contains the **working sanitised semantic model, supporting Power Query implementation and representative datasets** developed as the governed data layer of the Upstream Portfolio Scenario Modelling Framework.

The semantic model provides the governed data layer supporting the Excel scenario modelling application. It prepares and integrates financial and production profiles, controlled manual inputs, Financial Entity reference data, modelling-case mappings, plan classifications and supporting tax assumptions before exposing purpose-specific datasets to the modeller.

The repository version has been deliberately sanitised so that the implemented architecture and model behaviour can be inspected without exposing confidential planning data, production infrastructure details or identifiable portfolio information.

## Contents

| Artefact | Purpose |
| :------- | :------ |
| [Sanitised Datasets](00_sanitised_datasets/) | Representative CSV datasets used by the repository version of the semantic model. These replace controlled enterprise and SharePoint source connections while preserving the schemas, relationships and representative structures required to demonstrate the implemented solution. |
| [Power Query](01_power_query/) | Sanitised production Power Query implementation organised into the same functional modules used within the semantic model: controlled manual-profile integration, controlled transaction scope, Financial Entity-to-case translation and semantic-model reference data. |
| [Working Semantic Model](02_working_solution/data_pipeline.pbix) | Working sanitised Power BI semantic model. Production-source ingestion has been replaced by the representative repository datasets, allowing the implemented model structure, transformations, relationships and downstream interfaces to be inspected without access to production data sources. |

## Power Query Modules

The Power Query implementation is organised to align with the technical architecture and data-engineering stages documented elsewhere in the repository.

| Module | Purpose |
| :----- | :------ |
| [Controlled Manual Profile Integration](01_power_query/001_controlled_manual_profile_integration.pq) | Documents the controlled ingestion and validation of manually supplied modelling profiles and associated metadata, including surrogate Financial Entity generation and integration into the common model structures. |
| [Controlled Transaction Scope](01_power_query/002_controlled_transaction_scope.pq) | Documents the preparation of the principal financial and production transaction dataset, including account selection, calculated-member derivation, transaction scoping and generation of the integrated modelling dataset. |
| [Financial Entity to Case Translation](01_power_query/003_financial_entity_case_translation.pq) | Documents the controlled mapping between source Financial Entities and the modelling cases presented to users within the scenario modeller. |
| [Semantic Model Reference](01_power_query/004_semantic_model_reference.pq) | Documents supporting Financial Entity, hierarchy, Plan Type and tax reference structures used by the semantic model and downstream Excel interfaces. |

## Sanitised Datasets

The representative CSV datasets are organised using the same functional structure as the Power Query implementation.

| Dataset Group | Repository Data |
| :------------ | :-------------- |
| [Controlled Manual Profile Integration](00_sanitised_datasets/001_controlled_manual_profile_integration/) | `manual_metadata.csv` and `manual_profiles.csv` provide representative manual-input metadata and profile data without retaining the controlled source workbooks. |
| [Controlled Transaction Scope](00_sanitised_datasets/002_controlled_transaction_scope/) | `accounts_calc_logics.csv`, `accounts_derived_names.csv`, `accounts_sorting.csv`, `accounts_system.csv` and `transaction.csv` provide the representative account structures, calculation mappings and transaction data required by the semantic-model pipeline. |
| [Financial Entity to Case Translation](00_sanitised_datasets/003_financial_entity_case_translation/) | `fin_entity_to_case.csv` provides the sanitised mapping between representative Financial Entities and modelling cases. |
| [Semantic Model Reference](00_sanitised_datasets/004_semantic_model_reference/) | `financial_entity.csv` and `tax_rates.csv` provide the representative Financial Entity and tax-reference structures required by the model. |

This structure is intentional. It creates a consistent naming convention across the **architecture diagrams, Power Query implementation, sanitised datasets and working semantic model**, making the implementation easier to inspect and trace.

## Data Sanitisation Approach

The production semantic model connects to governed enterprise data sources and controlled SharePoint inputs containing information that is not appropriate for inclusion within the project repository.

A separate sanitised implementation was therefore created for submission. The sanitisation process applied multiple controls, including:

- substantial reduction of the source population to a small representative set of Financial Entities;
- replacement of Financial Entity, geography and organisational identifiers with anonymous or synthetic labels and keys;
- use of historic rather than current planning-source data;
- displacement of historic periods to the demonstration modelling horizon;
- deterministic material rounding of financial and production values to remove unnecessary numerical precision;
- removal of genuine forward-looking portfolio forecasts and replacement with representative demonstration values;
- use of dummy data for manually supplied modelling profiles;
- removal of production server, database, SharePoint and other environment-specific connection details; and
- retention only of data required to demonstrate the architecture and scenario-modelling workflow.

The objective is **functional and structural equivalence rather than numerical equivalence**. The sanitised datasets preserve the schemas, relationships, transformations and representative analytical behaviour required to demonstrate the solution. They must not be interpreted as genuine historical or forecast portfolio information.

## Production Implementation Reference

The files contained in [`01_power_query`](01_power_query/) preserve sanitised versions of the production Power Query implementation for technical inspection.

Production server names, database names, SharePoint locations and other environment-specific identifiers have been removed or replaced with descriptive placeholders. Where appropriate, production connection logic is retained as non-executable reference code so that the implemented data-engineering approach remains inspectable.

The working repository model [`data_pipeline.pbix`](02_working_solution/data_pipeline.pbix) replaces these controlled production sources with the representative CSV datasets contained in [`00_sanitised_datasets`](00_sanitised_datasets/).

This deliberately separates two repository purposes:

- **Implementation evidence** — the `.pq` modules document how the production solution integrates and transforms its governed sources.
- **Working demonstration** — the `.pbix` uses sanitised representative data so that the semantic model can be inspected without production connectivity.

Small, stable reference dimensions may instead be represented directly within Power Query using static tables where introducing a separate external dataset would add no meaningful value.

## Architecture Alignment

The semantic-model implementation is documented through the technical architecture diagrams contained in [`02_architecture`](../02_architecture/). The first six diagrams in the architecture set describe the end-to-end flow from governed source data through semantic-model preparation and into the Excel scenario modelling application.

| Architecture Diagram | Relevance to the Semantic Model |
| :------------------- | :------------------------------ |
| [Overall Solution Architecture](../02_architecture/svg/001_overall_solution_architecture.svg) | Provides the end-to-end view of the modelling framework and the position of the semantic model between governed source data and the Excel scenario modelling application. |
| [Semantic Model Data Integration](../02_architecture/svg/002_semantic_model_data_integration.svg) | Describes the principal data sources, preparation stages and reference structures integrated within the semantic layer. |
| [Controlled Transaction Scope](../02_architecture/svg/003_controlled_transaction_scope.svg) | Documents transaction scoping, account selection, calculated-member derivation and preparation of the financial and production dataset used by the modeller. |
| [Controlled Manual Profile Integration](../02_architecture/svg/004_controlled_manual_profile_integration.svg) | Describes the controlled ingestion, validation and integration of manually supplied modelling profiles and associated metadata. |
| [Financial Entity to Case Translation](../02_architecture/svg/005_financial_entity_case_translation.svg) | Documents the translation between governed Financial Entity structures and the modelling cases exposed to scenario users. |
| [Semantic Model to Excel Interface](../02_architecture/svg/006_semantic_model_to_excel_interface.svg) | Describes the purpose-specific interface through which the semantic model supplies case, profile and supporting data to the Excel application. |

Together, these diagrams provide the principal architectural documentation for the semantic-model layer and its interfaces.

The naming and organisation of the sanitised datasets and Power Query modules in this folder deliberately align with these diagrams where applicable. This creates a traceable path between **architecture design, source code, representative data, the working semantic model and its downstream Excel interfaces**.

## Design Principles

The semantic-model implementation applies several principles established for the wider framework:

- **Data minimisation** — only data required for the modelling purpose is selected and processed.
- **Purpose limitation** — transformations and interfaces are designed around the defined scenario-modelling requirement.
- **Transparency** — data preparation and calculated-member logic remain inspectable.
- **Traceability** — source structures, mappings and transformations can be followed through the model.
- **Separation of concerns** — source preparation, reference data, case translation and scenario execution remain logically distinct.
- **Consistent treatment** — common data and calculation structures are applied systematically across modelling cases.
- **Governance by design** — controlled inputs, mappings, validation and purpose-specific interfaces are embedded within the architecture.

## Relationship to the Excel Modeller

The semantic model acts as the governed upstream data layer for the Excel scenario modelling application.

Purpose-specific queries expose the required case listing, modelling profiles and supporting reference information to Excel. The Excel application then provides scenario configuration, validation and execution through the Python-in-Excel scenario engine.

The sanitised repository implementation preserves this separation between **data preparation and governance in the semantic layer** and **scenario configuration and calculation in the application layer**.

For the repository working solution, the corresponding Excel application is also provided in sanitised form so that the downstream modelling workflow can be demonstrated without requiring access to the production semantic model or enterprise data sources.

## Security and Confidentiality

The datasets and working artefacts contained in this folder are provided solely to demonstrate the technical implementation.

The repository must not contain:

- confidential planning or portfolio data;
- genuine current or forward-looking portfolio forecasts;
- identifiable Financial Entity or organisational information;
- production credentials, access tokens or secrets;
- production server or database connection details; or
- unrestricted copies of controlled enterprise source datasets.

Production data and infrastructure remain subject to the organisation's established information-classification, access-control and governance requirements.

---
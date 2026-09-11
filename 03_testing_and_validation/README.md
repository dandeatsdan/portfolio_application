# Testing and Validation

This folder contains the principal testing and validation evidence for the **original DT603 Upstream Portfolio Scenario Modelling Framework**.

The evidence in this directory relates to the delivered semantic-model and Excel/Python implementation. The later Streamlit and React/FastAPI applications are subsequent software-development work and have their own automated tests and verification boundaries.

## Original DT603 validation evidence

| Artefact | Purpose |
| :------- | :------ |
| [Business Validation](evidence/01_business_validation.pdf) | Main validation pack integrating five controlled checks: Plan Book activity replication, Plan Book metric-profile alignment, scenario-operations testing, A&D dilution replication and manual-data integration. It also summarises the stakeholder survey and SME reviews before presenting the overall conclusion, evidence boundaries and recommendation. Representative operation-level evidence is included within the pack; commercially sensitive detailed outputs are retained separately. |
| [Performance and Scalability](evidence/02_performance-and-scalability.pdf) | Summary of controlled performance testing across increasing case volumes, scenario volumes and transformation complexity. It records the method, measured runtimes and output volumes, including testing of the full 144-case population aligned to the Plan Book activity cut across all five configured scenarios. |
| [Technical SME Walkthrough](evidence/03_technical-sme-walkthrough.pdf) | Supporting record of the technical demonstration and review, including the end-to-end architecture, data integration, modular Python engine, validation controls, questions raised and discussion of potential future processing and interface extensions. |
| [Business SME Walkthrough](evidence/04_business-sme-walkthrough.pdf) | Supporting record of the business SME walkthrough, including meeting notes, questions and responses, presentation material and the invitation email documenting the event and its purpose. The record covers business relevance, governance, transparency, usability and future scenario requirements. |

## Evidence boundaries

Commercially sensitive model outputs, detailed graphical comparisons and underlying planning data are retained in the appropriate controlled enterprise location and are not duplicated in this repository.

The Business Validation pack contains anonymised and summarised evidence sufficient to explain the test method, results and conclusions without exposing confidential portfolio information.

The evidence should be interpreted within the scope of the original project. It does not automatically establish that later software implementations are numerically or functionally equivalent to the Excel application.

## Subsequent software verification

The later software implementations include automated tests that verify specific code paths and behaviours. These tests are useful development evidence, but they are **not substitutes for the original business validation evidence** and should not be conflated with it.

### Shared Python package / Streamlit development

Automated tests under [`../07_streamlit_app/tests`](../07_streamlit_app/tests/) cover areas including:

- representative data loading and schema checks;
- baseline-preserving No Change behaviour;
- Delay behaviour and horizon clipping;
- post-tax calculations and tax-rate validation;
- repeat-safe derived-metric calculation;
- baseline/scenario reconciliation; and
- discounted cash-flow / NPV behaviour.

The [Streamlit README](../07_streamlit_app/README.md) records the current application boundaries and which shared services are actually wired into the active Streamlit interface.

### React / FastAPI development

Automated tests under `../08_react_app/backend/tests` and `../08_react_app/frontend/src` verify implemented areas including:

- operation-input validation;
- post-tax and reference-measure APIs;
- scenario execution and result-analysis services;
- saved-scenario persistence and conflict handling;
- scenario-definition rehydration and dirty-state behaviour;
- case filtering and sorting;
- scenario instruction construction;
- results-request and results-helper logic; and
- selected frontend component behaviour.

The [React README](../08_react_app/README.md) contains the current test commands, implementation scope and remaining manual-verification requirements.

## Validation versus verification

For this repository, the distinction is intentional:

- **Business and project validation** asks whether the original solution addressed the intended portfolio-planning requirement, produced credible results and was usable and governable in context.
- **Software verification** asks whether specific later code paths behave as designed under controlled tests.

Both matter, but they answer different questions. Passing software tests does not by itself establish business validity, while the original business-validation evidence does not automatically validate later interfaces, persistence mechanisms or newly introduced analytical services.

[Return to repository overview](../README.md)

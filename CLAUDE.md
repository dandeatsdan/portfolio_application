# Upstream Portfolio Scenario Modelling – Software Learning Prototype

## Purpose of this file

This file provides persistent project context and working instructions for Claude Code or another AI coding agent operating on the software-application experiment.

Read this file before proposing or making changes.

This work is a **post-project learning experiment**. The DT603 degree submission is complete and should be treated as a fixed reference implementation and evidence base. The purpose of the software experiment is to learn how the validated Scenario Modelling Framework could be expressed as a more conventional software application, not to rewrite the submitted project or imply that a new production system is being delivered.

The application should preserve the strongest ideas from the validated Framework while allowing deliberate experimentation with software-engineering practices such as package structure, state management, testing, persistence, UI separation, and reusable analytical services.

Do not invent business rules merely because a technically plausible implementation is possible.

---

## 1. Project intent

The validated Scenario Modelling Framework was created to support expert-led Upstream portfolio scenario analysis through a more controlled, transparent, repeatable, and traceable workflow.

The core business problem remains:

- users need to test alternative portfolio assumptions;
- scenario logic should be explicit rather than buried in ad-hoc spreadsheet manipulation;
- the same business treatment should be applied consistently across comparable cases;
- assumptions, mappings, configuration, and outputs should remain visible and challengeable;
- the analytical engine should support human judgement, not replace it.

Typical questions include:

- What happens if a modelling case is delayed or accelerated?
- What changes if ownership is increased or diluted?
- What is the impact of truncating a profile before or after a given year?
- What happens if production, Capex, or Opex assumptions are adjusted?
- How do alternative portfolio configurations compare?
- How do financial outcomes change after controlled scenario treatments?

Portfolio optimisation remains a possible later learning exercise. It is **not** part of the current validated capability and must not be presented as implemented until a separate optimisation approach has been designed, tested, and reviewed.

---

## 2. Current project status

The degree project produced a validated working Framework with two principal components:

1. **Governed Semantic Model Data Layer**
2. **Scenario Modelling Application**

The Scenario Modelling Application was implemented in Excel using:

- Python-in-Excel for the analytical engine;
- Power Query for controlled data movement and output capture;
- DAX / Power Pivot for analytical views;
- VBA for navigation, refresh sequencing, calculation-state control, and application orchestration.

The final project also included:

- controlled financial scope and calculated-member derivation;
- financial entity to modelling case translation;
- controlled manual-profile integration;
- standardised scenario instructions;
- a reusable operations library;
- operation-specific validation;
- contextual model logging;
- fail-safe scenario-output publication;
- post-tax and discounted-cash-flow processing;
- performance and scalability testing;
- business and SME validation;
- a sanitised repository containing representative datasets and code.

The software application should therefore be treated as a **new interface and software-engineering experiment around a validated analytical pattern**, not as a greenfield reinvention of the business logic.

---

## 3. Learning objectives for the software experiment

The main purpose is to learn.

Prioritise understanding and good engineering habits over speed or unnecessary feature volume.

Useful learning objectives include:

- separating UI, domain logic, data access, and analytical execution;
- creating a clean Python package structure;
- using explicit data contracts and typed models where they add value;
- handling application state without relying on workbook cells;
- persisting scenarios outside worksheet tabs;
- designing reusable services rather than page-specific calculations;
- writing unit and integration tests;
- creating readable validation notebooks;
- introducing structured logging;
- handling errors predictably;
- comparing baseline and scenario outputs;
- learning when JSON, SQLite, or another lightweight persistence layer is justified;
- exploring how a desktop-style analytical workflow can be represented in a web application.

Do not over-engineer the project merely to demonstrate software concepts. Add structure when there is a real problem for that structure to solve.

---

## 4. Source-of-truth hierarchy

When information conflicts, use this order of precedence:

1. **Validated business behaviour and documented stakeholder decisions from the final project**
2. **Final operation metadata and Python implementation in the submitted repository**
3. **Final semantic-model and application architecture documentation**
4. **Business-validation and SME walkthrough evidence**
5. **Final Excel application behaviour**
6. **Software-prototype behaviour**
7. **Earlier proof-of-concept or DT602 material**

The software prototype is never the source of truth merely because its implementation is newer.

Where possible, inspect the final repository rather than duplicating rules into this file.

Important reference locations in the final repository include:

```text
00_semantic_model/
01_excel_application/
02_architecture/
03_testing_and_validation/
04_user_guides/
05_project_management/
```

Key application references include the final operation metadata, scenario-instruction code, operations library, model engine, user guide, and architecture diagrams.

If a business rule is unclear, record the uncertainty and ask for clarification.

---

## 5. Confidentiality and safe development

The software experiment must use **sanitised, representative, synthetic, or otherwise approved data only**.

Never introduce production BP planning data into the learning repository.

### Mandatory rules

- Do not commit production data, genuine forward-looking planning data, A&D data, or confidential portfolio values.
- Do not commit credentials, tokens, passwords, connection strings, private endpoints, or `.env` files containing secrets.
- Do not recreate production connections unless explicitly requested for an approved environment.
- Do not add external telemetry, analytics, or network calls without explicit approval.
- Do not assume a repository is private simply because the original project was internal.
- Keep examples safe to share.
- Preserve the distinction between **functional/structural equivalence** and numerical equivalence.
- Treat sanitised tax rates and other representative reference data as modelling examples, not authoritative business assumptions.
- Avoid presenting the learning application as an official BP production product.

If branding is used, prefer a restrained visual theme. Do not add proprietary brand assets unless they are already approved for use in the repository.

---

## 6. Core analytical model

### 6.1 Preferred analytical grain

The analytical engine should normally work with tidy/tall data.

A representative scenario-output grain is:

```text
Scenario
Scenario Name
ID
Case
Case Name
Group Entity
Segment
Region
Country
Plan Type
Operation
Param1
Param2
Param3
Param4
Param5
Metric
Year
Value
RunDateTime
```

Exact columns should be derived from the final validated repository rather than assumed.

### 6.2 Planning horizon

The validated Framework primarily uses the planning horizon:

```text
2026–2040
```

Do not change the horizon globally without checking the operation logic, source-data preparation, tax reference data, and output expectations.

### 6.3 Metrics

The Framework supports financial and production measures required by the validated planning workflow.

Examples include:

- Production;
- Gross Margin;
- Cash Costs;
- Cash Capex;
- Underlying RCOP;
- Pre-Tax Cash Flow;
- Post-Tax RCOP;
- Post-Tax Free Cash Flow;
- Tax Charge;
- Cash Tax Payment.

Do not create or rename metrics casually. Metric names, signs, and downstream dependencies are part of the domain model.

---

## 7. Financial entity to modelling case translation

Source enterprise data may exist at a finer Financial Entity grain than is practical for portfolio scenario modelling.

The validated Framework therefore introduced an explicit **Financial Entity to Modelling Case** translation layer.

The software application should preserve this concept.

Important principles:

- the source Financial Entity remains traceable;
- users work with a practical business-facing modelling case;
- existing hierarchy levels may be used where they produce the required grouping;
- explicit overrides may be required;
- unmapped or ambiguous records must be visible;
- translation must not silently discard source records.

Do not simplify this into a generic lookup without understanding the validated mapping behaviour.

---

## 8. Manual profile integration

Controlled manual profiles are part of the validated architecture.

The software experiment may load representative manual cases directly from sanitised files, but it should retain the underlying design principles:

- standard input structure;
- explicit metadata;
- validation before ingestion;
- distinct identifiers;
- alignment to the same analytical schema as system-derived cases;
- visible source/type information;
- no separate hidden calculation path.

If the software prototype introduces a file-upload interface, validate file type, required columns, duplicate keys, metric coverage, year coverage, and missing metadata before accepting the data.

---

## 9. Scenario configuration and instructions

The validated Framework separates user configuration from analytical execution.

Preserve that separation.

A scenario should capture, as appropriate:

- scenario ID;
- scenario name;
- description;
- baseline/version;
- included modelling cases;
- selected operation per case;
- operation parameters;
- comments or rationale;
- run timestamp;
- model version;
- validation status.

User-facing labels should not be passed directly into analytical functions where stable internal operation keys already exist.

The current validated application uses a common `Param1` to `Param5` structure, with operation metadata translating generic parameter positions into business-facing labels and required/optional rules.

A future software UI may use richer typed forms, but the underlying operation contract must remain explicit and traceable.

---

## 10. Scenario operations

Do not maintain a second authoritative list of operations in this file.

Before implementing or migrating an operation, inspect the final repository's:

- operations metadata;
- operations-library Python code;
- scenario-instruction logic;
- user guide;
- validation evidence.

The validated library includes treatments across areas such as:

- no change / baseline retention;
- timing;
- ownership / scale;
- truncation;
- production and cost adjustments.

Some price-related concepts were explored during the project but were deliberately constrained or deferred where the business methodology was not sufficiently validated.

### Operation rules

Every migrated operation should:

1. Operate on a copy of baseline data.
2. Have explicit required and optional parameters.
3. Validate its own business rules.
4. Define affected metrics and years.
5. Define model-horizon behaviour.
6. Produce deterministic results.
7. Preserve operation metadata in the output/audit trail.
8. Have unit-test coverage.
9. Have readable before/after validation evidence.
10. Be reconciled to the validated Excel/Python behaviour before being marked complete.

Do not infer missing financial behaviour from the name of an operation.

---

## 11. Financial calculations

Financial calculations must remain separate from UI code.

The validated engine includes downstream financial-processing stages, including post-tax and discounted-cash-flow logic.

Important principles:

- preserve stable baseline values;
- keep transformations and derived calculations distinguishable;
- do not double-count impacts;
- make recalculation order explicit;
- preserve metric sign conventions;
- keep external assumptions separate from stable calculation logic;
- validate joins by country/key/year where applicable;
- fail clearly when required reference data is missing.

### Tax limitation

The validated project demonstrated a post-tax architecture, but representative tax assumptions are **not equivalent to validated country fiscal models**.

Do not imply otherwise.

If tax logic is migrated, the software application should preserve the separation between:

- external tax assumptions/reference data; and
- stable analytical calculation logic.

---

## 12. Target software architecture

The analytical engine should be independent of the UI.

A sensible learning-oriented structure is:

```text
software_app/
├── app.py
├── pyproject.toml
├── README.md
├── src/
│   └── scenario_modeller/
│       ├── __init__.py
│       ├── domain/
│       │   ├── models.py
│       │   └── validation.py
│       ├── data/
│       │   ├── loaders.py
│       │   ├── schemas.py
│       │   └── mappings.py
│       ├── engine/
│       │   ├── instructions.py
│       │   ├── operations.py
│       │   ├── financials.py
│       │   ├── scenario_engine.py
│       │   └── outputs.py
│       ├── services/
│       │   ├── scenario_service.py
│       │   └── comparison_service.py
│       ├── persistence/
│       │   └── scenario_store.py
│       └── ui/
│           ├── layout.py
│           ├── components.py
│           └── pages/
├── data/
│   ├── sample/
│   └── templates/
├── notebooks/
├── tests/
└── docs/
```

This is a guide, not a requirement to create every file immediately.

Create modules incrementally.

### UI technology

Streamlit is acceptable for the first learning prototype because it enables rapid iteration.

However:

- Streamlit is not the source of truth for analytical logic;
- do not embed business rules in widget callbacks;
- keep page code thin;
- engine functions should be callable from tests without Streamlit;
- state should be explicit rather than hidden in page code.

If a different UI technology is explored later, the analytical engine should not need to be rewritten.

---

## 13. Application workflow

A useful software workflow is:

1. **Home**
   - application status;
   - current baseline;
   - latest run;
   - validation state.

2. **Data**
   - baseline data;
   - modelling-case mapping;
   - manual profiles;
   - reference assumptions.

3. **Scenario Builder**
   - scenario metadata;
   - case selection;
   - operation selection;
   - operation parameters;
   - contextual decision-support information.

4. **Validate**
   - configuration completeness;
   - data issues;
   - mapping issues;
   - operation-specific validation.

5. **Run Scenario**
   - explicit execution;
   - progress/status;
   - model log.

6. **Results**
   - baseline versus scenario;
   - scenario-to-scenario;
   - metric/year filters;
   - case and business-dimension filters;
   - tables and charts.

7. **Scenario History**
   - saved configuration;
   - run metadata;
   - model version;
   - validation state;
   - comments.

8. **Testing / Validation**
   - representative reconciliation evidence;
   - operation test results;
   - known limitations.

Do not reproduce the Excel worksheet layout merely for parity. Preserve the workflow and domain behaviour, then use software-native interaction patterns where they improve usability.

---

## 14. Scenario persistence

One learning opportunity is removing the worksheet-based limit on scenario storage.

Do not introduce a database immediately unless persistence requirements justify it.

Suggested progression:

1. in-memory objects while the engine is being migrated;
2. JSON persistence for simple scenario-definition experiments;
3. SQLite if scenario history, querying, relationships, or run metadata make structured persistence useful.

A persisted scenario should never rely only on display labels. Save stable identifiers and model-version metadata where possible.

---

## 15. Outputs and visualisation

The software application should support:

- baseline versus scenario comparison;
- scenario-to-scenario comparison;
- absolute and percentage deltas where meaningful;
- filtering by business dimensions;
- filtering by case;
- filtering by metric;
- year-range selection;
- tabular and chart views;
- export of structured results;
- visible scenario metadata;
- visible assumptions and operations.

Do not prioritise visual polish over analytical correctness.

Avoid overwhelming users with charts. A good analytical table is often more useful than an additional visual.

---

## 16. Testing strategy

Testing should occur at several levels.

### 16.1 Unit tests

Test:

- data preparation;
- mapping logic;
- operation validation;
- individual operations;
- financial calculations;
- output shaping;
- persistence functions.

### 16.2 Integration tests

Test representative end-to-end paths:

```text
sanitised baseline
→ modelling-case mapping
→ scenario configuration
→ instruction generation
→ operation execution
→ financial processing
→ validation
→ published output
```

### 16.3 Validation notebooks

Notebooks should be readable evidence, not just scratchpads.

Useful notebooks may include:

```text
01_data_validation.ipynb
02_mapping_validation.ipynb
03_operation_reconciliation.ipynb
04_financial_reconciliation.ipynb
05_engine_end_to_end.ipynb
06_software_output_validation.ipynb
07_optimisation_exploration.ipynb   # only when appropriate
```

Each should show:

- inputs;
- expected behaviour;
- actual behaviour;
- before/after profiles;
- baseline/scenario/delta;
- row counts and key checks;
- interpretation;
- limitations.

### 16.4 Reconciliation

A migrated feature is not complete because its test passes against itself.

Where possible, reconcile it to:

- the validated Excel/Python implementation;
- the final business-validation evidence;
- an approved reference case.

---

## 17. Error handling and logging

The validated Framework deliberately moved away from exposing raw Python errors to business users.

Preserve that principle.

The software application should distinguish:

- user/configuration validation errors;
- data-quality errors;
- domain/business-rule errors;
- unexpected technical exceptions.

Messages should preserve useful context such as:

- scenario;
- modelling case;
- operation;
- parameter;
- year;
- metric;
- processing stage.

Do not swallow unexpected exceptions silently.

For development, retain technical details in logs while showing a clearer message in the UI.

---

## 18. Ethical and professional guardrails

The software experiment should preserve the principles established in the validated Framework:

- **Transparency** — assumptions, mappings, operations, and limitations remain visible.
- **Reproducibility** — the same baseline and scenario definition should produce the same result.
- **Consistency** — comparable cases should be treated with the same documented rules.
- **Human oversight** — users select assumptions and interpret outputs.
- **Accountability** — the application does not claim authority over portfolio decisions.
- **Data minimisation** — only data required for the learning task should be loaded.
- **Professional integrity** — do not overstate precision, validation, scale, or deployment status.

The application is deterministic decision support. It is not an autonomous recommendation engine.

---

## 19. Instructions for Claude Code

When working in this repository:

1. **Inspect before editing.** Read the relevant code, tests, metadata, and documentation first.
2. **Preserve the validated domain behaviour.** Do not redesign business rules for software elegance.
3. **Make small, testable changes.** Prefer one capability at a time.
4. **Keep UI and engine separate.** UI pages call services or engine functions.
5. **Do not mutate baseline data.** Work on explicit copies.
6. **Do not invent domain logic.** Ask when the governing behaviour is unclear.
7. **Prefer reuse over duplication.** Do not create parallel calculation paths.
8. **Avoid premature abstractions.** A simple function is preferable to an unnecessary framework.
9. **Use clear names and type hints where useful.**
10. **Add tests with logic changes.**
11. **Reconcile migrated logic to the validated implementation.**
12. **Document assumptions and limitations.**
13. **Protect confidential information.**
14. **Explain larger changes before making them.** State files, intent, risks, and validation steps.
15. **Do not claim checks were run when they were not.**
16. **Report actual test results clearly.**
17. **Do not optimise before measuring.**
18. **Do not implement portfolio optimisation until the core engine is reconciled and stable.**
19. **Do not refactor unrelated code while completing a focused task.**
20. **Prefer understandable code over clever code.**

---

## 20. Current learning priorities

The recommended sequence is:

1. Inspect the final sanitised datasets and validated Python engine.
2. Create a minimal software package and test harness.
3. Load representative baseline data into a clean internal schema.
4. Recreate modelling-case selection and scenario metadata.
5. Migrate `NoChange` as the first end-to-end operation.
6. Migrate one meaningful operation, such as `Delay`, and reconcile it to the validated implementation.
7. Introduce operation metadata and dynamic parameter forms.
8. Add scenario validation and structured logging.
9. Add baseline/scenario result comparison.
10. Add simple scenario persistence.
11. Migrate the remaining validated operations incrementally.
12. Add downstream financial calculations only after operation parity is established.
13. Explore richer scenario comparison and history.
14. Explore optimisation only as a separate later learning exercise.

The objective is not to rebuild everything at once.

---

## 21. Definition of done for a migrated capability

A migrated feature is complete only when:

- the intended business behaviour is understood;
- the governing source has been identified;
- inputs and outputs are explicit;
- implementation is separate from UI code;
- baseline data remains unchanged;
- validation behaviour is defined;
- edge cases are documented;
- unit tests pass;
- relevant integration tests pass;
- results have been reconciled to the validated implementation;
- assumptions and limitations are documented;
- the UI exposes the feature clearly;
- useful audit/run metadata is retained;
- no confidential data has been introduced.

If reconciliation has not been completed, label the feature **experimental** rather than complete.

---

## 22. Communication style for project support

The project owner has deep finance, planning, data, and transformation experience and is using this experiment to develop software-engineering skills.

When explaining work:

- be direct;
- explain the architecture in practical terms;
- state exact file paths;
- show how modules connect;
- provide complete runnable code when requested;
- explain unfamiliar Python or software-engineering concepts rather than assuming them;
- distinguish domain decisions from software decisions;
- point out when an approach is technically valid but unnecessarily complex;
- help the owner understand the code rather than simply generating it.

Where several solutions are possible, recommend the simplest option that preserves the validated analytical behaviour and creates useful learning.

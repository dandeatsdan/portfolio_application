# Upstream Portfolio Scenario Modelling — coding-agent guidance

## Purpose of this file

This file provides persistent project context and working instructions for Claude Code or another AI coding agent operating on the software-application experiment.

Read this file before proposing or making changes.

Last reviewed: 7 September 2026; updated on `feature/shared-post-tax-calculations`. The original review used `e26d69cfa89f0032f4694e3aa87e7ec22f5c049e`; financial-processing, React publication and test notes below now reflect this feature. Inspect the latest affected code before acting.

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

The original DT603 implementation combines a governed Power BI semantic model with an Excel application using Python in Excel, Power Query, DAX/Power Pivot, and VBA. Its architecture, working artefacts, business validation, and project evidence remain the reference base.

Subsequent application development is already present:

| Area | Current implementation |
| --- | --- |
| `00_semantic_model/` | Original governed data-preparation layer and sanitised working artefact. |
| `01_excel_application/` | Original Excel implementation, including six extracted Python blocks. |
| `07_streamlit_app/` | Packaged Python engine, representative CSV data, automated tests, and active four-screen Streamlit application. |
| `08_react_app/` | React frontend and FastAPI backend using the Python package and sample data from `07_streamlit_app`. |

All 12 dispatch operations in the committed Excel Python library exist in the shared web library. One targeted synthetic example per operation produced matching dataframes during the gap review. This is limited evidence of operation parity, not full regression, UI, workbook, or business validation.

The complete Excel execution pipeline has **not** been ported. React now uses shared post-tax processing for baseline and scenario results, fixed-origin post-tax NPV, and a valid-run publication gate. Its response includes all five instruction parameters, scenario metadata and row timestamps. Complete preparation diagnostics, multiple-scenario orchestration and active Streamlit integration remain gaps; see the gap review's feature update.

Do not describe either web application or its entire engine as validated merely because it reuses the original methodology. Preserve the original project artefacts as reference material; do not modify them as a side effect of web-app work.

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

Distinguish intended business behaviour from what is actually implemented. For implementation claims, inspect executable code and the active call path, not comments, README assertions, or the mere presence of a data file. If approved behaviour, metadata, extracted Python, and workbook behaviour disagree, identify the discrepancy rather than silently choosing a new rule.

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

The [Excel-to-web gap review](08_react_app/Excel-Python-to-Web-Application-Gap-Review.md) records source comparisons and targeted synthetic checks. Treat it as a dated diagnostic baseline, not proof that later code still has the same gaps. Reference G01–G12 when implementing a corresponding fix, and record the evidence needed to close it.

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

## 6. Core analytical contracts

### 6.1 Inputs and keys

- Case-listing required columns: `ID`, `Case`, `Group Entity`, `Segment`, `Region`, `Country`, `Plan Type`, `Case Name`, and `Country Key`.
- Tall profiles: `ID`, `Case`, `Metric`, `Year`, and `Value`, with uniqueness at `ID × Metric × Year`.
- Tax inputs: `Country`, `Country Key`, `Year`, `ETR`, and `CTR`, with uniqueness at `Country Key × Year`.
- Scenario instructions: scenario identifier, case identifier, inclusion, operation key, and `Param1`–`Param5`, with case labels retained for context.

Distinguish full `Case` from display `Case Name`. Excel validates uniqueness of `ID` and full `Case`; do not assume the shorter display label is a stable unique identifier. Derive exact contracts from the current source before changing joins.

### 6.2 Output contract

Excel's published tall output includes:

```text
Scenario, Scenario Name, Scenario Description,
ID, Case, Case Name, Group Entity, Segment, Region, Country, Country Key, Plan Type,
Operation, Param1, Param2, Param3, Param4, Param5,
Metric, Year, Value, RunDateTime
```

The shared web engine currently emits a smaller schema: scenario, ID, Case, operation, five parameters, metric, year, value, and timestamp. React further reduces the rows at its API boundary. Do not confuse the target Excel contract with the current web response.

### 6.3 Horizon and metric names

The model horizon is **2026–2040**. Check operation logic, source profiles, tax coverage, discounting, and output expectations before changing it.

Use exact source keys, including `Total Production (mboed)`, `Total Cash Costs`, `Cash Capex`, `Underlying RCOP`, `Pre Tax Cash Flow`, `Post-Tax RCOP`, `Post-Tax Cash Flow`, `Tax Charge`, and `Cash Tax Payment`. These are examples, not a complete metric catalogue. A display label such as “Production” or “FCF” is not automatically a valid source key.

Do not casually rename metrics or change signs, units, precision, or aggregation rules. Inspect operation dependencies and the metrics helper; convert values for display without mutating analytical values. Profile preparation in Excel rounds to six decimal places, while the web loader currently does not. Treat that as an explicit parity decision.

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

Neither the committed Excel dispatch table nor the shared web dispatch table contains a price operation. Do not infer an implemented price capability from earlier discussions or the root README's broader wording. A price operation, chance-of-success treatment, or optimisation feature needs its own confirmed scope and methodology.

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

## 11. Financial calculations and parity requirements

Keep financial calculations in reusable Python services, separate from UI rendering. The shared web engine currently ends after operations and horizon clipping; the following describes the Excel reference behaviour to reproduce when that migration is requested.

### Post-tax calculation

After applying operations, Excel:

1. Adds scenario and case metadata through validated many-to-one joins.
2. Joins ETR and CTR by `Country Key × Year`.
3. Requires `Underlying RCOP` and `Pre Tax Cash Flow`, and checks tax-rate coverage on RCOP rows.
4. Uses `max(Underlying RCOP, 0)` as its taxable base.
5. Generates negative `Tax Charge` and `Cash Tax Payment` rows using ETR and CTR respectively.
6. Generates `Post-Tax RCOP` by subtracting tax charge magnitude from RCOP.
7. Matches cash tax to cash flow on `Scenario × ID × Year`, using a validated one-to-one join, then generates `Post-Tax Cash Flow`.
8. Records unmatched cash-flow rows and uses zero cash tax for those unmatched rows.

Preserve these specific assumptions unless the user requests and confirms a business-method change. Do not replace them with an inferred country fiscal model.

### Discounting

Excel generates `Discounted Post-Tax Cash Flow @ 8%` with:

```text
period = Year - 2026 + 1
discounted value = Post-Tax Cash Flow / (1.08 ** period)
```

2026 is period 1. Downstream DAX sums the annual discounted rows for NPV.

React's portfolio and scenario valuation APIs now use `services/valuation_service.py`: post-tax cash flow, a selectable rate (default 8%), and exponent `Year - 2026 + 1`. Year filters select cash flows without resetting the discount origin. Entity NPV, ranking and creaming must use this service. `Post-tax NPV` is a calculated ranking measure, not an annual metric to sum again. The Excel fixed-rate discounted profile row is not emitted. Streamlit's cumulative-contribution function remains unchanged and is not discounted cash flow.

Use the same declared calculation basis for reference and scenario comparisons. Prevent double-counting derived metrics already present in input files.

### Tax assumptions and validation

Representative tax inputs are modelling examples, not validated country fiscal models. Preserve the separation between reference assumptions and calculation logic. Check rate completeness, 0–1 bounds, unique country/year keys, coverage, and join cardinality.

React startup validates tax inputs and enriches a separate raw baseline through `engine/financials.py`. `services/scenario_service.py` applies operations to raw profiles and then calls the same financial calculation. Missing/invalid RCOP rates fail the candidate; unmatched cash-flow rows use zero cash tax with diagnostics, following Excel. The active Streamlit UI has not yet adopted this coordinator. The helper CSV registers all four derived metrics; derived Total/Avg5y values are calculated in memory without rewriting source totals.

---

## 12. Current software architecture and commands

Use the existing structure; do not scaffold a second application or duplicate the calculation engine.

| Path | Responsibility |
| --- | --- |
| `07_streamlit_app/app.py` | Streamlit entry point using `st.navigation` and `st.Page`. |
| `07_streamlit_app/app_pages/` | Active Streamlit screens. |
| `07_streamlit_app/pages/` | Older pages; not the active navigation configured by `app.py`. |
| `07_streamlit_app/src/scenario_modeller/data/` | CSV loaders and schemas. |
| `07_streamlit_app/src/scenario_modeller/domain/` | Domain models. |
| `07_streamlit_app/src/scenario_modeller/engine/` | Shared operations and scenario execution. |
| `07_streamlit_app/src/scenario_modeller/services/` | Portfolio and comparison services. |
| `07_streamlit_app/src/scenario_modeller/ui/` | Streamlit state helpers and theme. |
| `07_streamlit_app/data/sample/` | Six sample CSVs used by the application work. |
| `07_streamlit_app/tests/` | Current loader, NoChange, and Delay tests. |
| `07_streamlit_app/design_decks/` | Horizon X PDF and PowerPoint design reference. |
| `08_react_app/backend/` | FastAPI application, request/response schemas, data loading, and analytical routers. |
| `08_react_app/frontend/src/` | React pages, components, contexts, hooks, and API client. |

The FastAPI backend imports the `scenario-modeller` package from the sibling Streamlit directory and reads that directory's sample data. Keep the sibling layout unless an explicitly scoped refactor updates all dependencies. The Streamlit **server** is not required to run React.

New instruction-preparation, financial, validation, or output services should extend the shared package when they serve both applications. Existing portfolio calculations in API routers should be considered when establishing shared financial services; do not create competing financial definitions.

### Streamlit

Use Python 3.10+ in an activated environment. From the repository root:

```bash
cd 07_streamlit_app
python -m pip install -e ".[dev]"
python -m pip install --upgrade streamlit
python -m streamlit run app.py
```

The declared Streamlit minimum currently permits versions older than the navigation APIs used by the entry point. The upgrade step avoids that older installation; aligning the dependency minimum is a separate code/configuration task.

### React and FastAPI

From the repository root, install Python dependencies:

```bash
python -m pip install -e ./07_streamlit_app
python -m pip install -r ./08_react_app/backend/requirements.txt
```

In one terminal, starting at the repository root:

```bash
cd 08_react_app
python -m uvicorn backend.main:app --reload --port 8000
```

In another terminal, starting at the repository root:

```bash
cd 08_react_app/frontend
npm ci
npm run dev
```

Use Node.js/npm compatible with the checked-in Vite dependency. React is served at `http://localhost:5173`; the development proxy forwards `/api` to port 8000. The health endpoint is `/api/health`, and API documentation is at `/docs`.

Use `backend.main:app` from `08_react_app`: `main:app` from inside `backend` is inconsistent with its package-relative imports.

The checked-in configuration is for local development. A frontend build does not host Python or configure production API routing and browser-route fallbacks.

---

## 13. Active workflow and interface guidance

Both interfaces implement the same four screen names:

| Screen | React route | Purpose |
| --- | --- | --- |
| Home | `/` | Application entry point and navigation. |
| Portfolio Viewer | `/portfolio` | Explore reference data, filter, compare contributors, and shortlist cases. |
| Build a Scenario | `/build` | Review reference measures, configure cases and parameters, and run. |
| Scenario Results | `/results` | Compare scenario and reference outputs and inspect applied changes. |

Preserve this established journey unless a redesign is requested. Separate Data, Validate, Scenario History, and Testing screens are possible future concepts, not existing application pages or instructions to build them now.

For UI work, inspect the relevant Horizon X design reference and the application's existing components and theme. Preserve established layout and business-facing terminology; do not add technical implementation detail to user-facing screens without a user need. Keep analytical logic out of widget callbacks and React components.

### Scope and state issues to inspect before changing scenario behaviour

- Streamlit displays shortlisted `working_cl`, but initialises all cases as included and builds run instructions from the full `case_listing`. Hidden cases can remain included. Align the displayed count, instruction IDs, and intended reference/scenario population when fixing this.
- React passes `workingCases` to its run hook. Do not assume selection semantics are already equivalent between interfaces.
- Both paths build a reference run from the full case listing. Make the comparison population explicit.
- Active Streamlit fixes scenario ID to 1; React currently submits one scenario with default ID 1. The shared loop's ability to process multiple IDs is not end-to-end S1–S5 support.
- React stores scenario configuration in page-local hook state, while shortlist, filters, and the latest result use shared context. Inspect component lifetime before promising configuration persistence across navigation.

These are dated observations, not desired behaviours. Check the latest code and gap review before treating them as open issues.

---

## 14. Scenario persistence

Current applications use in-memory state; there is no durable scenario database or saved run history. Do not promise persistence across page reloads or process restarts.

One learning opportunity is removing the worksheet-based limit on scenario storage.

Do not introduce a database immediately unless persistence requirements justify it.

Suggested progression:

1. in-memory objects while the engine is being migrated;
2. JSON persistence for simple scenario-definition experiments;
3. SQLite if scenario history, querying, relationships, or run metadata make structured persistence useful.

A persisted scenario should never rely only on display labels. Save stable identifiers and model-version metadata where possible.

---

## 15. Outputs and visualisation

The following are design goals, not a statement that every item is currently implemented:

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

Committed tests are in `07_streamlit_app/tests` and `08_react_app/backend/tests`. The feature has 70 passing Python/API tests covering existing operations/loaders plus tax validation, repeat calculation, invalid-run withholding, NoChange reconciliation, fixed-origin valuation and NPV agreement across endpoints. From the repository root, install `08_react_app/backend/requirements-dev.txt`, then run `python -m pytest 07_streamlit_app/tests 08_react_app/backend/tests -q`. Frontend build passes with a bundle-size warning; browser acceptance checks remain outstanding because local preview access was blocked.

From `07_streamlit_app`, after installing `.[dev]`, run:

```bash
python -m pytest tests/
```

From `08_react_app/frontend`, check bundling with:

```bash
npm run build
```

A frontend build is not analytical validation. Use focused regression/integration checks for changed business behaviour, and verify the affected application boundary. Report what actually ran and its limitations. Documentation-only changes require source/path consistency checks rather than a new application test suite.

The levels below guide future validation; they are not a claim that all listed tests or notebooks exist.

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

### Publication contract

Excel marks the run invalid on operation or downstream financial failure and withholds reassignment of its published output. The low-level shared engine still returns successful rows plus errors, but React now calls `execute_scenario`, which withholds the entire candidate on any error. React keeps the previous successful result and labels it after a failed attempt. Active Streamlit still uses the low-level path and needs equivalent integration. An error count alone is not a publication gate.

When completing this migration, separate candidate diagnostics from a successfully published run, preserve the previous valid result on failure, and provide an explicit validity status to both interfaces. Handle empty/no-output runs deliberately. Retain the web engine's explicit missing-profile errors; the Excel loop silently skips such cases, so parity should not remove that improvement.

Preserve all five parameters, scenario metadata, and run metadata through the API. React currently removes parameters and timestamps; its applied-changes table uses dash placeholders. Return a normalised instruction snapshot rather than reconstructing assumptions from incomplete result rows.

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

## 20. Current implementation priorities

Use the [gap review](08_react_app/Excel-Python-to-Web-Application-Gap-Review.md) as the detailed evidence base. Do not restart package scaffolding, remigrate NoChange/Delay, or assume the remaining operations are absent.

The list below is the original parity roadmap. Shared post-tax processing, fixed-origin NPV, React publication gating and React instruction metadata are now implemented on this feature; validate them rather than rebuilding them. Active Streamlit adoption and full workbook/user acceptance remain outstanding. For remaining parity work, use this order:

1. **Make execution scope reliable.** Align shortlist/inclusion semantics and visible counts; distinguish candidate results from valid published runs (G04 and the shortlist finding).
2. **Preserve assumptions through React.** Return a normalised instruction snapshot with all five parameters, scenario metadata, and run context (G07, G09, G10).
3. **Complete shared financial processing.** Add validated tax inputs, post-tax metrics, and the explicit Excel discounting convention after operations (G01–G03).
4. **Align preparation and diagnostics.** Address text/key cleaning, duplicate Case checks, missing records, precision policy, controlled joins, correction summaries, and model-health reporting (G05–G07, G09, G11).
5. **Extend scenario orchestration and timing where required.** Support coordinated scenarios and explicit elapsed/timezone-aware run metadata (G08, G12).
6. **Reconcile the full path.** Compare input preparation, operations, derived metrics, output contracts, failure cases, and the two application boundaries.
7. **Consider persistence, richer history, or optimisation only when requested and justified.**

These priorities guide a requested implementation task; they do not authorise unrelated changes during a focused task. Keep gap statuses and validation evidence current when a capability is completed.

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

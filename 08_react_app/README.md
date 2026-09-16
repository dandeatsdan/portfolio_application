# React Portfolio Scenario Modeller

## Purpose and project status

This application is a subsequent software-development evolution of the original Upstream Portfolio Scenario Modelling Framework. It explores how the modelling methodology can operate through a conventional **React frontend + FastAPI backend** while continuing to reuse the shared Python scenario-modelling package under `07_streamlit_app`.

React is responsible for navigation, filters, case selection, scenario editing, persistence workflows and analytical presentation. FastAPI loads the representative inputs, validates and executes scenarios, serves portfolio-analysis endpoints, persists editable scenario definitions and provides results-analysis services.

This application was developed **after the original DT603 implementation**. The original Excel validation evidence does not automatically establish full validation of the React interface, API, persistence layer or later analytical services. The current web application should be assessed against its own code, tests and manual verification.

## Current architecture

```text
React / Vite frontend
        │
        │ /api
        ▼
FastAPI backend
        │
        ├── portfolio and reference-data services
        ├── scenario validation and execution
        ├── saved-scenario repository
        └── results-analysis services
        │
        ▼
Shared Python package
07_streamlit_app/src/scenario_modeller
        │
        ├── scenario operations
        ├── post-tax calculations
        ├── valuation / NPV
        └── comparison services
        │
        ▼
Sanitised representative CSV inputs
07_streamlit_app/data/sample
```

The Streamlit server does **not** need to be running. Its directory supplies the shared Python package and sample data used by FastAPI.

## Prerequisites

- Python 3.10 or later, preferably in an activated virtual environment.
- Node.js and npm compatible with the Vite version in `frontend/package.json`.
- Both `07_streamlit_app` and `08_react_app` retained in their current sibling locations.
- `04_user_guides/operations_user_guide.pdf` retained at the repository root's guide location because the frontend bundles it for the Operations guide link.

## Install dependencies

From the repository root:

```bash
python -m pip install -e ./07_streamlit_app
python -m pip install -r ./08_react_app/backend/requirements.txt
```

Install frontend dependencies using the committed lockfile:

```bash
cd 08_react_app/frontend
npm ci
```

## Start the application locally

Use two terminals.

### Terminal 1 — FastAPI

From the repository root:

```bash
cd 08_react_app
python -m uvicorn backend.main:app --reload --port 8000
```

The module path is important because `backend/main.py` uses package-relative imports.

### Terminal 2 — React / Vite

From the repository root:

```bash
cd 08_react_app/frontend
npm run dev
```

Open the frontend at `http://localhost:5173`.

During local development, Vite forwards `/api` requests to the backend on port 8000. Both processes must remain running.

Useful backend checks:

- `http://localhost:8000/api/health`
- `http://localhost:8000/docs`

## Current screens and routes

| Screen | Route | Purpose |
| --- | --- | --- |
| Home | `/` | Application entry point, workflow navigation and Saved scenarios access. |
| Portfolio Viewer | `/portfolio` | Explore the reference portfolio, filter it, inspect KPIs and charts, rank contributors, view creaming analysis and shortlist cases. |
| Build a Scenario | `/build` | Configure an editable scenario, manage shortlist membership, select operations and parameters, validate inputs, save definitions and run the scenario. |
| Portfolio Optimiser | `/optimise` | Maximise NPV through include/exclude selection under Capex and production limits, then review as an editable scenario. |
| Scenario Results | `/results` | Compare a Primary scenario with Reference and optionally another saved scenario using KPI cards, profile charts, variance waterfalls and a changes-impact table. |

Portfolio Optimiser is available at `/optimise` as a separate workflow, with its own Home card and top-navigation entry.

## Portfolio Viewer

Portfolio Viewer supports baseline portfolio exploration before scenario configuration.

Implemented capabilities include:

- shared left-hand filters;
- cumulative portfolio KPIs;
- configurable chart metrics and breakdowns;
- ranked-contributor analysis;
- creaming-curve analysis using NPV and Capex;
- sortable/filterable case-level tables;
- shortlist selection shared with Build a Scenario; and
- a View settings side pane using an Apply / Cancel interaction pattern.

The Portfolio Viewer is an analytical exploration screen. Shortlisting identifies cases that the user wants to modify, exclude or keep available for review; it does not automatically exclude unshortlisted cases from a later React scenario run.

## Build a Scenario

### Scenario inclusion contract

All loaded cases are included using their **reference profiles by default**.

The shortlist identifies cases to modify, explicitly exclude or retain for closer review. Cases under **Available cases** remain included at reference values. Removing a case from the shortlist restores its reference profile and default configuration.

Run instructions cover all loaded cases, using overrides only for shortlisted cases. An empty shortlist therefore represents a full unchanged portfolio. A run with every case explicitly excluded is disabled.

This contract applies to the React application. The active Streamlit UI has its own documented behaviour.

### Reference measures

Build a Scenario exposes three independently configurable reference columns shared by the Shortlisted and Available tables.

Current defaults are:

- Production;
- Cash Capex; and
- Post-tax NPV.

Available periods include individual years through 2040, total 2026–2030, average 2026–2030 and total 2026–2040. NPV supports total periods only and uses the shared fixed-origin valuation service.

Multi-year production totals use **mmboe**; annual and average production use **mboed**. Financial display values use the metrics-helper sign metadata where appropriate, while underlying analytical cash-flow signs remain unchanged.

The reference-column configuration opens in a separate **Edit metrics** panel using draft settings and Apply / Cancel rather than immediately changing each selector on the page.

### Case configuration

Each shortlisted case can be opened in a dedicated configuration panel.

The panel provides:

- case inclusion / exclusion;
- one selected operation;
- operation-specific labelled parameters;
- Apply / Cancel draft behaviour;
- Reset to included No Change state; and
- contextual case information including name, ID, plan type, region and country.

Switching operations clears the previous draft inputs. Excluding a case preserves its previously applied operation configuration so that it can be restored if the case is later re-included.

### Operations guide

The **Operations guide** opens a help panel containing operation categories, descriptions, required and optional inputs and examples. The dedicated operations PDF can also be opened separately.

Frontend guide data is maintained in `frontend/src/components/operationGuideData.js`. Percentage examples follow the shared engine's fractional convention, so `0.10` represents 10% where the operation expects a fraction.

### Operation-input validation

The editor performs frontend validation and also calls:

```text
POST /api/scenario/validate
```

before allowing a configured case to be applied.

Implemented checks include:

- finite numeric values;
- calendar years as whole numbers within 2026–2040;
- required parameters;
- operation-specific fraction limits;
- amount/year pairs;
- explicit year ordering where required;
- unused non-reference parameter positions; and
- profile-aware warnings for timing clipping, truncation and selected absolute-adjustment effects.

Warnings can be non-blocking. The backend repeats validation when a scenario runs, and the shared calculation engine remains responsible for calculation-specific failures.

The implementation does not silently normalise invalid inputs into different business assumptions.

### Run confirmation

**Save and run** opens a confirmation dialog before scenario execution.

The dialog shows the scenario name, counts of reference / modified / excluded cases and a case-level summary of modified or excluded decisions. Modified cases show the operation and saved inputs. Excluded cases are shown as exclusions rather than presenting retained inactive operation settings as applied changes.

Only explicit confirmation submits the run.

Clear scenario uses the same app-styled confirmation pattern. It resets the working definition and results while retaining saved scenarios.

## Saved scenario persistence

The React application supports persistent, reloadable and editable **scenario definitions**.

A saved scenario is a persisted configuration, not a stored results snapshot. It includes the scenario metadata, shortlist and per-case operation configuration required to reopen the definition in Build a Scenario.

### User workflow

- **Save** creates a new saved definition or updates the currently opened one.
- Editing the Scenario Name and choosing Save renames the same persisted record.
- **Saved scenarios** opens the shared right-hand panel from Home or Build a Scenario.
- **New scenario** starts a separate working definition.
- The trash icon opens an app-styled deletion confirmation. Deletion preserves the current working copy; if it referred to the deleted record, its next Save creates a new record.
- Saved scenarios reopen through `/build?scenario=<uuid>`.
- Unsaved changes are protected when replacing a working scenario or closing/reloading the browser.
- Reopening a scenario clears prior calculation results; the user runs it again against the currently loaded reference data.

Save does not itself execute the scenario. **Save and run** saves first and only continues to calculation if the save succeeds.

### Storage model

The local prototype stores one JSON file per scenario under:

```text
08_react_app/app_data/scenarios/
```

The folder is created on first save and ignored by Git. Set `SCENARIO_STORAGE_DIR` before starting FastAPI to use an alternative location.

Each saved record contains a schema version, UUID, created/updated timestamps and the editable scenario definition.

The repository implementation:

- uses server-generated UUID filenames;
- writes through a temporary file in the same directory;
- flushes the file before atomically replacing the destination;
- rejects corrupt or unsupported records rather than silently resetting them;
- uses expected timestamps to detect stale updates; and
- serialises writes with a process lock.

This is intentionally a **local, single-process prototype persistence mechanism**. It is not shared multi-user storage, historical versioning or a substitute for backup. Result snapshots and reference-data snapshots are not persisted.

### Saved-scenario API

- `GET /api/scenarios` — lightweight summaries plus file-read errors.
- `GET /api/scenarios/{uuid}` — full saved definition plus current validation issues.
- `POST /api/scenarios` — create a saved definition.
- `PUT /api/scenarios/{uuid}` — update a saved definition using an expected modified timestamp.
- `DELETE /api/scenarios/{uuid}` — delete a saved definition.

Persistence identity is separate from the numeric scenario/run identifiers used inside the modelling engine.

## Scenario Results comparison workspace

Scenario Results has been redesigned as a comparative analytical workspace rather than a simple output page.

### Headline KPIs

Four cards align with the Portfolio Viewer metric set:

- cumulative Production — mmboe;
- cumulative Cash Capex — $bn;
- cumulative Post-Tax RCOP — $bn; and
- cumulative Post-Tax Free Cash Flow — $bn.

Each card shows the Primary scenario value, Reference value, absolute variance and percentage variance where Reference is non-zero.

Variance styling is deliberately neutral: a numerically positive variance is not automatically treated as favourable because metric semantics differ.

### Results settings

**Results settings** opens a right-hand dialog using draft selections and one Apply action.

The user can select:

- Primary scenario;
- optional Comparison scenario;
- analysis year range;
- Plot 1 metric and variance breakdown;
- Plot 2 metric and variance breakdown;
- changes-table impact metric; and
- changes-table impact period.

The latest editor run remains separately available as the current result. Saved scenario definitions selected in Results are executed through the normal scenario-run endpoint for comparison; selecting them does not save, mutate or replace the working Build-a-Scenario definition.

If a Comparison scenario fails, Reference + Primary remain available. Primary-analysis failures preserve the previous successful analysis rather than blanking the page.

### Two analytical plots

Results contains two side-by-side configurable plot panels.

Each panel can independently switch between:

- **Profile** — annual Reference, Primary and optional Comparison lines; and
- **Variance** — a true floating Reference → contributors → Primary waterfall.

Variance breakdown supports:

- Case;
- Region;
- Country;
- Group Entity; and
- Plan Type.

The breakdown vocabulary is aligned with Portfolio Viewer. Waterfalls retain all contributors so that the bridge reconciles to the endpoint; long breakdowns can therefore require horizontal scrolling.

### Changes driving this scenario

The changes table shows modified and excluded cases using business-facing operation labels and parameter descriptions rather than raw `Param1`–`Param5` columns.

Unchanged No Change cases are omitted.

The user can configure the impact metric and period through Results settings. The displayed impact is a per-case contribution to portfolio variance versus Reference; it should not be interpreted as formal causal attribution.

NPV impact uses the shared discounted-cash-flow valuation service rather than summing annual NPV rows.

### Results-analysis API

`POST /api/scenario/analysis` provides four analysis kinds:

- `kpis`;
- `profile`;
- `waterfall`; and
- `impact`.

The service validates periods and breakdowns and applies presentation-sign metadata to copies of data rather than changing underlying analytical values.

Results filtering operates on already calculated outputs and does not alter saved definitions or scenario inclusion decisions.

## Analytical calculations

### Post-tax calculations

The backend calculates baseline post-tax metrics at startup and recalculates derived metrics after scenario operations using the shared `engine/financials.py` implementation.

Derived outputs include:

- Tax Charge;
- Cash Tax Payment;
- Post-Tax RCOP; and
- Post-Tax Cash Flow.

Derived rows are replaced rather than repeatedly taxed, so the coordinator is designed to be repeat-safe.

Tax calculations use non-negative RCOP with ETR for charges and CTR for cash payments. Representative rates are demonstration assumptions rather than production fiscal assumptions.

### NPV

`services/valuation_service.py` calculates NPV from Post-Tax Cash Flow using a fixed 2026 discount origin, with 2026 treated as period 1. The default discount rate is 8%.

Year filtering does not reset the discount origin.

The same valuation logic is reused across portfolio analysis, case-level ranking and scenario impact analysis. NPV is a calculated measure, not an annual profile row to be summed again.

### Signs, units and presentation

Underlying analytical cash-flow signs remain unchanged. Presentation inversions are metadata-driven using `006_metrics_helper.csv`.

Examples:

- annual production — mboed;
- cumulative production — mmboe using the existing `0.36525` conversion factor; and
- financial headline values — converted from $m to $bn for display only.

## Backend structure

| Path | Responsibility |
| --- | --- |
| `backend/main.py` | FastAPI application, startup loading, CORS and health endpoint. |
| `backend/state.py` | Locates and loads the sibling representative data directory. |
| `backend/schemas.py` | Core API request/response models. |
| `backend/operation_validation.py` | Operation-specific configuration validation. |
| `backend/routers/data.py` | Reference-data endpoints. |
| `backend/routers/portfolio.py` | Portfolio KPIs, charts, rankings, creaming analysis and entity summaries. |
| `backend/routers/scenario.py` | Scenario validation and execution endpoints. |
| `backend/routers/optimisation.py` | Typed optimisation requests, responses and bounded solve coordination. |
| `backend/routers/results_analysis.py` | Results KPI, profile, waterfall and impact analysis. |
| `backend/routers/saved_scenarios.py` | Saved-scenario CRUD API. |
| `backend/saved_scenario_models.py` | Persisted scenario schemas. |
| `backend/scenario_repository.py` | Atomic local JSON repository implementation. |
| `backend/utils/display.py` | Display-facing sign/value transformations. |

The backend retains loaded reference data in memory. Scenario definitions are persisted separately by the saved-scenario repository; scenario result snapshots are not persisted.

## Frontend structure

| Path | Responsibility |
| --- | --- |
| `frontend/src/App.jsx` | Router and shared application contexts. |
| `frontend/src/pages/Home.jsx` | Home navigation and Saved scenarios entry point. |
| `frontend/src/pages/PortfolioViewer.jsx` | Reference portfolio analysis and shortlisting. |
| `frontend/src/pages/BuildScenario.jsx` | Scenario metadata, shortlist tables, persistence controls and run workflow. |
| `frontend/src/pages/PortfolioOptimiser.jsx` | Staged objective, constraints, recommendation and scenario hand-off. |
| `frontend/src/pages/ScenarioResults.jsx` | Primary/comparison results workspace and analysis coordination. |
| `frontend/src/components/CaseConfiguration.jsx` | Draft case-operation editor. |
| `frontend/src/components/OperationsGuide.jsx` | Operations help dialog. |
| `frontend/src/components/ReferenceConfig.jsx` | Build-page reference metric configuration. |
| `frontend/src/components/SavedScenarios.jsx` | Saved-scenario browser and delete/new/open controls. |
| `frontend/src/components/ResultsSettings.jsx` | Results settings draft/apply dialog. |
| `frontend/src/components/ResultsAnalysis.jsx` | Results KPI, chart, waterfall and changes components. |
| `frontend/src/hooks/` | Working scenario state, persistence helpers and scenario execution hooks. |
| `frontend/src/api/client.js` | Frontend API client. |
| `frontend/vite.config.js` | Vite development configuration and local API proxy. |

## Data and sanitisation

The backend reads representative data from:

```text
../07_streamlit_app/data/sample
```

The sample directory contains case listing, profiles, tax rates, totals/averages, operation metadata and metric-helper data.

These inputs are sanitised demonstration datasets. The React application does not connect directly to the production Power BI semantic model or enterprise data sources.

## Testing and verification

### Shared package and backend tests

From the repository root:

```bash
python -m pip install -e "./07_streamlit_app[dev]"
python -m pip install -r 08_react_app/backend/requirements-dev.txt
python -m pytest 07_streamlit_app/tests 08_react_app/backend/tests -q
```

### Frontend build

From `08_react_app/frontend`:

```bash
npm run build
```

### Frontend Node tests

Frontend `.test.js` files cover selected pure helpers and component-support logic. Run the relevant files with Node's built-in test runner, for example:

```bash
node --test src/components/caseConfiguration.test.js \
  src/components/operationGuideContent.test.js \
  src/components/runConfirmation.test.js \
  src/hooks/scenarioDefinition.test.js \
  src/hooks/scenarioInstructions.test.js \
  src/pages/referenceMeasures.test.js \
  src/pages/resultsHelpers.test.js \
  src/pages/optimiserHelpers.test.js \
  src/pages/resultsRequests.test.js \
  src/pages/scenarioCaseFilters.test.js \
  src/pages/scenarioCaseSort.test.js \
  src/pages/caseSummarySort.test.js
```

Automated coverage includes significant areas of operation validation, post-tax processing, valuation, saved-scenario CRUD, stale-update handling, scenario rehydration, filtering/sorting, waterfall reconciliation and Results request logic.

Passing automated tests does **not** establish full browser acceptance, complete workbook parity or business validation. Manual checks remain important for dialog focus/dismissal, responsive layouts, long waterfall readability, saved-scenario workflows, comparison error handling and end-to-end interaction behaviour.

The original DT603 business-validation evidence is documented separately in [`../03_testing_and_validation`](../03_testing_and_validation/README.md).

## Deployment status and constraints

The checked-in application is currently configured for **local development**. No cloud deployment target is committed in this repository.

A production deployment must address several concerns explicitly:

- hosting and routing the FastAPI API;
- routing frontend `/api` requests to that API;
- SPA fallback routing for browser routes such as `/portfolio`, `/build` and `/results`;
- packaging access to the sibling shared Python package and representative data; and
- replacing or deliberately hosting the local JSON scenario store on durable storage if persisted scenarios are expected to survive instance replacement.

The Vite development proxy is a local-development convenience and does not configure production routing.

The current JSON repository is designed for a single backend process on a durable local filesystem. It should not be treated as a multi-instance cloud persistence solution without an explicit storage redesign.

## Design and implementation documents

The following documents record analysis, design decisions and implementation briefs used during the post-DT603 software work.

| Document | Role / current status |
| --- | --- |
| [`Excel-Python-to-Web-Application-Gap-Review.md`](Excel-Python-to-Web-Application-Gap-Review.md) | Gap analysis between the original Excel/Python application and later web implementations. Reference document. |
| [`Operation-Parameter-Validation-Matrix.md`](Operation-Parameter-Validation-Matrix.md) | Operation-input rules and validation decisions. Reference document. |
| [`Claude-Code-Scenario-Persistence-Implementation-Prompt.md`](Claude-Code-Scenario-Persistence-Implementation-Prompt.md) | Persistence implementation brief. The core saved-scenario capability is now implemented using JSON storage. |
| [`Scenario-Results-Redesign-Implementation-Brief.md`](Scenario-Results-Redesign-Implementation-Brief.md) | Results-workspace redesign brief. Substantial parts are now implemented in the current Results page. |
| [`Portfolio-Optimiser-Implementation-Brief.md`](Portfolio-Optimiser-Implementation-Brief.md) | Original optimiser design with the current unified workflow noted at the top. |
| [`Portfolio-Optimiser-Remediation-Plan.md`](Portfolio-Optimiser-Remediation-Plan.md) | Current simplified implementation decisions and verification, followed by the historical review. |

These documents may contain historical design assumptions that have since been superseded by the current code. Always inspect the implementation before treating a brief as current behaviour.

## Portfolio Optimiser

`/optimise` is a separate analytical workspace, reachable from the top navigation and its own Home card. The page follows **Objective → Constraints → Run**, with optional **Advanced controls** in a side pane. Mix targets start off; case controls are hidden until Show case selection is checked, then expand from Region to Country to Case. Hiding that section retains active selections. Closing the pane retains active settings, shown in a summary on the main page. Clear advanced controls resets timing, mix and case selections, preserving objective, period and constraints. All loaded reference cases are eligible concurrently; the manual shortlist and shared display filters do not restrict optimiser scope.

Optional **Timing** controls let users set maximum delay and acceleration (0–14 whole years, initially 2 each when enabled). Timing starts off. The solver compares the unchanged profile with each permitted shift and selects at most one alternative per case. Mandatory and excluded rules apply across all alternatives. Only `Param1` is set: penalty, incremental Capex and acquisition cost parameters stay zero. Source profiles pass through the existing Delay/Accelerate operations and financial engine; destination-year tax rates and fixed-2026 discounting apply. Shifts that would move any nonzero source value outside 2026–2040, or leave no rows, are omitted. Zero padding may fall outside the horizon. The result reports the number of omitted options. The selected objective and constraint periods still determine which in-horizon values contribute; this does not imply whole-life economics outside those periods.

Timing alternatives are prepared in batches by shift and count towards the same 30-second optimisation budget. The API accepts `max_delay_years` and `max_acceleration_years` (default 0); result cases include `operation` and signed `year_shift` (negative for acceleration). The original unshifted portfolio remains the reference for comparison. The entire selected mix of operations is independently replayed before publishing. Tied optima may have different timing selections; no secondary preference or timing penalty is imposed.

The recommendation table can show **constraint-period values**. Each total constraint adds one column for its own period; annual constraints add one column per year, with production in mboed rather than cumulative mmboe. `constraint_contributions` identifies each case's contribution by constraint ID and period. Recommended cases use their selected timing, unselected cases show unchanged reference contributions, and out-of-scope cases contribute zero. Summing the recommended cases reconciles to each portfolio constraint check. The existing objective-period columns remain visible.

Install the backend requirements (`python -m pip install -r backend/requirements.txt` from `08_react_app`) for PuLP 3.3.0 and highspy 1.15.1. The shared package also exposes an `optimisation` optional dependency group. The solver path was exercised with Python 3.14.2. PuLP models the binary case decisions; HiGHS solves them. No solver runs in React.

`POST /api/optimisation/solve` accepts an independently bounded 2026–2040 objective period, constraints, mandatory IDs and excluded IDs. Supported objectives are `post_tax_npv` (8%, fixed 2026 period-1 basis), `post_tax_fcf` (undiscounted post-tax cash flow), `underlying_rcop` (undiscounted before-tax Underlying RCOP), and `production` (cumulative mmboe). NPV is the default. Each constraint has a unique ID, `capex` or `production` metric, `total` or `each_year` basis, years, `min` or `max` operator, nonnegative target, and `flexibility_pct` (0 by default; at most 15). Unsupported fields/objectives, conflicting controls, invalid numbers and unknown cases are rejected. Requests use server-owned reference data.

Optional mix targets start from reference production shares for the selected objective period. Sliders move in 1% increments and redistribute the other shares to keep 100%. Each enabled dimension has an editable tolerance, initially ±5 percentage points, because binary whole-case selection may not match exact targets. The backend enforces actual shares of selected production, checks the achieved percentages independently, and reconciles production through scenario replay. Mix constraints require positive selected production; zero reference production is rejected. Capex is not offered as a mix basis.

Case controls inherit in Region → Country → Case order. A country can exclude itself from an included region, and a case can override its country. Each child offers Inherit, Optimiser chooses, Include and Exclude; “Optimiser chooses” explicitly clears an inherited restriction. Changing a parent preserves child overrides. Country rules are scoped by region, and the server resolves all rules using authoritative case metadata. Effective counts are shown alongside each group. The final resolved rules remain strict during solver flexibility attempts.

The unified UI uses the existing `mode: "mix"` API contract, with optional `mix_constraints` (`dimension`, `value`, `target_share_pct`, `tolerance_pct_points`), `region_rules` (`region`, `rule`), `country_rules` (`region`, `country`, `rule`) and `case_rules` (`case_id`, `rule`). Rules are `mandatory`, `excluded` or `optional`; absence means inherit. Empty arrays leave the optimiser free to choose. The legacy `mode: "full"` API contract remains supported and continues to reject advanced controls. API compatibility does not create user-facing modes.

When a region is effectively entirely excluded, its regional target redistributes to the remaining regions. Reopening it through a country/case override restores its reference target. Oil/Gas targets stay unchanged. Changing years resets mix targets to the new reference period. `mix_checks` reports achieved shares and bands. Objective labels, units, `reference_objective_value` and per-case `objective_contribution` follow the chosen objective; legacy NPV fields always contain discounted NPV.

Cash Capex resource coefficients are the negative of raw analytical Cash Capex sums, in $m, never absolute values or display-mutated financial data. Positive analytical Capex entries reduce net expenditure and may offset other spending, including in individual years. Signed values are neither rejected nor clipped; this matches existing Cash Capex reports. Production totals use the existing 0.36525 conversion to mmboe; annual minimum/maximum constraints use mboed. Absent case/metric/year combinations contribute zero, including metrics with no rows at all for a case. The mix pane treats null reference-production totals as zero. Financial processing derives metrics only where their source rows exist; it does not invent cash-flow rows. This also allows a production-only or Capex-only selection to replay through the scenario engine. Existing non-finite values, duplicate rows, missing required tax mappings/rates and cases with no profile rows at all remain errors. Case coefficients are prepared once and reused across solver attempts.

Strict limits and case controls never relax. After proven infeasibility, flexible limits widen by 1% increments relative to the original target, up to their individual permitted caps. The first feasible level is optimised for the selected objective; original targets, adjusted limits, actual breaches and attempt statuses remain visible. Percentages are not compounded. Zero targets must stay strict. This uniform-step policy does not claim to identify the smallest sum of deviations across constraints.

HiGHS model status is checked directly to avoid treating a time-limited incumbent as optimal. Solver attempts share a 30-second wall-time budget; requests are serialised per backend process, with overlapping solves receiving 409. All nonoptimal outcomes withhold the recommendation. Nonempty selections are checked against constraints and replayed through the ordinary scenario engine; per-case objective contributions, NPV, constraint coefficients and headline values must reconcile before hand-off. Empty optima remain visible but cannot be opened as scenarios because the scenario engine requires an included case.

Build scenario from recommendation leaves saved records intact, replaces the working copy only on explicit action (confirming unsaved edits), and makes the next Save create a new record. Excluded cases become shortlisted `include=false` entries. Shifted included cases also become shortlisted with Delay/Accelerate and the selected whole-year shift; all other operation parameters are zero. Unchanged included cases stay available at reference profiles. Request/constraint metadata is retained in the ordinary scenario rationale. Recommendation data stays in memory on the Optimiser page. Changing inputs invalidates the previous recommendation. Use existing Build and Results for editing, saving and detailed charts.

Weighted objectives, operations other than pure timing, dependencies/exclusivity between different cases, risk scores, filtered candidate universes and solver result persistence are deferred. Automated tests cover brute-force optimality, mandatory/excluded cases, strict and flexible constraints, first feasible steps and caps, annual versus cumulative production, financial signs/immutability, timeout handling, replay failure, API validation and scenario hand-off. Current browser checks confirmed the single workflow, mix targets off by default, a successful default solve, an enabled oil/gas mix solve, and included region → excluded country → re-included case being honoured after the pane closes. Reopening preserves settings; Escape and Done restore focus; clearing resets optional controls. Desktop and 390px mobile pane layouts were inspected with no internal overflow or browser runtime errors. The earlier browser pass exercised recommendation → Save and run → Scenario Results and removed its temporary test scenario. Broader user acceptance and business validation remain outstanding.

Optimiser recommendations use one table: recommended cases stay first with Portfolio Viewer green highlighting; unselected cases use readable grey styling. Column sorting applies within each group. Build scenario from recommendation opens the editable working copy. Calculation-convention diagnostics remain in the API response but are omitted from the page.

Build scenario from recommendation first opens a confirmation in the Save and run dialog style. It explains that unchanged included cases remain under Available cases while timing changes and exclusions move into Shortlisted cases, with optional case lists and an unsaved-edits warning. Cancel preserves the working copy; Open scenario builder performs the hand-off without saving or running.

## Known boundaries

Current important boundaries include:

- no live Power BI or enterprise connection;
- local single-process JSON scenario persistence only;
- no persisted result snapshots or historical scenario revisions;
- no implemented price operation in the shared web engine;
- optimiser supports include/exclude reference-case selection only; weighted objectives and operation/timing optimisation are deferred;
- no claim of complete parity with every behaviour in the original Excel implementation; and
- no claim that automated software tests replace business validation.

## Relationship to the original DT603 project

The React/FastAPI application is best understood as **post-submission architectural and product evolution** of the original framework.

The original DT603 work established the business problem, governed data structures, scenario methodology, controlled operations, Excel/Python implementation, architecture and validation evidence. The React development explores what that validated concept can become when separated into frontend state, API services, persistent scenario definitions and richer comparative analytics.

That distinction is deliberate: later software work extends the learning and architecture without retrospectively changing what was originally delivered and assessed.

[Return to repository overview](../README.md)

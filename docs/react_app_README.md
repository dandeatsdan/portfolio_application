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
| [`Portfolio-Optimiser-Next-Steps-Plan.md`](Portfolio-Optimiser-Next-Steps-Plan.md) | Implemented advanced constraints, reference locks, timing switches and direct recommendation actions; subsequent scope decisions and deferred work. |

These documents may contain historical design assumptions that have since been superseded by the current code. Always inspect the implementation before treating a brief as current behaviour.

## Portfolio Optimiser

`/optimise` provides **Objective → Constraints → Run optimisation → Recommendation**. Objectives are Post-tax NPV (8%, fixed 2026 valuation), undiscounted post-tax FCF, before-tax Underlying RCOP and cumulative Production. All loaded cases are candidates; manual shortlist and display filters do not narrow optimiser scope. Absent metric/year rows contribute zero, while cases without any profiles are invalid.

**Advanced controls** uses switches for independent Delay and Accelerate permissions, ordered constraint priorities, portfolio mix and visibility of case selections. Timing defaults off; each enabled direction has an editable 1–14 year limit, initially 2. The solver compares each permitted pure shift with No Change and selects at most one alternative per case. Destination-year tax and fixed-origin valuation use the shared engine. Timing clips source rows shifted outside 2026–2040, matching normal Delay/Accelerate. Alternatives that leave no profile rows are unavailable. Cost/penalty parameters remain zero. Other operations are deferred.

Region, country, plan type and case controls offer **Keep as per reference**, **Allow to be modelled**, and **Exclude**. Reference cases must remain included and unchanged. Modelled cases may be included, shifted or omitted. Excluded cases remain in the case universe and become shortlisted Include=false entries during hand-off. Country overrides region; an explicit case choice overrides geography and plan type. Otherwise, conflicting geography/plan-type restrictions block the solve. Unset children inherit. Missing plan types appear as Unspecified. Existing API `mandatory` rules retain inclusion-only semantics; new `reference` rules enforce unchanged profiles.

Constraints support Cash Capex, Production and Free Cash Flow, minimum/maximum rules, independent date windows, total/each-year bases and optional case scopes in the API. FCF is undiscounted Post-Tax Cash Flow in $m and allows negative targets. Production uses mmboe for totals and mboed for annual limits; Capex uses signed net expenditure. **Relative to reference** targets accept signed percentage adjustments (negative means lower), with a server-computed reference and numerical limit shown before solving. Each-year constraints use each year's own baseline. Baselines always use original unshifted profiles and the constraint's scope and dates. Nonpositive baselines require absolute targets. Reference fingerprints detect stale previews and hand-offs.

Strict constraints never relax. Without priorities, flexible limits widen together in 1% steps, capped at each rule's 0–15% allowance. With **Use ordered priorities**, the solver first attempts the original limits; after proven infeasibility, it minimises normalised breaches at priority 1, then 2, then 3, before maximising the objective. Positive weights apply within a priority; annual rules average their normalised violations. Negative FCF allowances use absolute target magnitude; zero targets stay strict. Per-constraint checks report reference, requested/adjusted targets, actual values, priority, weight and breaches. The compatibility `relaxation_pct` field reports the search allowance, not a common actual breach in priority mode. Priority objectives are fixed with a 1e-9 normalised tolerance and independently checked to 1e-7.

Optional Oil/Gas and regional production-share targets start off. Enabled sliders start from the objective-period reference mix and total 100%, with editable tolerance initially ±5 percentage points. Mix requires positive selected production; mix bands and case rules remain strict. Closing the pane retains settings. Clear advanced controls turns off timing, priorities and mix targets and clears all case/plan-type rules while preserving objectives and constraints.

A reconciled, nonempty recommendation offers **Run recommended scenario** (save as a new scenario, run, open Results) and **Modify recommended scenario** (open an unsaved builder copy). Existing saved scenarios are never overwritten. Replacing unsaved working edits requires confirmation. A failed save never runs; a failed run retains its new saved definition for retry without duplicate saves. Late responses cannot overwrite newer working state. Both actions use the same ordinary scenario instructions. Shifted cases and exclusions appear in the shortlist; unchanged selected cases remain available. The recommendation is invalidated when optimisation inputs change.

The case table keeps selected cases first. Optional constraint-period columns show selected timing contributions for each configured total or annual limit; unselected cases show their unchanged contributions and out-of-scope cases contribute zero. Their selected sums reconcile with portfolio checks. Objective-period metric columns remain visible. Desktop constraint fields use one compact row; smaller screens wrap. Recommendation actions align right under step 4.

Install `backend/requirements.txt` for PuLP 3.3.0 and highspy 1.15.1. The shared package also exposes the `optimisation` optional dependency group. All solver work stays server-side. Preparation, solve passes and replay share a 30-second budget; overlapping requests receive 409. HiGHS status is inspected directly, and inconclusive/nonoptimal outcomes withhold recommendations. Every nonempty optimum is independently checked and replayed through the normal scenario engine. Empty optima cannot become scenarios.

Current verification: 267 Python/API tests, 102 frontend tests and the production build passed (existing bundle-size warning). Browser checks covered relative targets, plan-type controls, timing switches, FCF constraints, both recommendation paths and unsaved-edit cancellation, plus desktop and 390px layouts. Broader business acceptance remains outstanding. Other operations, per-case timing costs, inter-case dependencies, chat-assisted rule entry, Excel exports and additional metadata are deferred; see the [implementation plan](Portfolio-Optimiser-Next-Steps-Plan.md).

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

# Portfolio Optimiser — Claude Code / Codex Implementation Brief

## Current scope — 16 September 2026

The optimiser has two modes: **Standard** (objective, constraints and targets) and **Advanced** (objective, constraints, production mix, then hierarchical Region → Country → Case controls). Both offer Post-tax NPV, undiscounted post-tax Free Cash Flow, before-tax Underlying RCOP and cumulative Production. More-specific controls override their parents, and explicit “Optimiser chooses” clears an inherited restriction. Standard submits no portfolio controls. The [remediation plan's current implementation section](Portfolio-Optimiser-Remediation-Plan.md#current-implementation--simplified-scope-16-september-2026) records the governing decisions and checks. The original agreement and subsequent examples below are historical design material, superseded by this current scope.

## Agreed first implementation

The following records the first implementation agreement; the current scope above takes precedence:

- Include/exclude reference cases only; all loaded cases are concurrent candidates. No mutually exclusive groups, delay/acceleration choices, or ownership optimisation in this version.
- Maximise post-tax NPV using the existing 8% fixed-2026 basis. Objective period is independently selectable. Optional weighted objectives remain a follow-on feature.
- Multiple Cash Capex and production constraints, each with its own period, minimum/maximum rule, and total-across-period or every-year basis.
- Strict by default. Each positive target may explicitly allow up to 15% flexibility in whole-percent steps. Zero targets remain strict.
- Try the original model, then widen only flexible limits by 1% of their original targets per attempt; each constraint stops widening at its own cap. Stop at the first feasible step and maximise NPV there. Never relax because a solve times out or merely because the unconstrained NPV would be higher.
- Use PuLP 3.3.0 with HiGHS through highspy 1.15.1. A shared 30-second solver-attempt budget bounds a request. Incomplete solves publish no recommendation and never claim optimality.
- Four lightweight numbered sections on a dedicated Optimiser page: objective, constraints, run, recommendation. Match the current app styling; no additional workflow title bar. Case controls use the existing right-hand dialog pattern, with staged Apply/Cancel.
- Display original targets, adjusted limits, actual values and breaches. Preserve mandatory/excluded cases as strict rules. Show included and excluded cases in a searchable, sortable recommendation table.
- Verify nonempty recommendations through the scenario engine before hand-off. Review as scenario creates an unsaved working definition, with excluded cases shortlisted and marked excluded; existing saved records are untouched.
- An empty optimal portfolio is reported explicitly; it cannot be handed to the current scenario engine, which requires at least one included case.

## Purpose

This document is an implementation brief for adding a **separate Portfolio Optimiser screen** to the React/FastAPI application in `08_react_app`.

It is intended to be usable directly by Claude Code or Codex. Read the current repository before making changes and treat this document as design intent rather than a substitute for inspecting the active code.

The optimiser must be implemented as a distinct analytical capability, not embedded inside Scenario Results or hidden inside Build a Scenario.

The core user proposition is:

> Given an objective and a set of portfolio constraints, identify the mathematically preferred combination of modelling cases, then allow the user to review, challenge, modify and save that recommendation as an ordinary scenario.

The optimiser is a **decision-support capability**. It does not replace expert judgement and must not silently overwrite the user's current scenario.

---

# 1. Read these files first

Before implementing anything, inspect at minimum:

- `CLAUDE.md`
- `08_react_app/README.md`
- `08_react_app/frontend/src/App.jsx`
- `08_react_app/frontend/src/components/AppShell.jsx`
- `08_react_app/frontend/src/pages/Home.jsx`
- `08_react_app/frontend/src/pages/PortfolioViewer.jsx`
- `08_react_app/frontend/src/pages/BuildScenario.jsx`
- `08_react_app/frontend/src/pages/ScenarioResults.jsx`
- `08_react_app/frontend/src/hooks/useScenario.js`
- `08_react_app/frontend/src/hooks/scenarioInstructions.js`
- `08_react_app/frontend/src/api/client.js`
- `08_react_app/backend/main.py`
- `08_react_app/backend/schemas.py`
- `08_react_app/backend/routers/portfolio.py`
- `08_react_app/backend/routers/scenario.py`
- `07_streamlit_app/src/scenario_modeller/services/valuation_service.py`
- `07_streamlit_app/src/scenario_modeller/services/comparison_service.py`
- existing frontend/backend tests
- `08_react_app/Claude-Code-Scenario-Persistence-Implementation-Prompt.md`
- `08_react_app/Scenario-Results-Redesign-Implementation-Brief.md`

If any of these files have changed since this brief was written, adapt to the latest implementation rather than forcing stale assumptions into the code.

---

# 2. Product architecture decision

## The optimiser is a separate screen

Add a dedicated route and page:

```text
/optimise
```

with a component conceptually equivalent to:

```text
frontend/src/pages/PortfolioOptimiser.jsx
```

Do **not** implement the optimiser as:

- a subsection of Scenario Results;
- a modal launched from Scenario Results only;
- a hidden option in Build a Scenario;
- a background calculation that automatically changes the current scenario;
- a replacement for Portfolio Viewer.

It is a distinct analytical workspace.

The application should conceptually become:

```text
Home
│
├── Portfolio Viewer
│
├── Build a Scenario
│
├── Scenario Results
│
└── Portfolio Optimiser
```

However, **Portfolio Optimiser is not “Step 4” of the manual scenario journey**.

The core manual flow remains:

```text
Portfolio Viewer
      ↓
Build a Scenario
      ↓
Scenario Results
```

The optimiser is an alternative analytical workflow:

```text
Reference Portfolio
      ↓
Portfolio Optimiser
      ↓
Recommended Portfolio
      ↓
Review / modify as scenario
      ↓
Scenario Results / Save Scenario
```

This distinction must be reflected in the Home-page design.

---

# 3. Home-page changes

The current Home page has three destination cards driven by a shared `CARDS` collection and also uses those same cards to render a three-step journey strip.

Do not simply append the optimiser to that same array and label it Step 4.

That would incorrectly imply that optimisation is the next mandatory stage after Scenario Results.

## Required Home-page information architecture

Keep the existing three-step manual scenario journey visually coherent:

```text
1 Portfolio Viewer  →  2 Build a Scenario  →  3 Scenario Results
```

Then add a **separate destination card / box** for:

```text
Portfolio Optimiser
```

Suggested title:

> **Portfolio Optimiser**

Suggested description:

> Define an objective and portfolio constraints, then identify and review a recommended portfolio configuration.

Suggested icon:

- a suitable Lucide icon such as `Target`, `SlidersHorizontal`, `Gauge`, `BrainCircuit`, or another restrained analytical symbol;
- do not introduce a new icon library.

## Recommended layout

A good V1 layout is:

```text
Explore, build and review portfolio scenarios

┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Portfolio      │ │ Build a        │ │ Scenario       │
│ Viewer         │ │ Scenario       │ │ Results        │
└────────────────┘ └────────────────┘ └────────────────┘

       1 ─────────── 2 ─────────── 3

Advanced analysis
┌────────────────────────────────────────────────────┐
│ Portfolio Optimiser                                │
│ Define objectives and constraints to identify a    │
│ recommended portfolio configuration.               │
└────────────────────────────────────────────────────┘
```

This preserves the existing journey while clearly surfacing optimisation as a separate analytical capability.

An alternative responsive implementation may use a 2×2 card grid, but if that is chosen the optimiser must still **not** be numbered as Step 4 and the three-step journey strip must remain semantically separate.

## Home hero copy

The Home-page hero may need a small wording change because the current copy refers only to reviewing, building and returning to saved results.

Update it so the optimiser is discoverable without making the page verbose.

For example:

> Explore, build, compare and optimise portfolio scenarios.

or similar wording consistent with the existing tone.

Do not turn the Home page into a technical explanation of MILP.

---

# 4. Top navigation

Add a top-navigation item for the new screen in `AppShell.jsx`:

```text
Portfolio Optimiser
```

route:

```text
/optimise
```

The screen should be directly reachable from the application shell and not only from the Home page.

Do not hide it behind another screen.

---

# 5. Optimiser screen — business purpose

The optimiser screen should answer a different question from Build a Scenario.

## Build a Scenario

asks:

> What happens if I make these decisions?

## Portfolio Optimiser

asks:

> Which combination of decisions best satisfies this objective and these constraints?

The optimiser is therefore **prescriptive analytics**, while the existing scenario engine is primarily deterministic scenario evaluation.

The initial implementation should remain deliberately bounded and interpretable.

Do not start with an unconstrained black-box optimiser.

---

# 6. V1 optimisation scope

Implement an initial **binary portfolio-selection MILP**.

For each modelling case `i`, define a binary decision variable:

```text
x_i ∈ {0, 1}
```

where:

```text
x_i = 1 → case included in the recommended portfolio
x_i = 0 → case excluded
```

The first objective should be:

```text
Maximise Post-tax NPV
```

using the application's existing post-tax valuation logic.

Do not duplicate NPV calculations inside the optimiser.

Reuse the existing valuation service and its current declared basis.

The current React application uses post-tax cash flow and fixed-origin discounting with a default 8% rate. Preserve that analytical basis unless a future explicit change is requested.

---

# 7. V1 constraints

Support a focused set of constraints that are directly interpretable by users.

At minimum design for:

### Capital constraint

Examples:

```text
Maximum cumulative Cash Capex 2026–2030
Maximum cumulative Cash Capex 2026–2040
```

Potential later extension:

```text
Maximum Cash Capex in individual years
```

### Production constraint

Examples:

```text
Minimum production in 2030
Minimum cumulative production over a selected period
```

### Mandatory cases

Cases that must be selected:

```text
x_i = 1
```

### Excluded cases

Cases that cannot be selected:

```text
x_i = 0
```

### Optional simple portfolio constraints

Only if low complexity and well tested:

- maximum number of selected cases;
- minimum/maximum regional exposure;
- minimum/maximum Group Entity exposure;
- minimum post-tax cash flow over a specified period.

Do not overload V1 with every conceivable constraint.

---

# 8. Critical sign and unit handling

The analytical data uses source financial signs. Cash outflows may be stored as negative values.

A capital budget uses **signed net expenditure**, calculated as the negative of analytical Cash Capex. Negative analytical outflows consume budget; positive analytical credits reduce net expenditure. Never apply absolute values or clip credits.

For example, if analytical Cash Capex is:

```text
-500
```

then optimisation resource consumption should normally be:

```text
500
```

for purposes of:

```text
Total Capex <= Budget
```

Do not accidentally construct an inequality where more negative expenditure appears to satisfy a tighter budget.

Keep analytical values and optimisation coefficients conceptually separate when sign conversion is required.

Similarly:

- production is a positive quantity;
- NPV may be positive or negative;
- post-tax cash flow may be positive or negative;
- display units may be `$bn` while calculations remain `$m`;
- production profile units and cumulative production units must follow the existing application conventions.

Do not mutate source analytical values merely for optimisation display convenience.

---

# 9. Solver choice

The optimiser must execute in Python behind FastAPI.

Do **not** implement the mathematical solver in React/JavaScript.

Preferred initial approach:

```python
scipy.optimize.milp
```

using HiGHS through SciPy, if compatible with the project environment.

A reasonable alternative is PuLP if there is a clear implementation/testability reason.

Before adding a dependency:

1. inspect current Python/package dependencies;
2. confirm the supported Python version;
3. prefer the smallest dependency footprint;
4. update requirements/pyproject appropriately;
5. add tests proving the solver path works.

The solver must return explicit statuses such as:

- optimal;
- infeasible;
- unbounded if applicable;
- time/resource limit;
- solver error.

Never label a partial or failed result as optimal.

---

# 10. Architecture

The optimiser should be another analytical service alongside the existing scenario and valuation services.

Recommended conceptual structure:

```text
React
  │
  └── PortfolioOptimiser screen
          │
          ▼
       FastAPI
          │
          └── optimisation router
                  │
                  ▼
         optimisation service
                  │
          ┌───────┴────────┐
          │                │
   portfolio data     valuation service
          │                │
          └───────┬────────┘
                  ▼
             MILP solver
```

A possible file structure is:

```text
07_streamlit_app/src/scenario_modeller/
├── domain/
│   └── optimisation.py
└── services/
    └── optimisation_service.py

08_react_app/
├── backend/
│   ├── routers/
│   │   └── optimisation.py
│   └── schemas.py
└── frontend/
    └── src/
        ├── pages/
        │   └── PortfolioOptimiser.jsx
        ├── components/
        │   └── optimisation/
        └── api/
            └── client.js
```

Do not create these exact files if the current repository has evolved toward a better existing pattern. Reuse current architecture.

---

# 11. Optimiser API

A suitable endpoint is:

```text
POST /api/optimisation/solve
```

Use typed Pydantic request/response models rather than a generic unvalidated dict.

Example conceptual request:

```json
{
  "objective": "post_tax_npv",
  "candidate_scope": "full_portfolio",
  "discount_rate": 8.0,
  "constraints": {
    "capex": [
      {
        "from": 2026,
        "to": 2030,
        "max": 12000
      }
    ],
    "production": [
      {
        "year": 2030,
        "min": 2100
      }
    ]
  },
  "mandatory_case_ids": [101, 114],
  "excluded_case_ids": []
}
```

Do not assume these exact field names if current API conventions favour another typed structure.

A conceptual response should include:

```json
{
  "status": "optimal",
  "objective": "post_tax_npv",
  "objective_value": 18420.5,
  "selected_case_ids": [101, 103, 108],
  "excluded_case_ids": [102, 104],
  "portfolio_metrics": {
    "post_tax_npv": 18420.5,
    "capex_2026_2030": 11840.0,
    "production_2030": 2142.0
  },
  "constraint_utilisation": [],
  "solve_time_ms": 42,
  "diagnostics": []
}
```

Include enough information for the frontend to explain the solution rather than merely returning an opaque list of IDs.

---

# 12. Candidate scope

For V1, default optimisation scope should be the **full loaded portfolio**.

This avoids ambiguity with the current shortlist semantics.

The existing shortlist means:

> cases the user wants to modify, exclude or keep handy for review;

it does **not** mean:

> the only cases currently included in the portfolio.

Therefore do not treat the Build-a-Scenario shortlist as the optimiser's candidate universe without an explicit new UX rule.

A future version may allow:

```text
Candidate scope:
- Full portfolio
- Filtered portfolio
- Selected candidate set
```

but this must be explicit.

If Portfolio Viewer filters are later allowed to seed the optimiser, distinguish:

- display/filter scope;
- fixed cases;
- candidate cases;
- excluded cases.

Do not infer these silently.

---

# 13. Optimiser screen UI

The screen should feel consistent with Portfolio Viewer and Scenario Results rather than like a mathematical notebook.

Suggested high-level layout:

```text
PORTFOLIO OPTIMISER
Find a recommended portfolio using a defined objective and constraints.

┌───────────────────────────────────────────────────────────────┐
│ Objective                                                     │
│ [ Maximise Post-tax NPV ▼ ]                                  │
│                                                               │
│ Discount rate [ 8.0 % ]                                      │
└───────────────────────────────────────────────────────────────┘

CONSTRAINTS
┌───────────────────────────────────────────────────────────────┐
│ Type          Period / year      Operator      Value          │
│ Cash Capex    2026–2030          <=            $12.0bn        │
│ Production    2030               >=            2,100 mboed    │
│                                                               │
│ [+ Add constraint]                                           │
└───────────────────────────────────────────────────────────────┘

CASE CONTROLS
Mandatory cases:  [ Select cases ]
Excluded cases:   [ Select cases ]

                                    [ Run Optimisation ]
```

After solving:

```text
OPTIMISATION RESULT
Status: Optimal

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ POST-TAX NPV │ CASH CAPEX   │ PRODUCTION   │ CASES        │
│ $18.4bn      │ $11.8bn      │ 2,142 mboed  │ 37 selected  │
└──────────────┴──────────────┴──────────────┴──────────────┘

Constraint utilisation
Capital 2026–30      $11.8bn / $12.0bn     98.7%
Production 2030       2,142 / 2,100 mboed   satisfied

Recommended cases
[table]

[Review as Scenario]   [Save Recommendation as Scenario]
```

The UI should expose optimisation logic in business language.

Avoid displaying matrix notation or raw solver vectors in the primary interface.

---

# 14. Results and explainability

The user should be able to understand:

- what objective was optimised;
- what constraints were supplied;
- whether the solution is optimal;
- which cases were selected;
- which cases were excluded;
- which constraints are binding or close to binding;
- the resulting portfolio KPI values.

At minimum show a **Constraint utilisation** section.

Examples:

```text
2026–2030 Capex
$11.84bn used of $12.00bn
98.7% utilised
```

```text
2030 Production
2,142 mboed achieved
Minimum required: 2,100 mboed
42 mboed headroom
```

Do not imply causal intelligence or prediction.

The solver is finding the mathematically preferred combination **given the supplied deterministic coefficients, objective and constraints**.

---

# 15. Relationship to scenario persistence

Scenario persistence is a critical companion capability.

The optimiser should not invent a separate permanent result format that cannot be edited by the rest of the application.

The intended hand-off is:

```text
Optimisation result
      ↓
Convert to ordinary scenario configuration
      ↓
Load into Build a Scenario
      ↓
User reviews / modifies
      ↓
Run scenario
      ↓
Save / Save As
```

The recommended portfolio should therefore be convertible into the same working scenario contract used by Build a Scenario.

For V1 binary selection:

```text
selected case   → included / No Change
unselected case → excluded
```

However, because the existing Build-a-Scenario UI uses shortlist membership separately from inclusion, the hand-off must be deliberate.

A sensible implementation is:

- selected optimiser cases remain included at reference profile;
- optimiser-excluded cases are placed into the scenario shortlist and marked `include = false` so the user can see and challenge the exclusions;
- cases that remain included with No Change do not all need to be cluttered into the shortlist unless the existing scenario-state contract requires it;
- preserve enough metadata to identify that the configuration originated from optimisation.

If persistence has been implemented, support a provenance field such as:

```text
creation_method = optimisation
```

and optionally persist optimisation metadata:

```json
{
  "objective": "post_tax_npv",
  "constraints": {},
  "solver_status": "optimal"
}
```

Do not block the optimiser if persistence has not yet landed; structure the hand-off so it can be integrated cleanly later.

---

# 16. Review as Scenario

Add a strong user-controlled hand-off action after a successful optimisation:

```text
Review as Scenario
```

This should **not** automatically save or overwrite anything.

It should load the recommendation into the editable scenario workflow.

The user should then be able to:

- inspect the cases selected/excluded by the optimiser;
- restore an excluded case;
- manually exclude a selected case;
- apply Delay, Accelerate, Farm Down or other existing scenario operations;
- rerun the scenario;
- save the modified result as a normal scenario.

The optimiser is a recommendation generator, not an authority that locks configuration.

---

# 17. Scenario Results compatibility

Once a recommendation has been converted to and run as an ordinary scenario, it should use the standard Scenario Results screen.

Do not create a second duplicate results page just for optimisation.

The redesigned Scenario Results architecture already supports the right conceptual destination:

```text
Reference vs Primary Scenario
```

and, once persisted scenarios exist:

```text
Reference vs Optimised Scenario vs another scenario
```

The optimisation screen should focus on **objective, constraints and recommendation**, while Scenario Results remains the main place for richer portfolio impact comparison.

---

# 18. V2 objective options

Do not necessarily implement all of these in the first pull request, but structure the domain model so additional objectives can be added cleanly.

Potential objectives:

```text
Maximise Post-tax NPV
Maximise cumulative Post-tax Free Cash Flow
Maximise production at a target year
Minimise cumulative Cash Capex
```

Initially prefer:

> one clear primary objective + other business requirements expressed as constraints

rather than implementing an arbitrary weighted multi-objective score.

Weighted multi-objective optimisation can be difficult to interpret because units and weights materially affect the result.

Do not introduce it casually.

---

# 19. V3 — scenario-operation optimisation

This is a later extension, not required for V1.

The more sophisticated future architecture is to optimise over **precomputed feasible case variants** rather than just include/exclude decisions.

For each case, generate variants using the existing scenario engine, for example:

```text
Reference
Delay 1 year
Delay 2 years
Accelerate 1 year
Farm Down 10%
Farm Down 20%
Excluded
```

Then define a binary decision variable for each case/variant combination:

```text
x_(i,v) ∈ {0,1}
```

with a constraint such as:

```text
sum_v x_(i,v) = 1
```

or the appropriate inclusion rule.

The optimiser would then choose both:

- whether a case participates;
- which precomputed variant is used.

This could eventually answer:

> Which combination of project selection, timing and participation maximises portfolio NPV while satisfying capital and production constraints?

## Critical design rule

Do **not** reimplement Delay, Accelerate, Farm In, Farm Down, tax or NPV mathematics inside the optimiser.

The existing scenario engine should generate the candidate variants.

The optimiser should choose among those variants.

This preserves one source of truth for scenario calculations.

---

# 20. Backend validation

Validate optimisation requests before invoking the solver.

Examples:

- year ranges must remain within the model horizon;
- lower year <= upper year;
- numeric constraints must be finite;
- a case cannot be both mandatory and excluded;
- case IDs must exist;
- duplicate constraints should be handled predictably;
- unsupported metrics/objectives should be rejected explicitly;
- discount rate must use the same validation conventions as valuation endpoints;
- negative budget values should be rejected where they are nonsensical;
- production minima must be interpreted in the correct unit.

Return `422` for invalid user inputs where appropriate.

Return a successful HTTP response with an explicit `infeasible` solver status when the model itself is valid but the supplied constraints cannot all be satisfied, unless the existing API error convention strongly suggests another approach.

Do not present infeasibility as an internal server error.

---

# 21. Infeasible result UX

If the model is infeasible, show a useful business message such as:

```text
No feasible portfolio satisfies all current constraints.

Review one or more of:
- Maximum Capex 2026–2030: $8.0bn
- Minimum 2030 Production: 3,000 mboed
- 12 mandatory cases
```

Do not show an empty “recommended portfolio” that looks valid.

If solver diagnostics can identify likely conflicts safely, surface them as diagnostics, but do not fabricate a precise infeasibility explanation unless the solver genuinely provides one.

---

# 22. Optimisation data preparation

Build coefficients from the application's existing portfolio data/services.

For each candidate case, V1 needs at least:

```text
Case ID
Post-tax NPV
Cash Capex for relevant periods/years
Production for relevant years/periods
```

Where possible, centralise coefficient preparation in Python rather than recomputing business rules in React.

Use stable `ID` keys, not display `Case Name`, for optimisation decisions.

Display labels can be joined afterwards.

Be careful that `Case Name` is not assumed to be globally unique if the validated data contract uses `ID` as the stable key.

---

# 23. Testing requirements

Add strong deterministic tests.

## Optimisation-service unit tests

At minimum:

1. **Known small optimum**
   - construct a tiny synthetic portfolio where the correct solution is obvious;
   - verify exact selected IDs and objective value.

2. **Capital constraint binds**
   - highest-NPV unconstrained set exceeds budget;
   - verify optimiser chooses the best feasible combination.

3. **Production constraint binds**
   - verify a lower-NPV production-rich case is selected when required to satisfy the floor.

4. **Mandatory case**
   - mandatory case is selected even if economically unattractive.

5. **Excluded case**
   - excluded case is never selected.

6. **Mandatory/excluded conflict**
   - reject before solver execution.

7. **Infeasible model**
   - return explicit infeasible status.

8. **Loose constraints**
   - verify expected unconstrained solution.

9. **Negative NPV case**
   - if not required by another constraint, verify optimiser can exclude it.

10. **Capex sign conversion**
    - prove negative analytical Cash Capex becomes positive budget consumption correctly.

11. **Repeatability and ties**
    - identical input produces the same optimal objective value and satisfies the same constraints; exact selected IDs are asserted only when the optimum is unique. No secondary tie-breaking objective is currently imposed.

12. **Metric reconciliation**
    - reported output totals equal sums of selected coefficients.

## API tests

Cover:

- valid solve request;
- invalid objective;
- invalid case ID;
- invalid year range;
- mandatory/excluded conflict;
- infeasible response;
- response schema.

## Frontend tests

Cover:

- rendering objective/constraint controls;
- adding/removing constraints;
- Run disabled while invalid;
- loading state while solving;
- optimal result rendering;
- infeasible result rendering;
- constraint utilisation rendering;
- recommendation table;
- Review as Scenario hand-off;
- Home-page optimiser card navigation;
- `/optimise` route;
- top-navigation entry.

Do not remove or weaken existing tests to make optimisation pass.

---

# 24. Performance expectations

V1 binary case selection should be relatively small for the representative portfolio.

Still:

- measure solve time;
- avoid recalculating expensive coefficients repeatedly inside solver loops;
- construct coefficient arrays/dataframes once per request;
- return solve duration in diagnostics/metadata;
- keep UI responsive while the request is running.

Do not add asynchronous job infrastructure unless actual solve time demonstrates a need.

---

# 25. Security and data rules

Continue following `CLAUDE.md`.

The optimiser must use only the repository's sanitised/representative data.

Do not add:

- production BP data;
- credentials;
- external solver SaaS calls;
- external telemetry;
- proprietary optimisation APIs;
- unapproved network dependencies.

Keep the solver local to the Python application.

---

# 26. UI design principles

The optimiser screen should visually belong to the existing application.

Reuse:

- existing theme variables;
- card styling;
- dropdown styling;
- button hierarchy;
- side-panel/dialog patterns where appropriate;
- current responsive conventions;
- existing accessibility patterns.

Do not create a radically different dashboard theme.

The page should feel business-facing rather than mathematical.

Use terms like:

```text
Objective
Constraints
Maximum Capex
Minimum Production
Mandatory cases
Excluded cases
Recommended portfolio
Constraint utilisation
```

rather than exposing solver implementation jargon to ordinary users.

Solver details may appear in a small diagnostic/status area if useful.

---

# 27. Optional configuration panel pattern

If the page becomes visually crowded, use the same right-hand panel/dialog design language already used in Build a Scenario and planned for Scenario Results.

For example:

```text
[ Optimisation Settings ]
```

could open a right-side panel containing:

- objective;
- discount rate;
- constraints;
- mandatory/excluded cases.

The user edits a draft configuration and presses:

```text
Apply settings
```

Then runs optimisation from the main page.

However, for V1, inline controls are acceptable if the screen remains clean.

Do not add a panel solely because one exists elsewhere.

---

# 28. Recommended initial screen composition

A balanced V1 screen is:

```text
Page header
Objective + core settings
Constraint builder
Run Optimisation button

After run:
KPI/result cards
Constraint utilisation
Recommended-case table
Review as Scenario action
```

Avoid filling the first version with many charts.

Portfolio Viewer and Scenario Results already provide richer visual analysis.

The optimiser's main job is to make the mathematical recommendation understandable and actionable.

A later enhancement could add:

- Reference vs Optimised KPI deltas;
- selected/excluded case contribution chart;
- capital utilisation profile by year;
- production floor profile by year.

Do not make those prerequisites for V1.

---

# 29. Home-page and navigation acceptance criteria

The separate-screen architecture is complete when:

1. Home visibly contains a **Portfolio Optimiser** destination box/card.
2. Clicking it navigates to `/optimise`.
3. The optimiser card is not labelled as Step 4 of the manual journey.
4. The original three-step Portfolio Viewer → Build a Scenario → Scenario Results journey remains understandable.
5. `App.jsx` registers `/optimise`.
6. `AppShell.jsx` provides direct top-navigation access to Portfolio Optimiser.
7. Responsive behaviour does not break when the additional destination is added.

---

# 30. Optimisation acceptance criteria

V1 is complete when:

1. The user can open a dedicated Portfolio Optimiser screen.
2. The user can select `Maximise Post-tax NPV` as the objective.
3. The user can define at least one capital constraint.
4. The user can define at least one production constraint.
5. The user can mark cases mandatory or excluded.
6. The backend validates the optimisation request.
7. Python constructs and solves a binary MILP.
8. Cash Capex resource coefficients use correct positive budget-consumption semantics.
9. The solver returns explicit optimal/infeasible/error status.
10. An optimal result shows selected cases and resulting metrics.
11. Constraint utilisation/headroom is visible.
12. The recommendation can be handed off into the normal editable scenario workflow.
13. The optimiser does not automatically overwrite or save the user's current scenario.
14. Existing Portfolio Viewer, Build a Scenario and Scenario Results behaviour continues to work.
15. New automated tests pass together with existing regression tests.
16. The frontend production build passes.
17. The README is updated to describe the new `/optimise` screen and analytical scope.
18. Documentation states clearly that this is a learning/prototype optimisation capability, not a previously validated production feature.

---

# 31. Non-goals for V1

Do not implement all of the following in the first optimisation feature unless separately requested:

- continuous/nonlinear optimisation;
- stochastic optimisation;
- Monte Carlo simulation;
- chance-constrained optimisation;
- probabilistic production modelling;
- arbitrary weighted multi-objective scores;
- automated Delay/Accelerate/Farm Down optimisation;
- price optimisation;
- emissions optimisation;
- external cloud solver services;
- user authentication;
- shared multi-user optimisation sessions;
- automatic scenario saving;
- autonomous portfolio decision-making.

Keep the first implementation interpretable, testable and grounded in the existing application.

---

# 32. Implementation sequence

A sensible order is:

### Phase 1 — architecture and data coefficients

- inspect current analytical services;
- define typed optimisation domain/request/result contracts;
- build case-level coefficient preparation;
- prove units/signs with tests.

### Phase 2 — solver service

- add solver dependency;
- implement binary decision variables;
- implement NPV objective;
- implement capital/production/mandatory/excluded constraints;
- add deterministic tests and solver-status handling.

### Phase 3 — API

- add optimisation router;
- add Pydantic models;
- register router in FastAPI;
- add API tests.

### Phase 4 — new React screen

- add `/optimise` route;
- create Portfolio Optimiser page;
- objective/constraint UI;
- result cards;
- constraint utilisation;
- recommendation table;
- error/infeasible handling.

### Phase 5 — application navigation

- add top-nav item;
- add separate Home-page optimiser card;
- preserve three-step manual journey semantics.

### Phase 6 — scenario hand-off

- convert optimiser selection into ordinary scenario state;
- Review as Scenario;
- integrate with persistence if already available.

### Phase 7 — documentation and regression

- update README;
- run Python/API tests;
- run frontend tests;
- run production build;
- perform manual browser checks.

---

# 33. Working instructions for Claude Code / Codex

Before coding, report briefly:

1. the current relevant architecture you found;
2. the files you expect to change;
3. the solver/library you propose to use and why;
4. the coefficient/sign conventions you will use;
5. how the new `/optimise` route will fit the Home page and navigation;
6. how the optimiser recommendation will be converted into editable scenario state;
7. any dependency on the scenario-persistence feature that is not yet present.

Then implement incrementally.

Do not perform an unrelated refactor of the application.

At the end, report:

- files changed;
- new route/navigation behaviour;
- Home-page changes;
- solver formulation;
- objective and constraints implemented;
- sign/unit treatment;
- API endpoints and schemas;
- scenario hand-off behaviour;
- tests executed and results;
- frontend build result;
- manual browser checks still recommended;
- any known limitations or deferred V2/V3 items.

Do not claim the optimiser has been business validated merely because automated tests pass.

---

# 34. Core design principle

The optimiser should remain subordinate to the controlled scenario framework:

```text
Portfolio analysis
      ↓
Optimisation recommendation
      ↓
Human review
      ↓
Editable scenario
      ↓
Scenario engine
      ↓
Scenario results
```

The application should make it easy for a user to understand and challenge the recommendation.

The optimiser identifies a mathematically preferred configuration under declared assumptions. The user remains responsible for deciding whether that configuration is sensible.

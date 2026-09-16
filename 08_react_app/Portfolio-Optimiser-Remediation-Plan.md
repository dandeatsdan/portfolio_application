# Portfolio Optimiser Remediation and Improvement Plan

## Current implementation — simplified scope, 16 September 2026

The current user decisions supersede the historical recommendations below.

- **One workflow:** Objective → Constraints → Run. An optional Portfolio controls side pane contains production mix targets and hierarchical Region → Country → Case selections. Mix targets start off; cases default to Optimiser chooses.
- Closing the pane preserves active settings. The main page shows enabled mix dimensions and effective required/excluded counts. Clear portfolio controls turns off mix targets and removes all hierarchy rules while preserving the objective, period and constraints.
- All users can choose Post-tax NPV, Free Cash Flow, Underlying RCOP and Production. NPV uses the shared 8% fixed-2026 valuation service. FCF sums post-tax cash flow without discounting; Underlying RCOP sums the before-tax source metric without discounting; production sums annual rates with the existing 0.36525 conversion to mmboe. NPV remains the default.
- Result metadata, table headings, units and saved scenario rationale follow the chosen objective. `objective_contribution` and `reference_objective_value` are objective-neutral. Legacy `npv` and `reference_npv` always contain discounted NPV.
- Region controls set the broad rule. Country rules override their region; individual case rules override both. Country identity is scoped by region. Unspecified rules inherit; explicit `optional` means the optimiser chooses, clearing an inherited requirement or exclusion. Changing a parent preserves more-specific overrides. The UI shows effective counts.
- These effective controls remain strict during flexibility attempts. The backend resolves hierarchy against authoritative case metadata and rejects unknown or duplicate controls. The UI always submits the existing `mix` API contract, which accepts optional controls or none. The legacy `full` API contract remains supported for older clients.
- Optional production-share targets start from reference proportions over the chosen objective period. Sliders move in 1% increments; edits redistribute other shares to keep 100%. Each dimension has an editable tolerance, initially ±5 percentage points; share bands never relax with budget flexibility.
- When every case in a region is effectively excluded, its regional target is redistributed. A country/case override reopening that region restores its reference target and redistributes the remaining shares. Oil/Gas targets stay unchanged. Changing the period refreshes reference shares and resets targets for that period.
- Share constraints require positive selected production. Zero reference production is rejected. Capex uses signed net expenditure for budgets and is not a share denominator.
- Sparse profiles are supported: absent case/metric/year combinations contribute zero for objectives, constraints, headline totals and production mix. Financial metrics are derived only from present source rows, including when the selected subset has no RCOP or cash-flow metric. Existing rows must remain finite and unique; cases with no profile rows at all still fail. Mix shares still require positive total production.
- Solver recommendations are independently checked and replayed through the ordinary scenario service. Hand-off creates an unsaved normal scenario definition, preserves exclusions, and records objectives, limits and hierarchy rules in rationale.

Validation for the unified workflow and sparse profiles: 92 frontend tests and all 218 Python/API tests passed; production build passed with the existing bundle-size warning. Tests cover default controls off, independent mix and case controls, explicit clearing without changing the objective or constraints, all four objectives, hierarchical overrides, scenario hand-off and solver reconciliation. Browser checks confirmed default and mix-enabled solves, hierarchy overrides after closing the pane, retained settings on reopening, explicit clearing, keyboard dismissal/focus restoration, and desktop/390px mobile layouts without internal overflow or runtime errors. Sparse-data regression checks cover missing metrics and years, financial-only and production-only selections, annual minima in absent years, all four objectives, positive mix denominators, and scenario API replay. Automated checks do not constitute business validation.

Tied optima may select different cases; no secondary tie-breaking business objective is imposed. Exact-ID fixtures use unique optima.

## Historical review

## Purpose

This document records a code review of the `feature/with-optimiser` branch and defines a recommended implementation sequence for strengthening the optimiser before it is treated as analytically dependable or considered for merging into the published application.

The review covered the current React optimiser UI, frontend helper logic, FastAPI optimisation router, optimisation domain records, shared Python optimisation service, scenario hand-off, tests, and supporting documentation.

Reviewed branch state: `feature/with-optimiser`, including the optimiser UI redesign commit that introduced selectable objectives and Full Control / Guided / Balanced modes.

The intention is not to redesign the whole application. The existing architectural pattern is sound and should be preserved:

```text
React Portfolio Optimiser
        |
        | JSON request
        v
FastAPI optimisation API
        |
        v
Shared Python optimisation service
        |
        +--> PuLP model
        |
        +--> HiGHS solver
        |
        +--> independent constraint checks
        |
        +--> replay through normal scenario service
        v
Reconciled recommendation
        |
        v
User confirms
        |
        v
Editable working scenario in Build a Scenario
```

The highest-value changes are therefore targeted corrections to contracts, analytical semantics, portfolio-mix mathematics, override precedence, validation and tests.

---

# Executive summary

The optimiser implementation contains several strong design choices:

- optimisation remains server-side rather than running in React;
- FastAPI provides a typed request/response boundary;
- PuLP formulates the binary optimisation model and HiGHS solves it;
- financial calculations continue to use analytical signs rather than display signs;
- the optimiser reuses existing portfolio and scenario logic rather than creating a separate financial model;
- solver status distinguishes optimal, infeasible, time limit, unbounded and solver error outcomes;
- recommendations are independently checked against constraints;
- non-empty recommendations are replayed through the ordinary scenario engine before being marked reconciled;
- the user must explicitly confirm before an optimiser recommendation replaces the current working scenario;
- the optimiser creates an editable scenario rather than silently persisting or executing a business decision.

These principles should be retained.

However, there are several priority issues in the current branch that should be corrected before the optimiser is presented as a robust analytical capability.

## Priority issues

| Priority | Issue | Why it matters |
| --- | --- | --- |
| P0 | Optimiser-to-scenario hand-off contract is inconsistent | `Build scenario from recommendation` can generate a definition shape that does not match the working-scenario reducer contract. |
| P0 | Objective labels and backend calculations are inconsistent | The UI can state one objective while the backend optimises another metric or valuation basis. |
| P0 | Portfolio mix sliders do not mathematically represent portfolio percentage shares | Guided/Balanced recommendations may not satisfy the percentage mix the user believes they have set. |
| P1 | Individual `Optional` case controls do not fully override group/region locks | UI wording and actual precedence are inconsistent. |
| P1 | Too much optimisation semantics are interpreted in React | Business meaning should increasingly be translated into mathematical constraints server-side. |
| P1 | Reference mix is calculated on a fixed 2026–2040 horizon | A user optimising another period may be shown and constrained against a different time horizon. |
| P1 | New optimiser behaviours lack focused automated tests | Backend tests cover the original optimiser well, but newer objectives, mix modes and lock precedence need explicit verification. |
| P2 | API field names still assume NPV-only behaviour | Names such as `reference_npv` and case `npv` become misleading when another objective is selected. |
| P2 | `PortfolioOptimiser.jsx` is becoming a large controller component | Maintainability and testability will improve if sections are separated after analytical correctness is fixed. |

Recommended sequence:

```text
1. Fix scenario hand-off contract
2. Correct and clarify objective calculations
3. Redesign portfolio-mix mathematics
4. Fix override precedence
5. Extend automated tests
6. Clean API terminology and documentation
7. Move more optimisation semantics behind FastAPI
8. Refactor optimiser UI structure
```

---

# 1. Preserve the current architecture

Do not replace the optimiser architecture with a client-side solver or a separate calculation methodology.

The desired architecture remains:

```text
React
  = user intent and interaction

FastAPI
  = validation, orchestration and API contract

Shared Python package
  = analytical and optimisation business logic

PuLP / HiGHS
  = mathematical formulation and solve

Scenario service
  = independent replay and reconciliation
```

This separation is particularly valuable because it keeps the optimiser as another analytical consumer of the same underlying business calculations used elsewhere in the application.

The optimiser must not duplicate:

- post-tax financialisation;
- scenario-operation calculations;
- NPV calculation;
- tax logic;
- display-sign logic.

---

# 2. P0 — Fix optimiser recommendation hand-off into Build a Scenario

## Current problem

The working-scenario reducer expects a persisted scenario-definition style object with fields such as:

```text
name
description
rationale
shortlisted_case_ids
case_configurations
```

The current optimiser helper returns a different shape based around fields such as:

```text
scenarioName
scenarioDescription
excludedCaseIds
```

The reducer then sends that definition through the normal scenario hydration path.

This contract mismatch should be treated as a blocking defect.

## Required behaviour

An optimiser recommendation should be converted into an ordinary unsaved scenario definition using the same structure as saved scenarios.

The intended business behaviour is:

- selected optimiser cases remain included at their reference profile;
- selected cases do not need to appear in the shortlist unless the working-scenario contract explicitly requires them there;
- cases not selected by the optimiser become shortlisted exclusions;
- excluded cases should use `include: false`;
- operation should default to `No Change` / the canonical engine equivalent;
- all operation parameters should be zero/default;
- the recommendation should become an unsaved working scenario;
- existing saved scenarios must remain untouched;
- opening the optimiser recommendation must not auto-save it;
- the next explicit Save should create a new persisted scenario.

## Recommended definition shape

Use the existing scenario-definition schema rather than creating another optimiser-specific shape.

Conceptually:

```json
{
  "schema_version": 1,
  "name": "Optimiser Recommendation",
  "description": "...",
  "rationale": "...",
  "shortlisted_case_ids": [2, 5, 9],
  "case_configurations": {
    "2": {
      "include": false,
      "operation": "No Change",
      "params": [0, 0, 0, 0, 0]
    },
    "5": {
      "include": false,
      "operation": "No Change",
      "params": [0, 0, 0, 0, 0]
    },
    "9": {
      "include": false,
      "operation": "No Change",
      "params": [0, 0, 0, 0, 0]
    }
  }
}
```

Use the exact canonical operation labels expected by the existing scenario-definition helpers. Do not introduce a second operation vocabulary.

## Rationale content

The generated rationale should retain the optimiser provenance in human-readable form, for example:

- optimisation mode;
- objective;
- objective period;
- original limits;
- flexible limits and actual relaxation step where relevant;
- Group Entity / Region mix policy if used;
- mandatory/excluded controls;
- whether the recommendation reconciled successfully.

Do not store solver-internal implementation detail unless useful to the business reader.

## Acceptance criteria

- `Build scenario from recommendation` opens `/build` with the recommendation correctly represented.
- Selected cases remain included at reference values.
- Unselected cases appear as editable exclusions.
- Existing saved scenarios remain untouched.
- The new working scenario is dirty/unsaved.
- Save creates a new persisted scenario.
- Save and run executes the same include/exclude recommendation through the normal scenario endpoint.
- No optimiser-specific scenario-definition schema is introduced.

---

# 3. P0 — Correct and clarify optimisation objectives

## Current problem

The latest UI exposes multiple objectives, but labels and calculations are not fully aligned.

Examples that must be resolved:

1. `post_tax_fcf` is described in the UI as an undiscounted Free Cash Flow objective, while the backend currently routes it through `npv_by_case(...)` and therefore optimises discounted Post-Tax NPV.
2. `underlying_rcop` is labelled as Underlying RCOP in the UI, while the domain mapping points it to `Post-Tax RCOP`.
3. API response fields such as `reference_npv` and per-case `npv` imply NPV even when another objective is selected.

A user must never be shown one objective while the solver maximises another.

## Recommended objective set

Prefer explicit, business-readable objective keys and labels:

```text
post_tax_npv
post_tax_fcf
post_tax_rcop
production
```

Suggested meanings:

### `post_tax_npv`

- source: Post-Tax Cash Flow;
- valuation: shared `npv_by_case(...)` service;
- default discount rate: 8%;
- fixed 2026 discount origin;
- selected year window does not reset discount origin.

### `post_tax_fcf`

- source: Post-Tax Cash Flow;
- undiscounted sum over selected objective period;
- unit: `$m`.

### `post_tax_rcop`

- source: Post-Tax RCOP;
- undiscounted sum over selected objective period;
- unit: `$m`.

### `production`

- source: Total Production (mboed);
- cumulative selected-period production using the existing `0.36525` conversion;
- unit: `mmboe` for period totals.

If there is a genuine requirement to retain an `underlying_rcop` objective, use actual `Underlying RCOP` rather than mapping that name to Post-Tax RCOP.

## Recommended default

Use **Post-Tax NPV** as the default optimiser objective unless there is a deliberate business decision to change it.

This maintains continuity with the original optimiser design and gives the optimiser a clear portfolio-value objective.

## Objective metadata

Centralise objective metadata server-side or in one shared configuration contract rather than duplicating labels and units across multiple React conditions.

For example:

```json
{
  "objective": "post_tax_npv",
  "objective_label": "Post-Tax NPV",
  "objective_unit": "$m"
}
```

## Acceptance criteria

- Every objective shown in React maps to the exact intended metric and calculation in Python.
- Objective labels, descriptions, units and result-table headings match the backend calculation.
- NPV remains discounted using the existing valuation service.
- FCF/RCOP objectives are undiscounted only if explicitly labelled that way.
- No field called `npv` contains FCF, RCOP or production values.
- Tests prove that different objective choices can select different portfolios.

---

# 4. P0 — Redesign portfolio-mix mathematics

## Current problem

The Guided/Balanced UI presents Group Entity and Region sliders as portfolio percentage allocations that must sum to 100%.

However, current frontend expansion converts each percentage into an absolute minimum based on that dimension's own reference total:

```text
absolute target = selected percentage × reference total for that dimension
```

This does not impose the displayed share on the selected portfolio.

Example:

```text
Reference production:
Oil = 600
Gas = 400
Total = 1,000

Reference mix:
Oil = 60%
Gas = 40%
```

The current transformation effectively creates minimums like:

```text
Oil >= 60% × 600 = 360
Gas >= 40% × 400 = 160
```

A selected portfolio satisfying those floors does not necessarily have a 60/40 production mix.

## Correct share formulation

For a target share `p`, the intended rule is:

```text
Selected dimension contribution / Selected total contribution >= p
```

For example:

```text
Selected Oil Production / Selected Total Production >= 60%
```

This can be expressed linearly:

```text
Σ OilContribution_i * x_i
  >=
0.60 * Σ TotalContribution_i * x_i
```

or equivalently:

```text
Σ (OilContribution_i - 0.60 * TotalContribution_i) * x_i >= 0
```

This remains a linear MILP constraint and is therefore compatible with PuLP / HiGHS.

## Balanced mode

Do not force exact reference percentages for a binary whole-case problem unless exact equality is explicitly required.

Exact proportions may be impossible when the optimiser selects whole cases.

Prefer an explicit tolerance around the reference mix.

Example:

```text
Reference Oil share = 60%
Tolerance = ±5 percentage points

Oil share must lie between 55% and 65%
```

This requires lower and upper linear share constraints.

Possible future configuration:

```json
{
  "dimension": "group_entity",
  "metric": "production",
  "target_share_pct": 60,
  "tolerance_pct_points": 5
}
```

For Guided mode, allow the user to choose target proportions and a clearly labelled tolerance/band rather than silently treating a slider percentage as an absolute floor.

## Business semantics to clarify

Decide whether a mix is based on:

- production;
- Cash Capex;
- another supported portfolio measure.

The selected metric must be clear in the UI and request contract.

For Capex-based mix, preserve the existing signed-net-Capex business logic. Do not use display-mutated values.

## Prefer server-side expansion

The frontend should preferably send target shares as business intent rather than constructing solver coefficients itself.

Recommended request concept:

```json
{
  "mix_constraints": [
    {
      "dimension": "Group Entity",
      "value": "Oil",
      "metric": "production",
      "min_share_pct": 55,
      "max_share_pct": 65
    }
  ]
}
```

The backend should use the authoritative case listing and analytical profiles to build the mathematical coefficients.

## Acceptance criteria

- A 60% share means 60% of the selected portfolio measure, not 60% of a reference sub-total.
- Mix rules reconcile independently after the solve.
- Balanced mode starts from the selected-period reference mix.
- Tolerances are explicit and visible.
- Binary whole-case feasibility is handled cleanly.
- Infeasible mix settings return an understandable result rather than silently changing meaning.
- Tests compare the optimiser result with brute-force enumeration on a small portfolio.

---

# 5. P1 — Fix Group Entity / Region / individual override precedence

## Current problem

The UI tells the user that individual case overrides take precedence over Group Entity and Region locks.

Current representation uses only:

```text
mandatory_case_ids
excluded_case_ids
```

Choosing `Optional` removes the case from both lists.

However, group and region locks are expanded again before the individual lists are applied. Therefore an individual `Optional` cannot fully override a broader `mandatory` or `excluded` lock.

## Desired precedence

Use an explicit precedence model:

```text
1. Base state = optimiser chooses
2. Group Entity rule
3. Region rule
4. Explicit individual case override LAST
```

An individual case must be capable of explicitly taking one of three states:

```text
optional
mandatory
excluded
```

Recommended representation:

```json
{
  "case_overrides": {
    "101": "optional",
    "102": "mandatory",
    "103": "excluded"
  }
}
```

Do not infer an explicit `optional` override from the absence of a case in two lists.

## Conflict behaviour

Define deterministic behaviour for conflicting Group Entity and Region rules.

Recommended options:

- reject conflicts and ask the user to resolve them; or
- define a documented precedence rule.

Prefer rejecting ambiguous conflicts unless there is an agreed business rule.

## Acceptance criteria

- Individual `Must include` overrides broader exclusions.
- Individual `Must exclude` overrides broader inclusions.
- Individual `Optimiser chooses` can explicitly return a case to optional even when a broader lock exists.
- Conflicting Group Entity and Region rules are detected or resolved by a documented policy.
- React wording exactly matches implemented precedence.

---

# 6. P1 — Move more optimisation semantics behind FastAPI

## Current situation

`optimiserHelpers.js` currently performs meaningful business interpretation, including:

- expanding Group Entity locks into case IDs;
- expanding Region locks into case IDs;
- calculating reference portfolio mix;
- translating slider settings into mathematical constraints;
- resolving some lock precedence.

This makes React responsible for more than presentation and user interaction.

## Recommended target architecture

React should send business intent.

Python should translate that intent into optimisation mathematics.

```text
React
  "The user wants this objective, mix, limits and case policy"

        |
        | JSON
        v

FastAPI / Python
  "Translate that business intent into validated solver constraints"

        |
        v

PuLP / HiGHS
  "Solve the mathematical problem"
```

Advantages:

- server owns the authoritative case listing and reference data;
- one validation layer governs analytical meaning;
- React does not need to reconstruct solver mathematics;
- easier unit testing;
- easier reuse by another frontend later;
- cleaner DT604 architecture narrative.

## Scope control

Do this after the P0 fixes. Do not combine it with a large unrelated frontend rewrite.

---

# 7. P1 — Recalculate reference mix using the active optimisation horizon

## Current problem

The optimiser currently retrieves reference totals using a fixed 2026–2040 period.

If the user sets the optimisation objective period to 2026–2030, Balanced mode can still be displaying and deriving its reference proportions from 2026–2040.

## Recommendation

When `year_from` or `year_to` changes:

- retrieve or calculate reference totals for that same horizon;
- recalculate reference percentage bars;
- recalculate Balanced defaults;
- invalidate any stale recommendation.

Alternatively, if the business deliberately wants one fixed strategic reference period, make that explicit in the UI.

Preferred behaviour: align the reference mix with the active optimisation period.

## Error handling

Do not silently swallow reference-data loading errors.

Current patterns such as:

```javascript
.catch(() => {})
```

should be replaced with an explicit loading/error state when the missing data affects Guided or Balanced behaviour.

## Acceptance criteria

- Mix reference bars and Balanced defaults use the active objective period.
- Changing period invalidates or recalculates stale mix settings in a predictable way.
- Failure to load required reference values is visible to the user.

---

# 8. P1 — Extend tests for the new optimiser behaviour

The existing optimiser tests provide a good base and should be retained.

They already cover important original behaviours such as:

- brute-force optimum comparison;
- mandatory/excluded cases;
- flexible and strict limits;
- cumulative vs every-year constraints;
- timeout behaviour;
- empty optimum handling;
- invalid/non-finite data;
- replay mismatch blocking publication;
- API validation;
- Capex sign handling;
- round-trip through the normal scenario route.

Add focused tests for the newer branch features.

## Test A — objective semantics

Create a tiny portfolio where each objective has a deliberately different optimum.

For example design cases so that:

```text
Portfolio selected by NPV != portfolio selected by FCF
Portfolio selected by FCF != portfolio selected by RCOP
Portfolio selected by RCOP != portfolio selected by Production
```

Assert exact selected IDs for each objective.

This is the strongest guard against label/calculation drift.

## Test B — portfolio share mathematics

Create a small portfolio with known Oil/Gas or Region production contributions.

Brute-force every possible case combination and calculate the actual selected portfolio shares.

Assert that the optimiser:

- selects a feasible optimum;
- respects min/max share bands;
- does not merely satisfy absolute sub-portfolio floors.

## Test C — Balanced mode

Given a reference portfolio with a known mix, assert that:

- reference percentages are calculated correctly;
- the selected horizon is used;
- tolerance bands are built correctly;
- exact 100% rounding does not distort the business rule.

## Test D — lock precedence

Test combinations such as:

```text
Region mandatory + case optional
Region mandatory + case excluded
Region excluded + case mandatory
Group Entity mandatory + Region excluded
```

Assert the agreed precedence or conflict behaviour.

## Test E — scenario hand-off

Test the full frontend helper/reducer path:

```text
optimiser result
  -> recommendationDefinition
  -> scenarioReducer(recommendation)
  -> buildScenarioInstructions
```

Assert:

- selected optimiser cases = included instructions;
- unselected optimiser cases = excluded instructions;
- working scenario is unsaved;
- previous saved ID is not reused;
- serialised definition matches the saved-scenario schema.

## Test F — scoped constraint IDs

If `case_ids` remain part of the API contract, explicitly reject unknown IDs and duplicates where appropriate.

Do not allow an invalid client to silently create scoped constraints against nonexistent cases.

## Test G — frontend behavioural acceptance

In addition to pure helper tests, manually or with browser automation verify:

- switching modes and confirmation behaviour;
- unsaved optimiser settings;
- selected objective and period;
- reference mix refresh;
- case lock precedence;
- infeasible-result messaging;
- timeout messaging;
- recommendation confirmation;
- Build a Scenario hand-off;
- save and run after hand-off;
- keyboard focus and dialog dismissal.

---

# 9. P2 — Clean up API terminology

The API started as NPV-only and some field names still reflect that history.

Avoid response fields such as:

```text
reference_npv
case.npv
```

when those values can represent FCF, RCOP or production.

Prefer neutral names:

```text
reference_objective_value
objective_value
case.objective_contribution
```

Return explicit metadata:

```json
{
  "objective": "post_tax_npv",
  "objective_label": "Post-Tax NPV",
  "objective_unit": "$m"
}
```

This removes frontend guesswork and prevents accidental mislabelling.

If backward compatibility is needed temporarily, introduce new names first and remove legacy fields only after frontend migration.

---

# 10. P2 — Refactor `PortfolioOptimiser.jsx` after correctness is secured

Do not prioritise a cosmetic refactor ahead of analytical correctness.

Once P0/P1 issues are resolved, split the page into focused components.

Recommended structure:

```text
PortfolioOptimiser
  |
  +-- OptimiserModeSelector
  +-- OptimiserObjectiveSelector
  +-- PortfolioMixEditor
  +-- PortfolioLimitsEditor
  +-- OptimiserCaseRules
  +-- OptimisationRunPanel
  +-- OptimisationResults
```

Consider a `useOptimiser()` hook for:

- draft state;
- loading reference mix;
- request execution;
- stale-run protection;
- recommendation state;
- mode switching;
- error state.

Benefits:

- easier test isolation;
- easier code review;
- less page-level branching;
- cleaner reuse of common dialog/field patterns;
- easier explanation in architecture documentation.

Avoid creating abstractions purely for elegance. Split only where responsibilities are already distinct.

---

# 11. Preserve important solver controls

The following behaviours are good and should remain unless there is a deliberate reason to change them.

## Direct HiGHS status inspection

Continue checking the underlying HiGHS model status rather than relying only on PuLP's high-level mapping.

A time-limited incumbent must not be reported as a proven optimum.

## Flexible constraints

Keep the current principle:

- attempt original limits first;
- relax only after proven infeasibility;
- strict constraints never move;
- each flexible constraint has its own maximum cap;
- percentages are based on the original target, not compounded;
- stop at the first flexibility step that establishes an optimal feasible result.

Do not describe this as "optimising flexibility". It is a deterministic feasibility fallback policy.

## Independent checks

Continue independently summing selected-case coefficients and checking:

- constraint satisfaction;
- mandatory inclusion;
- excluded-case absence.

## Scenario replay

Continue replaying a non-empty recommendation through the normal scenario service.

The optimiser should not be allowed to publish a recommendation that cannot be reproduced by the ordinary application calculation path.

## Analytical signs

Continue using analytical Cash Capex signs when constructing resource coefficients.

Do not introduce `abs()` or display-sign transformations into the analytical source data merely to make budgets positive.

Presentation should remain separate from calculation.

---

# 12. Documentation updates after implementation

Once the remediation work is complete, update:

- `08_react_app/README.md`;
- `Portfolio-Optimiser-Implementation-Brief.md` where historical design assumptions are now superseded;
- any architecture diagram or DT604 explanation that currently states the optimiser is NPV-only if multiple objectives remain;
- relevant inline module comments in `optimisation_service.py` and `optimisation.py`.

Pay particular attention to documentation drift.

The current optimiser service header contains valuable explanation of the original NPV-only model, but if the branch retains multiple objectives that commentary must be updated so it does not describe a different mathematical model from the code.

Document explicitly:

- objective definitions;
- mix-share mathematics;
- Group Entity / Region / individual precedence;
- flexibility semantics;
- scenario replay/reconciliation;
- limits of the optimiser.

---

# 13. Non-goals for this remediation

Do not expand scope into the following unless separately agreed:

- optimisation of Delay / Accelerate / Farm Down / Farm In parameters;
- weighted multi-objective scoring;
- stochastic optimisation;
- probabilistic risk models;
- machine learning;
- project dependency networks;
- mutually exclusive alternatives;
- enterprise authentication;
- multi-user persistence;
- production database design;
- cloud deployment redesign;
- solver-result persistence;
- production fiscal modelling.

The purpose of this remediation is to make the existing binary reference-case optimiser internally consistent, testable and explainable.

---

# 14. Suggested Codex implementation sequence

Codex should work in small, testable steps rather than rewriting the optimiser in one pass.

## Step 1 — inspect current contracts

Before editing:

- read `frontend/src/pages/PortfolioOptimiser.jsx`;
- read `frontend/src/pages/optimiserHelpers.js`;
- read `frontend/src/hooks/scenarioDefinition.js`;
- read `frontend/src/hooks/scenarioInstructions.js`;
- read `backend/routers/optimisation.py`;
- read `07_streamlit_app/src/scenario_modeller/domain/optimisation.py`;
- read `07_streamlit_app/src/scenario_modeller/services/optimisation_service.py`;
- read optimiser backend and frontend tests.

Do not assume this remediation document supersedes newer code if the branch has changed.

## Step 2 — fix scenario hand-off

- align `recommendationDefinition()` with the existing scenario-definition schema;
- update frontend tests first or in the same change;
- verify recommendation -> reducer -> scenario instructions;
- verify Build page behaviour manually.

## Step 3 — normalise objective definitions

- introduce explicit objective keys;
- correct Python calculation mapping;
- centralise label/unit metadata;
- remove misleading NPV naming where objective-neutral data are returned;
- add objective-specific backend tests.

## Step 4 — replace mix-floor logic with true portfolio-share constraints

- define a typed backend representation for share constraints;
- use server-side case/profile data to build share coefficients;
- support lower/upper bounds or tolerance bands;
- update Guided/Balanced React request generation;
- add brute-force comparison tests.

## Step 5 — fix rule precedence

- introduce explicit individual override state;
- define Region vs Group Entity conflict behaviour;
- update React controls and backend request validation;
- add precedence tests.

## Step 6 — align reference mix to objective horizon

- recalculate reference bars/defaults when period changes;
- add visible loading/error states;
- invalidate stale recommendation when source settings change.

## Step 7 — update API terminology

- use objective-neutral field names;
- return objective metadata;
- update React display logic;
- update tests.

## Step 8 — rerun complete validation

Backend/shared package:

```bash
python -m pytest 07_streamlit_app/tests 08_react_app/backend/tests -q
```

Frontend helper tests:

```bash
cd 08_react_app/frontend
node --test src/pages/optimiserHelpers.test.js
```

Also run the wider relevant frontend test set and:

```bash
npm run build
```

## Step 9 — manual acceptance

Verify at least:

1. Full Control with no additional constraints.
2. NPV objective.
3. FCF objective.
4. RCOP objective.
5. Production objective.
6. Strict Capex constraint.
7. Flexible Capex constraint.
8. Production floor.
9. Guided portfolio mix.
10. Balanced portfolio mix.
11. Group Entity locks.
12. Region locks.
13. Individual optional/mandatory/excluded override.
14. Infeasible result.
15. Time-limit behaviour if feasible to simulate.
16. Recommendation confirmation.
17. Open in Build a Scenario.
18. Modify recommendation manually.
19. Save as a new scenario.
20. Save and run.
21. Open in Scenario Results.

## Step 10 — documentation

Only after implementation/tests pass:

- update README;
- update optimiser comments;
- note any deliberate deviations from this remediation plan;
- keep `main` untouched unless separately instructed.

---

# 15. Acceptance checklist

The remediation is complete when all of the following are true.

## Calculation integrity

- [ ] Every displayed objective matches its actual Python calculation.
- [ ] Post-Tax NPV reuses the shared valuation service.
- [ ] FCF/RCOP objective definitions are explicit and correctly labelled.
- [ ] Production totals use the existing conversion convention.
- [ ] Cash Capex analytical signs remain unchanged.

## Mix integrity

- [ ] Mix percentages are shares of the selected portfolio measure.
- [ ] Balanced mode uses the active objective horizon or a clearly stated fixed horizon.
- [ ] Binary-case tolerance is explicit.
- [ ] Mix constraints are independently checked after solving.

## Control integrity

- [ ] Group Entity rules work.
- [ ] Region rules work.
- [ ] Individual mandatory overrides work.
- [ ] Individual excluded overrides work.
- [ ] Individual optional overrides work.
- [ ] Cross-dimension conflicts follow a documented rule.

## Scenario lifecycle

- [ ] Recommendation hand-off uses the normal scenario-definition schema.
- [ ] Selected cases remain included at reference values.
- [ ] Unselected cases become editable exclusions.
- [ ] Existing saved scenarios are not overwritten.
- [ ] Recommendation becomes an unsaved working scenario.
- [ ] Normal Save and Save and run workflows work afterwards.

## Solver publication controls

- [ ] Timeout is not reported as optimal.
- [ ] Infeasible result publishes no recommendation.
- [ ] Solver errors publish no recommendation.
- [ ] Constraint checks pass before publication.
- [ ] Scenario replay reconciles before `reconciled=True`.

## Testing

- [ ] Different objectives have explicit regression tests.
- [ ] Portfolio-share constraints are brute-force verified on a small portfolio.
- [ ] Lock precedence is tested.
- [ ] Scenario hand-off is tested end-to-end at helper/reducer level.
- [ ] Backend and shared-package tests pass.
- [ ] Frontend tests pass.
- [ ] Frontend production build passes.
- [ ] Manual browser acceptance is completed.

---

# 16. DT604 / architecture reflection note

This optimiser is useful as evidence of subsequent architectural development, but it should be described accurately.

A suitable architecture narrative is:

> The optimiser extends the scenario application from user-defined scenario evaluation into prescriptive portfolio selection. React captures the user's objective, limits and portfolio policy; FastAPI validates and routes the request; the shared Python package translates the request into a binary mixed-integer linear programme; PuLP formulates the model and HiGHS solves it. The recommendation is not accepted blindly: the selected cases are independently checked and replayed through the same scenario and financialisation services used by ordinary scenarios before the recommendation is exposed to the user. The user then explicitly converts the recommendation into an editable working scenario rather than the system automatically saving or executing a business decision.

The strongest reflective point is the separation of responsibilities:

```text
React        = user intent and interaction
FastAPI      = validation and orchestration boundary
Python       = analytical/business logic
PuLP/HiGHS   = mathematical optimisation
Scenario app = independent replay, human review and editable decision state
```

The remediation in this document is intended to strengthen that architecture by ensuring the user-facing business semantics and the mathematical implementation remain aligned.

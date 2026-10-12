# Plan: Investment Metrics + Case Aliasing

_Created: 2026-10-12. Status: draft — in discussion, not yet approved for implementation._

---

## Context

Two features are in scope:

1. **Investment metrics** — `bp_inv_ratios.md` defines four mandatory metrics (NPV already done, plus IRR, Discounted Payback Period, Investment Efficiency) and several recommended ones. The current `valuation_service.py` only computes NPV. The Portfolio and Results screens need richer economic analysis.

2. **Case aliasing** — The current data is already at the Modelling Case grain (Financial Entity → Case translation was done in Power Query). The goal is to let users define their own **aliases** (user-defined group names) that collapse multiple cases into a named aggregate, which then becomes the unit used in scenario building. This mirrors the original Excel mapping concept but keeps the source data unchanged — it is purely a UI-driven group-by applied at the scenario grain.

---

## Feature 1: Investment Metrics

### What to build

Extend `valuation_service.py` in the shared package with three new functions alongside the existing `npv_by_case`:

**`irr_by_case(profiles, year_from, year_to) → DataFrame[ID, IRR]`**
- Filters to `Post-Tax Cash Flow` per case, builds an annual cash-flow array ordered by Year.
- Uses `numpy_financial.irr()` (or `scipy.optimize.brentq` on the NPV formula as a fallback) to solve for the rate where NPV = 0.
- Returns IRR as a decimal (e.g. 0.12 for 12%). Returns `NaN` where IRR cannot be solved (all-positive or all-negative cash flows).
- Dependency: `numpy-financial` — add to `07_streamlit_app/pyproject.toml` extras and `08_react_app/backend/requirements.txt`.

**`discounted_payback_by_case(profiles, discount_rate, year_from, year_to) → DataFrame[ID, DiscountedPayback]`**
- Filters to `Post-Tax Cash Flow`, discounts each year (same convention as `npv_by_case`: exponent = `Year - 2026 + 0.5`), computes running cumulative sum ordered by Year.
- Returns the first Year where cumulative discounted CF turns positive, or `NaN` if payback never occurs within the horizon.

**`investment_efficiency_by_case(profiles, discount_rate, year_from, year_to) → DataFrame[ID, IE, PI]`**
- IE = NPV / PV(Investment), where PV(Investment) = sum of discounted negative `Post-Tax Cash Flow` rows (capex-dominated years).
- PI = IE + 1.
- Returns both columns per case. IE > 0 = value creating.

Fix the existing creaming curve endpoint: it currently labels `NPV/Capex` as `PI`, which is numerically closer to IE. After adding the proper IE function, align the creaming curve label or expose both clearly.

### Where to add the new metrics

**`valuation_service.py`** — the three new functions go here in the shared package, so both Streamlit and React benefit.

**`08_react_app/backend/routers/portfolio.py`** — extend `GET /api/portfolio/entity_summary` to include IRR, Discounted Payback, IE, and PI per case alongside NPV.

**`08_react_app/backend/routers/results_analysis.py`** — extend the `kpis` analysis path to include IRR, Discounted Payback, and IE for baseline vs scenario comparison.

**React: Portfolio Viewer** — add IRR, Discounted Payback, IE to the Case Summary table and entity summary panel (currently shows Production, Capex, FCF, NPV).

**React: Scenario Results** — add IRR, Discounted Payback, IE to the KPI comparison cards.

### Formatting conventions
- IRR: show as percentage with 1 decimal (e.g. `12.4%`); `—` if unsolvable.
- Discounted Payback: show as year (e.g. `2031`); `> 2040` or `—` if not achieved within horizon.
- IE: show as decimal to 2dp (e.g. `0.54`); prefix `+` for positive.
- PI: show as decimal to 2dp (e.g. `1.54`).

### Tests
Add unit tests in `07_streamlit_app/tests/test_valuation_service.py` (new file):
- IRR on a simple known cash-flow sequence (assert within tolerance).
- Discounted Payback on a sequence where payback is known year.
- IE/PI on a known sequence.
- Edge cases: all-positive cash flows (no investment → IRR unsolvable), single-year profile.

---

## Feature 2: Case Aliasing

### Concept

The source case listing remains unchanged. The user creates a set of **alias definitions**: each alias has a name and maps to one or more `ID`s from the current case listing. Aliases are applied as a pre-processing step before scenario building:

- A case with an alias is relabelled with the alias name for scenario configuration and display.
- Multiple cases sharing the same alias are summed at the profile grain before any operations are applied (group-by alias → sum `Value` per `Metric × Year`).
- The original `ID`s remain traceable; the alias acts as a virtual case.
- If no alias is assigned, the original `Case Name` is used as-is.

This is a lightweight version of the Power Query mapping step, implemented in frontend session state with no database required for the initial version.

### What to build

**New React page: `AliasManager.jsx`** (route `/aliases`)

A screen with two panels:
- Left: full case listing table (Case Name, Region, Country, Plan Type, Group Entity). Checkboxes allow selection of one or more cases.
- Right: alias list. User types an alias name, clicks "Add alias for selected cases". Existing aliases are listed with their member cases and a Remove button.

The alias state is stored in a new React context (`AliasContext`) — a map of `{aliasName: [id1, id2, ...]}`. This context is consumed by Build a Scenario.

**Build a Scenario changes**

When aliases exist, Build a Scenario uses the aliased grain:
- Cases with an alias are replaced by a single row per alias.
- Profile values for member cases are summed per `Metric × Year` before operations are applied.
- Cases without an alias appear unchanged.
- The shortlist and scenario configuration work against alias names / combined IDs.

**Optional FastAPI endpoint: `POST /api/cases/resolve_aliases`**
- Request body: `{aliases: [{alias_name: str, ids: [int]}]}`
- Returns: per-alias, summed profile totals and a synthetic case listing entry (alias_name as `Case Name`; `"Multiple"` for attributes that differ across members).
- For MVP, front-end aggregation from cached profiles is sufficient for sample data scale.

**Navigation**: add "Aliases" to the top nav alongside Portfolio, Build, Results.

### MVP scope

1. `AliasContext` in React — holds alias definitions in session state.
2. `AliasManager.jsx` page — create/delete aliases, assign cases.
3. Build a Scenario reads alias context — shows aliased rows, prevents aliased cases appearing individually.
4. Results display alias names in place of component case names.

Defer: persisting aliases to JSON/SQLite, server-side profile aggregation endpoint.

---

## Files to change

| File | Change |
|---|---|
| `07_streamlit_app/src/scenario_modeller/services/valuation_service.py` | Add `irr_by_case`, `discounted_payback_by_case`, `investment_efficiency_by_case` |
| `07_streamlit_app/pyproject.toml` | Add `numpy-financial` to dependencies |
| `08_react_app/backend/requirements.txt` | Add `numpy-financial` |
| `08_react_app/backend/routers/portfolio.py` | Extend `entity_summary` and `creaming` with new metrics |
| `08_react_app/backend/routers/results_analysis.py` | Extend `kpis` analysis with new metrics |
| `08_react_app/frontend/src/contexts/AliasContext.jsx` | New — alias state |
| `08_react_app/frontend/src/pages/AliasManager.jsx` | New — alias management screen |
| `08_react_app/frontend/src/pages/PortfolioViewer.jsx` | Add IRR, DPB, IE columns to entity summary table |
| `08_react_app/frontend/src/pages/BuildScenario.jsx` | Consume alias context |
| `08_react_app/frontend/src/pages/ScenarioResults.jsx` | Show new KPI metrics in comparison cards |
| `08_react_app/frontend/src/App.jsx` (or nav component) | Add Aliases route |
| `07_streamlit_app/tests/test_valuation_service.py` | New — IRR, DPB, IE unit tests |

---

## Implementation order

1. **valuation_service.py** — add and test the three metric functions (backend-independent).
2. **Backend endpoints** — extend entity_summary and results kpis.
3. **React metric display** — Portfolio Viewer and Results KPI cards.
4. **AliasContext + AliasManager** — session-state aliasing UI.
5. **Build a Scenario aliasing** — consume alias context.

---

## Verification

- Run `python -m pytest 07_streamlit_app/tests/ 08_react_app/backend/tests/ -q` — all existing tests must still pass; new valuation tests must pass.
- Start backend — `/api/portfolio/entity_summary` should return IRR, DPB, IE fields.
- Start frontend — Portfolio Viewer case summary should show new metrics; Aliases nav item should appear.
- Create two aliases in AliasManager, navigate to Build a Scenario, confirm aliased cases appear as single rows.

---

## Open questions / deferred decisions

- **Alias persistence**: session-only for MVP; JSON file persistence is a natural next step when the user wants aliases to survive page reloads.
- **Creaming curve label**: decide whether to relabel the existing `PI` column as `IE`, add a separate `PI` column, or show both. Needs user confirmation before changing the existing chart.
- **Breakeven price, Value at Risk**: these are `bp_inv_ratios.md` recommended metrics but require a price assumption input not currently in the data model. Defer until price modelling scope is confirmed.
- **IRR convention**: bp_inv_ratios.md uses annual compounding. Confirm whether mid-year or end-of-year convention should be used for consistency with the existing NPV discounting.

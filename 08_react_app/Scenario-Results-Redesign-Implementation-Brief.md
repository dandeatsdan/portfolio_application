# Scenario Results Redesign — Detailed Implementation Brief for Claude Code / Codex

Use this document as the implementation brief for redesigning the React **Scenario Results** experience in `08_react_app`.

This is intentionally detailed so that either Claude Code or Codex can work from it with minimal interpretation.

---

## 1. First instruction: inspect the repository before changing code

Before implementing anything, read and inspect the current branch. Do not assume this document is more current than the executable code.

At minimum inspect:

- `CLAUDE.md`
- `08_react_app/README.md`
- `08_react_app/frontend/src/pages/ScenarioResults.jsx`
- `08_react_app/frontend/src/pages/PortfolioViewer.jsx`
- `08_react_app/frontend/src/pages/BuildScenario.jsx`
- `08_react_app/frontend/src/pages/referenceMeasures.js`
- `08_react_app/frontend/src/components/KpiCard.jsx`
- `08_react_app/frontend/src/components/CaseConfiguration.jsx`
- `08_react_app/frontend/src/components/CaseConfiguration.css`
- `08_react_app/frontend/src/components/OperationsGuide.css`
- `08_react_app/frontend/src/components/operationGuideContent.js`
- `08_react_app/frontend/src/components/ChartPanel.jsx`
- `08_react_app/frontend/src/components/Select.jsx`
- `08_react_app/frontend/src/App.jsx`
- `08_react_app/frontend/src/api/client.js`
- `08_react_app/backend/routers/scenario.py`
- `08_react_app/backend/routers/portfolio.py`
- `08_react_app/backend/schemas.py`
- `07_streamlit_app/src/scenario_modeller/services/comparison_service.py`
- `07_streamlit_app/src/scenario_modeller/services/valuation_service.py`
- relevant existing tests.

Also retain the Horizon X visual design references in mind:

- `07_streamlit_app/design_decks/Horizon X Design.pdf`
- `07_streamlit_app/design_decks/Horizon X Design.pptx`

If the persistence work described in `08_react_app/Claude-Code-Scenario-Persistence-Implementation-Prompt.md` has already been implemented by the time this brief is used, integrate with the current persistence API/state rather than creating a duplicate scenario store.

If persistence has not yet been implemented, the redesigned Results page must still work with the current single in-memory `ScenarioResultContext` and must be architected so a later persisted Scenario 2 can plug in without a rewrite.

Do not modify the original Excel submission or the Streamlit application as a side effect of this task.

---

## 2. Purpose of this redesign

The existing Scenario Results page has the core analytical content, but the information hierarchy and interaction model should be brought closer to the intended Horizon X design and the interaction patterns now established in the React application.

The redesign is not primarily a colour/style refresh. It is a structural UX redesign.

The Results screen should answer three business questions in this order:

1. **What is the portfolio outcome under the selected scenario?**
2. **How does that outcome compare with the Reference portfolio, and optionally another scenario?**
3. **Which scenario changes are driving the differences?**

The page should feel like a controlled portfolio-decision workspace rather than a sequence of developer-oriented charts and raw engine parameters.

The intended visual hierarchy is:

```text
Scenario Results
    ↓
Headline KPI outcome cards
    ↓
Two side-by-side analytical plots
    ↓
Business-readable changes driving the scenario
```

The current calculations and analytical services should be preserved unless this brief explicitly requires an extension.

---

## 3. Design decisions that are already agreed and should be treated as requirements

The following decisions are **locked for this implementation** unless the current code makes one technically impossible without clarification.

### 3.1 KPI cards must align to Portfolio Viewer

The Results page should use the same four headline measures and general card design language as Portfolio Viewer:

1. `Cumulative Production`
2. `Cumulative Cash Capex`
3. `Cumulative Post-Tax RCOP`
4. `Cumulative Post-Tax Free Cash Flow`

Do not use NPV as one of the four primary Results cards.

NPV remains an important analytical capability but should not displace the Portfolio Viewer KPI structure. If useful, it can remain available elsewhere in the page or future configuration, but the top row must match Portfolio Viewer.

### 3.2 Each KPI card requires explicit Reference comparison

Each Results KPI card must show:

- the **Primary Scenario value**;
- an explicit **Variance to Reference** call-out;
- the absolute variance;
- the percentage variance where meaningful;
- the **Reference value** itself.

The user must not need to hover a tooltip to find the Reference value.

Conceptual card structure:

```text
CUMULATIVE CASH CAPEX

$11.8bn

-$0.6bn  ·  -4.8%
VARIANCE TO REFERENCE
Reference: $12.4bn
```

The exact typography can follow existing application patterns, but the hierarchy must be obvious.

### 3.3 Primary scenario versus optional comparison scenario

The page should conceptually support:

- **Reference Portfolio** — always present, fixed analytical baseline;
- **Primary Scenario** — drives the KPI cards and variance waterfalls;
- **Comparison Scenario** — optional, intended to become more useful once multiple scenarios are persisted.

Do not ask the user to select Reference as though it were another scenario. Reference is the fixed baseline.

The KPI row always represents:

`Primary Scenario vs Reference`.

Selecting a Comparison Scenario must not turn every KPI card into an overloaded multi-scenario card.

The optional Comparison Scenario belongs mainly in the analytical profile plots.

### 3.4 Results Settings should be one right-hand popup panel

Add a single page-level button such as:

`Results settings`

This opens a right-hand modal/panel using the same interaction grammar as the existing Case Configuration / Operations Guide sheet.

The panel should use **draft state** and a single **Apply settings** action.

Changing dropdowns inside the panel must **not** immediately reconfigure the Results page. The user should be able to make several choices and apply them together.

`Cancel`, Escape, close button and backdrop dismissal should discard un-applied draft changes.

### 3.5 Two analytical plots, not three

Use **two plots side by side** on desktop.

Do not use the Portfolio Viewer three-panel layout on Scenario Results.

Reason: Results is primarily a comparison/explanation screen. Two wider plots are better for showing Reference + Scenario 1 + Scenario 2 and for readable waterfall breakdowns.

On smaller widths, stack the two plots responsively.

### 3.6 Each plot has Profile and Variance modes

Each of the two chart panels should have a directly accessible view toggle:

`Profile | Variance`

Do not put this toggle inside Results Settings.

The distinction is:

- **Results settings** = what the user is analysing;
- **Profile / Variance** = how the user wants to view that selected analysis right now.

Users should be able to switch between Profile and Variance repeatedly without reopening the settings panel.

### 3.7 Variance mode must support breakdown dimension

For a waterfall, the user must select a breakdown category using the same dimensional vocabulary as Portfolio Viewer.

Visible options should be consistent with Portfolio Viewer:

- Plan Type
- Group Entity
- Region
- Country
- Case

Use the same stable internal values where possible:

- `plan_type`
- `group_entity`
- `region`
- `country`
- `case_name`

The existing backend also knows about Segment, but do not add extra visible dimensions merely because they are technically available unless the current Portfolio Viewer UI has been changed to expose them.

### 3.8 Scenario changes must be business-readable

Replace the existing developer-facing table:

`Case | Operation | Param1 | Param2 | Param3 | Param4 | Param5`

with a business-facing section named:

**Changes driving this scenario**

The table should describe operations using the same business language and labelled inputs already used by Build a Scenario / the operation guide.

Example:

```text
Case A | Schedule shift | +1 year          | -$120m
Case B | Farm Down      | -25% equity      | +$340m
Case C | Excluded       | Removed from run | -42 mmboe
```

Do not show generic Param1–Param5 columns in the final Results UI.

### 3.9 Changes table impact is configurable

The Results Settings panel should allow the user to choose:

- **Impact metric**;
- **Impact period / time horizon**.

The table’s final column then changes to show the case-level impact for the selected measure and period.

Reuse the period semantics already established in `referenceMeasures.js` wherever possible rather than inventing a second incompatible period model.

### 3.10 One Apply button for all page configuration

Scenario selection, analysis period, plot metrics, waterfall breakdowns and changes-table impact settings should be staged inside the Results Settings panel and applied together with one action.

Do not fire multiple analytical requests while the user is still editing draft settings.

---

## 4. Desired page structure

The finished page should approximately follow this hierarchy:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Scenario Results                                        [Results settings] │
│ Primary: Capital Constrained                                               │
│ Comparing with: High Production (if selected)                             │
│ Reference portfolio is the fixed baseline                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [ KPI 1 ]     [ KPI 2 ]     [ KPI 3 ]     [ KPI 4 ]                     │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐         │
│  │ Plot 1 metric              │   │ Plot 2 metric              │         │
│  │ [Profile] [Variance]       │   │ [Profile] [Variance]       │         │
│  │                             │   │                             │         │
│  │       analytical chart      │   │       analytical chart      │         │
│  │                             │   │                             │         │
│  └─────────────────────────────┘   └─────────────────────────────┘         │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Changes driving this scenario                                              │
│ Impact basis: Post-Tax Cash Flow · Total 2026–2040                         │
│                                                                            │
│ Case | Change | Detail | Impact                                            │
│ ...                                                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

Keep the existing overall application shell, navigation and BP-inspired theme.

Do not introduce a completely different visual language on this page.

---

## 5. Results Settings panel — detailed specification

Create a component such as:

`frontend/src/components/ResultsSettingsPanel.jsx`

and an associated CSS file if that is cleaner than inline styling.

Prefer reusing the existing right-sheet `<dialog>` pattern rather than creating a second modal framework.

The existing `CaseConfiguration.jsx` demonstrates the desired behaviours:

- native `<dialog>`;
- `showModal()`;
- body scroll lock;
- opener focus restoration;
- Escape handling;
- backdrop dismissal;
- close button;
- keyboard focus containment;
- draft form state;
- footer with Cancel / Apply.

The panel should look related to Case Configuration and Operations Guide but contain Results-specific sections.

### 5.1 Proposed settings model

A reasonable applied settings object is:

```js
{
  primaryScenarioId: 'current',
  comparisonScenarioId: null,
  yearFrom: 2026,
  yearTo: 2040,
  plot1: {
    metric: 'Total Production (mboed)',
    breakdown: 'case_name',
  },
  plot2: {
    metric: 'Post-Tax Cash Flow',
    breakdown: 'region',
  },
  changes: {
    metric: 'Post-Tax Cash Flow',
    period: 'full',
  },
}
```

Do not store `Profile` / `Variance` mode in this settings object unless there is a strong code reason. Those are direct local view states on each chart.

### 5.2 Panel sections

Use clear grouped sections.

#### Scenario comparison

```text
Primary scenario
[ Capital Constrained ▼ ]

Comparison scenario
[ None ▼ ]
```

If scenario persistence is not yet available:

- Primary scenario should represent the current successful scenario run;
- Comparison Scenario should be disabled or show a restrained message such as `Available when saved scenarios are available`;
- do not fake or hard-code `Scenario 2` data.

If persistence is available:

- populate selectors from the saved scenario repository/API;
- do not allow the same scenario in both selectors;
- selecting a scenario definition is not enough to pretend results exist: use the current persistence/result architecture correctly;
- if persisted scenarios must be rerun to generate current outputs, preserve that contract rather than inventing historical results.

The panel should be designed so the multi-scenario capability can mature without replacing its structure later.

#### Analysis period

```text
From [2026 ▼]
To   [2040 ▼]
```

Validate `2026 <= yearFrom <= yearTo <= 2040`.

This page-wide horizon drives:

- KPI totals;
- profile lines;
- waterfalls.

The changes table may use its own period selector because its impact horizon is an analytical lens, not necessarily identical to the overall page horizon.

#### Plot 1

```text
Metric
[ Total Production (mboed) ▼ ]

Variance breakdown
[ Case ▼ ]
```

#### Plot 2

```text
Metric
[ Post-Tax Cash Flow ▼ ]

Variance breakdown
[ Region ▼ ]
```

Metrics should come from the current application metric catalogue rather than a hard-coded miniature list, but exclude synthetic measures that do not make sense as annual profiles.

In particular, **Post-tax NPV is not an annual profile metric**. Do not put NPV in a line-profile selector unless a separate meaningful visual treatment is designed.

#### Scenario changes

```text
Impact metric
[ Post-Tax Cash Flow ▼ ]

Impact period
[ Total 2026–2040 ▼ ]
```

Reuse `REFERENCE_PERIODS` semantics from `referenceMeasures.js` where appropriate:

- Total 2026–2040
- Total 2026–2030
- Average 2026–2030
- individual years 2026–2040

If NPV is offered as an impact metric, enforce its existing rule: it is a discounted period total and not an average. Reuse the existing fixed-2026, period-1 valuation service. Do not create an annual NPV profile.

### 5.3 Apply behaviour

The panel should hold a draft copy of applied settings.

Expected behaviour:

```text
Open panel
    ↓
Edit Scenario / metrics / periods / breakdowns
    ↓
No Results-page change yet
    ↓
Apply settings
    ↓
Validate
    ↓
Commit applied settings once
    ↓
Close panel
    ↓
Trigger required analytical refreshes
```

Cancel must discard the draft.

Do not update page state continuously on each select event.

---

## 6. KPI cards — exact analytical and visual requirements

The top row must align to the Portfolio Viewer measures and units.

### 6.1 Measures

Use exactly these defaults:

| Card | Source metric | Display |
| --- | --- | --- |
| Cumulative Production | `Total Production (mboed)` | cumulative `mmboe` |
| Cumulative Cash Capex | `Cash Capex` | `$bn` |
| Cumulative Post-Tax RCOP | `Post-Tax RCOP` | `$bn` |
| Cumulative Post-Tax Free Cash Flow | `Post-Tax Cash Flow` | `$bn` |

### 6.2 Production conversion

Continue the established conversion used by Portfolio Viewer for multi-year production totals:

```text
sum of mboed annual values × 0.36525 = cumulative mmboe
```

Do not apply this conversion to single-year / annual profile line values.

### 6.3 Financial display units

Headline financial totals should display in `$bn`, as Portfolio Viewer does, rather than large `$m` values.

The underlying analytical engine can remain in `$m`.

Do not mutate the engine data to achieve display units.

### 6.4 Sign convention

Results must align to Portfolio Viewer display conventions.

The analytical engine may store cash outflows as negative values. Portfolio Viewer already uses backend display transformation logic (`to_display` and `app_state.invert_metrics`) where appropriate.

Do not create a second independent list of sign inversions in React if the existing backend metadata can be reused.

For example, Cash Capex should appear as positive spend on the portfolio-facing screen if that is the current Portfolio Viewer convention.

Any KPI-delta API used by Results should calculate **display-facing Reference, Scenario and Delta consistently**.

### 6.5 Variance call-out

Each card needs an explicit lower call-out area.

Recommended structure:

```text
[headline title]
[scenario value + unit]
[optional annual average / context]
────────────────────────
[absolute delta] · [percentage delta]
VARIANCE TO REFERENCE
Reference: [reference value]
```

The exact separator can be visual rather than a literal line.

### 6.6 Do not blindly treat positive as good and negative as bad

The current generic `KpiCard` colours positive delta green and negative delta red.

That is not analytically safe for all metrics. For example, lower Capex is a negative numerical variance but is not automatically a negative business outcome.

For the new Results variance call-out:

- use neutral/default text treatment unless metric-direction semantics are explicitly defined;
- do not encode business judgement purely from mathematical sign;
- if arrows are used, treat them as directional rather than automatically favourable/unfavourable.

### 6.7 Component design

Do not break Portfolio Viewer’s existing cards merely to support Results.

Acceptable approaches include:

- extend `KpiCard` with optional props for Reference/variance display while preserving existing Portfolio Viewer rendering;
- create a small `ScenarioKpiCard` wrapper/variant that composes the same visual foundations.

Prefer reuse without making the generic component unnecessarily complex.

---

## 7. Analytical plots — two-panel design

Create two equally important chart panels on desktop.

Each plot has:

- a title/metric label;
- a compact `Profile | Variance` toggle;
- the current breakdown label when in Variance mode;
- a fixed/consistent plot height;
- loading, empty and error states.

Recommended defaults:

- Plot 1: `Total Production (mboed)`
- Plot 2: `Post-Tax Cash Flow`

Users can change both in Results Settings.

---

## 8. Profile mode

### 8.1 Purpose

Profile mode answers:

> How does the trajectory of the selected metric change over time between Reference and the selected scenario(s)?

Use a **line chart**, not the current pair of stacked case-area charts.

The page should no longer require the user to compare two separate stacked canvases visually.

### 8.2 Series

Profile mode should support up to three visible series:

1. Reference
2. Primary Scenario
3. Comparison Scenario, if selected and data is genuinely available

Conceptually:

```text
Reference          ───────────
Primary Scenario   ━━━━━━━━━━━
Comparison         ┄┄┄┄┄┄┄┄┄┄
```

Use clearly distinguishable line styling while staying within the existing theme.

Reference should remain visually recognisable and consistent across both plot panels.

### 8.3 Aggregation

For the selected metric:

- filter rows to the page-wide year range;
- aggregate across all relevant cases for each year;
- preserve Reference and scenario separately;
- apply the same portfolio-facing sign convention used elsewhere.

Do not stack by case in Profile mode.

The purpose here is trajectory comparison, not composition analysis.

### 8.4 Tooltips

Tooltips should show:

- year;
- Reference value;
- Primary Scenario value;
- Comparison Scenario value if present;
- appropriate unit.

Avoid raw source-key jargon where a clear display label exists.

### 8.5 Backend versus frontend calculation

Prefer keeping sign/display transformations and reusable analytical aggregation outside page rendering.

A clean option is a small scenario-profile comparison service/endpoint, for example conceptually:

`POST /api/scenario/profile`

Request:

```json
{
  "baseline": [...],
  "scenario": [...],
  "metric": "Cash Capex",
  "years": [2026, 2027, 2028]
}
```

Response:

```json
[
  {"year": 2026, "reference": 1200, "scenario": 1150},
  {"year": 2027, "reference": 1300, "scenario": 1210}
]
```

This is a suggested shape, not a mandate to add an endpoint if a simpler existing service can provide the same controlled result.

If aggregation remains in React, do not duplicate backend sign rules casually. Inspect current display metadata first.

---

## 9. Variance mode — true waterfall behaviour

### 9.1 Purpose

Variance mode answers:

> Which categories explain the movement from Reference to the Primary Scenario for this metric and period?

Variance mode applies to the **Primary Scenario only**.

If Comparison Scenario is selected, it remains relevant in Profile mode but does not turn a single waterfall into two competing endpoints.

The waterfall should remain:

`Reference → contributors → Primary Scenario`.

A future scenario-to-scenario waterfall can be a separate enhancement.

### 9.2 Breakdown categories

Use the plot-specific breakdown setting from Results Settings.

Supported visible dimensions:

```text
Plan Type
Group Entity
Region
Country
Case
```

### 9.3 Backend change required

The current `build_waterfall()` in `comparison_service.py` is hard-coded to Case Name.

Extend it in a controlled way to support a `group_by` argument.

Use a validated mapping such as:

```python
COL_MAP = {
    "plan_type": "Plan Type",
    "group_entity": "Group Entity",
    "region": "Region",
    "country": "Country",
    "case_name": "Case Name",
}
```

Do not accept arbitrary dataframe column names from the client.

Update the FastAPI request schema so `WaterfallRequest` includes a validated group/breakdown field.

The client should send the stable internal key, not the display label.

### 9.4 Aggregation logic

For the selected metric and years:

1. filter Reference and Scenario rows;
2. join the chosen dimension from `case_listing` by stable `ID`;
3. aggregate Reference by selected dimension;
4. aggregate Scenario by selected dimension;
5. calculate `Scenario - Reference` per dimension;
6. retain only non-trivial deltas;
7. include Reference absolute total at the start;
8. include Primary Scenario absolute total at the end;
9. ensure the contributor deltas reconcile to the endpoint difference within floating-point tolerance.

### 9.5 Display sign consistency

Apply the portfolio-facing sign convention before returning values for display.

Do not allow Cash Capex waterfall logic to show the opposite sign convention to the Cash Capex KPI card.

Keep the shared analytical service generic where possible and apply React-specific display transformation at the API boundary if necessary, so Streamlit/engine analytical signs are not silently altered.

### 9.6 This should be a real waterfall / bridge chart

The current Results implementation renders all `value` bars from zero, which is not a true bridge waterfall.

The redesigned variance view should show:

- Reference as an absolute column;
- positive and negative contributors starting from the prior cumulative level;
- Scenario as the final absolute column.

With Recharts, this can be achieved using:

- a transparent/hidden base stack plus visible delta stack; or
- a custom bar shape; or
- another clean implementation that preserves accessible tooltips and labels.

Do not call an ordinary zero-baseline bar chart a waterfall.

### 9.7 Many-contributor handling

Case breakdown can become crowded.

First implement a readable solution that does not silently lose reconciliation.

Acceptable options:

- horizontal scrolling;
- a sensible contributor limit plus an aggregated `Other` step that preserves total variance;
- a responsive approach.

Do not simply drop small contributors without representing the residual.

If a top-N rule is introduced, document and test it.

---

## 10. Changes driving this scenario — business-facing table

Replace `Applied Changes` with:

**Changes driving this scenario**

The section should include a compact statement of the active impact basis, for example:

`Impact: Post-Tax Cash Flow · Total 2026–2040`

### 10.1 Which rows to display

Show scenario decisions that materially differ from the Reference/default portfolio:

- explicitly excluded cases;
- included cases with an operation other than No Change.

Do not fill the table with hundreds of unchanged reference cases.

A shortlisted No Change case is not a change driver and should generally not appear.

### 10.2 Columns

Recommended columns:

| Column | Meaning |
| --- | --- |
| Case | Business-facing case name; retain ID where useful for traceability |
| Change | Human-readable operation/change type |
| Detail | Business-readable description of the applied parameters |
| Impact | Case-level delta for the selected impact metric/period |

### 10.3 Do not expose Param1–Param5

Use existing operation metadata to translate parameter positions into labels.

`operationGuideContent.js` already defines business labels and parameter positions.

Do not create an unrelated second operation-definition catalogue if existing metadata can be reused.

### 10.4 Human-readable examples

Examples of desired display treatment:

```text
Delay
Change: Schedule shift
Detail: +2 years
```

```text
Farm Down (Dilution)
Change: Farm Down
Detail: -25% equity · 2028–2035 · Proceeds $20m in 2028
```

```text
Production Change %
Change: Production adjustment
Detail: +10% · 2028–2030
```

```text
Excluded
Change: Excluded
Detail: Removed from scenario
```

These examples express the intended UX; derive exact labels from the current operation definitions and avoid contradicting engine behaviour.

### 10.5 Internal versus display operation names

The current backend maps user-facing operation names to internal engine keys such as `NoChange`, `Increase`, `Dilution`, `ProdnAdj`, etc.

Do not assume `scenarioResult.instructions` currently contains the same labels the user originally chose.

Inspect the active response contract.

If needed, introduce a tested translation helper from engine key to existing user-facing operation metadata, or preserve/add display metadata in the API without breaking engine keys.

Do not change stable analytical operation keys merely for presentation.

---

## 11. Impact metric calculation for the changes table

The Impact column should be analytical, not decorative.

For a chosen impact metric and period, the case-level impact is:

`Scenario case value - Reference case value`

using the selected period and display convention.

Examples:

- excluded case: scenario contribution is zero, so impact is `0 - Reference`;
- modified case: impact is modified case result less baseline case result;
- unchanged case: impact should be approximately zero and is not normally shown.

### 11.1 Prefer reusable backend logic

Add or reuse a comparison-service function for per-case impact rather than writing one-off loops inside `ScenarioResults.jsx`.

A suitable service concept is:

```python
scenario_impact_by_case(
    baseline,
    scenario,
    case_listing,
    metric,
    years,
    discount_rate=8.0,
)
```

A FastAPI endpoint could be conceptually:

`POST /api/scenario/impact`

returning:

```json
[
  {
    "id": 123,
    "case": "Example A",
    "baseline": 450.0,
    "scenario": 330.0,
    "delta": -120.0
  }
]
```

Use a different name/shape if repository conventions support something cleaner.

### 11.2 NPV as impact metric

NPV is optional but useful if implemented safely.

If offered:

- use `valuation_service.npv_by_case()`;
- retain fixed 2026 discount origin;
- default rate 8% unless current scenario metadata says otherwise;
- do not sum an invented annual NPV row;
- do not allow Average period for NPV.

If NPV support would materially expand scope, implement profile metrics first and document NPV as a follow-on rather than duplicating valuation logic.

### 11.3 Impact is a contribution to variance, not a causal counterfactual

The displayed case impact is the case-level difference between Scenario and Reference for that metric/period.

Do not describe it as a sophisticated marginal or causal attribution unless the engine has actually recomputed counterfactual portfolios one change at a time.

The label `Impact vs Reference` is acceptable and precise.

---

## 12. Scenario 2 / persisted scenario integration

This redesign should be ready for multiple scenarios but must not pretend persistence exists when it does not.

### 12.1 Current single-scenario mode

If only `ScenarioResultContext` exists:

- Primary Scenario = current successful run;
- Comparison Scenario = unavailable/None;
- line plots show Reference + Primary;
- KPI cards show Primary vs Reference;
- waterfalls show Reference to Primary;
- Results Settings remains structurally ready for future comparison.

### 12.2 Once persistence is available

If saved scenarios exist, inspect the persistence implementation before integrating.

A saved scenario definition and a current analytical result are not necessarily the same thing.

Do not assume that because a scenario has been saved, an old result snapshot should be treated as current.

The persistence design expects scenarios to be reloadable/editable definitions and rerunnable against current reference data.

The Results comparison flow must therefore use whatever explicit run/current-result semantics the persistence feature establishes.

Do not create a second hidden execution model only for Scenario 2.

### 12.3 Comparison plot semantics

With a valid Comparison Scenario result:

- Profile mode shows Reference, Primary and Comparison;
- KPI cards remain Primary vs Reference;
- Variance waterfall remains Reference → Primary;
- Changes table remains the Primary Scenario’s changes.

This keeps the screen readable and gives Primary Scenario a clear analytical role.

---

## 13. Page header and actions

Recommended header treatment:

```text
Scenario Results                                      [Results settings]
Primary: Capital Constrained
Comparison: High Production      (only if selected)
Reference portfolio is the fixed comparison baseline
```

If persistence has landed and edit/save actions already exist, integrate them coherently rather than duplicating buttons.

Potential actions may eventually include:

- Edit Scenario
- Save / Save As
- Results settings

But this redesign task should not rebuild persistence.

The Results Settings action is the required new page-level control.

---

## 14. Remove/rework current Results elements

The following current behaviours should be replaced or reorganised.

### Remove the standalone grey year-range strip

Year selection moves into Results Settings.

Do not leave duplicate year controls on the page.

### Replace the two stacked production area charts

Use the two configurable Profile/Variance panels described above.

### Remove the separate page-wide waterfall panel

Waterfall becomes the Variance mode of either analytical plot.

### Replace the `Applied Changes` Param1–Param5 table

Use the business-facing `Changes driving this scenario` table.

### Keep warnings/diagnostics, but reduce their visual dominance

Preserve current behaviour where a failed latest run can leave the previous successful result visible and labelled as such.

Calculation diagnostics should remain accessible, for example in a compact `<details>` section or warning call-out, but should not dominate the normal executive Results layout.

---

## 15. Reuse existing application interaction patterns

Do not build a new UI framework.

Reuse:

- `Select.jsx` dropdown styling;
- BP theme values in `theme.js` / CSS variables;
- existing panel/dialog accessibility behaviour;
- existing panel footer patterns;
- existing responsive card layout conventions;
- existing Portfolio Viewer metric/dimension terminology;
- `referenceMeasures.js` period definitions where suitable;
- existing operation metadata.

The page should look like it belongs to the same application.

---

## 16. Accessibility requirements

The new panel and controls should meet the standard already established by Case Configuration.

At minimum:

- Results Settings button has a clear accessible name;
- dialog uses `aria-labelledby`;
- Escape closes and discards draft;
- close button has an accessible label;
- focus returns to opener;
- keyboard focus stays within the modal while open;
- backdrop dismissal works consistently if retained;
- Profile/Variance controls expose selected state, e.g. `aria-pressed`;
- loading and error messages use appropriate live/status roles;
- charts are accompanied by meaningful titles and labels;
- colour is not the sole way of distinguishing Reference/Primary/Comparison if line style or labels can also help.

Do not regress the existing keyboard behaviour.

---

## 17. State management recommendation

Keep a clear distinction between:

### Applied analysis settings

The configuration currently driving the page.

### Draft settings

Temporary values held only while Results Settings is open.

### Per-plot view mode

Local exploratory state:

```js
const [plot1Mode, setPlot1Mode] = useState('profile')
const [plot2Mode, setPlot2Mode] = useState('profile')
```

Do not trigger a network request for a plot’s waterfall while that plot is in Profile mode unless caching/architecture makes it trivial.

Use effect cancellation / stale-response guards where asynchronous requests can race after Apply settings.

The current code already uses an `active` guard for valuation requests; follow similarly safe patterns.

---

## 18. Suggested component structure

Adapt this to the current code rather than creating files mechanically.

A reasonable structure is:

```text
frontend/src/
├── pages/
│   ├── ScenarioResults.jsx
│   ├── scenarioResults.js              # optional pure helpers/constants
│   └── referenceMeasures.js
│
├── components/
│   ├── ResultsSettingsPanel.jsx         # new
│   ├── ResultsSettingsPanel.css         # new if useful
│   ├── ScenarioKpiCard.jsx              # optional
│   ├── ScenarioComparisonChart.jsx      # optional
│   ├── VarianceWaterfall.jsx            # optional
│   └── ScenarioChangesTable.jsx         # optional
│
└── api/
    └── client.js
```

Backend/shared package may require:

```text
08_react_app/backend/
├── routers/scenario.py
└── schemas.py

07_streamlit_app/src/scenario_modeller/services/
└── comparison_service.py
```

Do not split into many tiny files unless the page genuinely becomes easier to test and maintain.

The objective is a focused, readable implementation.

---

## 19. API contract changes likely required

Inspect current code first, but expect at least the following analytical extensions.

### 19.1 Waterfall breakdown

Extend `WaterfallRequest` with a validated `group_by`/`breakdown` field.

Update `/api/scenario/waterfall` to pass it through.

Extend `build_waterfall()` to aggregate by the selected case dimension.

### 19.2 Display-facing comparison values

Make sure KPI/profile/waterfall/impact use consistent presentation signs.

The current Portfolio API has `to_display()` and `app_state.invert_metrics` support. Reuse that approach at the React API boundary rather than changing shared engine signs.

### 19.3 Profile comparison helper

Add a reusable endpoint/service only if required to keep aggregation/sign handling out of React.

### 19.4 Per-case impact

Add a reusable case-delta endpoint/service if that is the cleanest implementation for the changes table.

Do not create one giant endpoint that returns the entire page unless there is a compelling reason. The current application uses small analytical endpoints and the redesign can preserve that style.

---

## 20. Error/loading behaviour

The page needs graceful partial failure.

Examples:

- KPI calculation fails: show an error state in KPI area rather than crashing the entire page;
- one waterfall request fails: that plot should show a local error/retry message while the other remains usable;
- impact table request fails: retain page KPIs/charts and show a table-level error;
- Comparison Scenario unavailable: continue with Reference + Primary;
- latest scenario run failed but a previous successful result remains: preserve the current warning behaviour clearly.

Applying new Results settings should not erase the old successful display before new requests resolve unless a deliberate loading placeholder is used.

Avoid showing stale data under a new label without indicating loading.

---

## 21. Testing requirements

Add meaningful automated coverage. Do not rely only on manual visual inspection.

### 21.1 Shared/backend tests

Cover at least:

1. waterfall default Case breakdown still reconciles Reference + deltas = Scenario;
2. waterfall by `region`;
3. waterfall by `country`;
4. waterfall by `group_entity`;
5. waterfall by `plan_type`;
6. invalid breakdown key is rejected/handled safely;
7. year filtering is respected;
8. excluded case contributes the expected full Reference-to-zero delta;
9. positive and negative contributors are retained correctly;
10. display-sign handling is consistent for Cash Capex;
11. per-case impact returns Reference, Scenario and Delta correctly;
12. impact totals reconcile to overall variance for an operation-isolated synthetic scenario;
13. NPV impact, if implemented, uses the existing valuation service and fixed discount origin.

Use small synthetic frames where possible so expected answers are obvious.

### 21.2 Frontend tests

Add tests for pure helpers and UI behaviour where the existing test setup permits.

Cover at least:

1. Results Settings opens with current applied values;
2. editing draft values does not immediately change the page configuration;
3. Cancel discards draft;
4. Apply commits all settings in one action;
5. invalid year range blocks Apply and is surfaced accessibly;
6. comparison selector excludes/blocks selecting the same scenario as Primary, once multiple scenarios exist;
7. Profile/Variance toggle is independent for Plot 1 and Plot 2;
8. changing a plot from Profile to Variance requests/uses the correct breakdown;
9. KPI card renders Scenario value, Reference value, absolute delta and percentage delta;
10. four KPI cards match the Portfolio Viewer metric set;
11. changes table hides unchanged No Change cases;
12. excluded case renders business-readable `Excluded` treatment;
13. operation parameter formatting uses business labels rather than Param1–Param5;
14. impact metric/period label updates after Apply settings;
15. no-scenario state still guides user back to Build a Scenario;
16. previous-successful-result warning remains after a failed latest run.

### 21.3 Waterfall rendering helper test

If the frontend converts raw waterfall steps into hidden-base + visible-delta data, test the transformation as a pure function.

For example verify:

```text
Reference = 100
A = +20
B = -10
Scenario = 110
```

produces bridge positions that visually start each step at the prior cumulative total and ends at 110.

Do not rely on a screenshot alone to verify the mathematics.

---

## 22. Regression requirements

Do not change scenario calculation behaviour while redesigning Results.

Specifically preserve:

- scenario engine execution path;
- operation logic;
- tax calculations;
- Post-Tax RCOP and Post-Tax Cash Flow logic;
- valuation fixed-origin behaviour;
- invalid-run publication gate;
- previous-successful-result preservation;
- Build a Scenario inclusion/shortlist semantics;
- Portfolio Viewer behaviour;
- Streamlit behaviour.

Run the existing suites documented in `08_react_app/README.md` plus new tests.

From repository root:

```bash
python -m pip install -e "./07_streamlit_app[dev]"
python -m pip install -r 08_react_app/backend/requirements-dev.txt
python -m pytest 07_streamlit_app/tests 08_react_app/backend/tests -q
```

From `08_react_app/frontend`:

```bash
npm run build
```

Run relevant Node tests already documented and any new frontend tests added by this change.

Do not weaken existing tests to make the redesign pass.

---

## 23. Manual browser verification checklist

After automated tests and build, manually verify if browser access is available.

Check at minimum:

1. Run a scenario from Build a Scenario.
2. Results opens with four Portfolio Viewer-aligned KPI cards.
3. Each card visibly shows Scenario, variance to Reference and Reference value.
4. Financial units display in `$bn` at headline level.
5. Results Settings opens as a right-hand modal sheet.
6. Change several settings; verify nothing changes behind it before Apply.
7. Cancel and confirm prior applied settings are preserved.
8. Reopen, change settings, Apply; verify the page updates together.
9. Plot 1 and Plot 2 show line Profile mode.
10. Toggle only Plot 1 to Variance; Plot 2 stays Profile.
11. Change Plot 1 breakdown to Region; verify waterfall categories become regions.
12. Change Plot 2 breakdown independently.
13. Verify waterfall is a true bridge, not zero-baseline bars.
14. Verify Reference and Scenario endpoint totals reconcile.
15. Verify Changes table uses labelled business inputs rather than Param1–Param5.
16. Change impact metric and period; verify impact values and heading update.
17. Verify excluded cases are shown clearly.
18. Verify unchanged cases are not cluttering the Changes table.
19. Check narrow/mobile layout: chart panels stack and settings panel remains usable.
20. Trigger a scenario failure after a successful run and verify the previous result warning is still accurate.
21. If persisted multiple scenarios are available, select a Comparison Scenario and verify Profile mode shows Reference + Primary + Comparison while KPI cards and Variance remain Primary vs Reference.

Do not claim browser verification was completed if only tests/build were run.

---

## 24. Documentation update

Update `08_react_app/README.md` after implementation.

Document:

- new Results page hierarchy;
- KPI definitions and Reference variance treatment;
- Results Settings panel;
- two configurable analytical plots;
- Profile versus Variance behaviour;
- supported waterfall breakdown dimensions;
- Changes driving this scenario table;
- impact metric/period behaviour;
- current limitation/behaviour for Comparison Scenario if persistence is not yet available;
- any new API endpoints;
- any meaningful sign/unit treatment;
- test/build verification performed.

Do not claim multi-scenario persistence is implemented unless it actually is.

---

## 25. Non-goals for this redesign

Do not use this feature as an excuse to implement unrelated scope.

Do **not** implement unless separately requested:

- optimisation / MILP;
- full scenario persistence if it has not already been implemented;
- historical result snapshots;
- version history;
- multi-user collaboration;
- authentication;
- cloud deployment;
- a new charting library solely for visual novelty;
- a page-wide redesign of Portfolio Viewer;
- operation calculation changes;
- tax methodology changes;
- NPV methodology changes;
- price operations;
- broad Streamlit refactoring.

---

## 26. Acceptance criteria / definition of done

The redesign is complete when all of the following are true.

### Header and settings

- Scenario Results has a clear `Results settings` action.
- Settings open in the existing right-hand sheet style.
- Settings use draft state and one Apply action.
- Cancel/Escape/close discard draft changes.
- Analysis year range is configured in the panel rather than a standalone page strip.

### KPIs

- Four KPI cards align to Portfolio Viewer: Production, Cash Capex, Post-Tax RCOP, Post-Tax FCF.
- Each shows Primary Scenario value.
- Each shows absolute variance to Reference.
- Each shows percentage variance where valid.
- Each visibly shows the Reference value.
- Production uses cumulative mmboe for multi-year headline totals.
- Financial headline values use `$bn`.
- Cash-outflow display signs are consistent with Portfolio Viewer.
- Variance colouring does not imply unsupported good/bad judgement from sign alone.

### Plots

- Exactly two main analytical panels are used on desktop.
- Each plot metric is configurable through Results Settings.
- Each plot has an independent Profile/Variance toggle on the page.
- Profile uses line comparison of Reference and Primary, plus Comparison if available.
- Variance uses a true Reference-to-Primary bridge waterfall.
- Waterfall breakdown supports Plan Type, Group Entity, Region, Country and Case.
- Plot 1 and Plot 2 breakdown settings are independent.

### Changes table

- Section is named `Changes driving this scenario`.
- Generic Param1–Param5 columns are gone.
- Modified/excluded cases are shown in business language.
- No Change cases do not clutter the table.
- Impact metric is configurable.
- Impact period is configurable.
- Impact is calculated as case-level Scenario versus Reference difference for the chosen basis.

### Multiple scenario readiness

- Primary Scenario is explicit.
- Comparison Scenario is optional.
- KPI cards and waterfalls remain Primary vs Reference.
- Profile charts can show Comparison when genuine data exists.
- If persistence is not yet available, the UI handles that honestly rather than faking Scenario 2.

### Quality

- Existing engine/calculation behaviour is unchanged.
- New analytical helpers have tests.
- Existing backend/shared tests pass.
- Frontend build passes.
- README is updated.
- Any manual browser checks are reported accurately.

---

## 27. Working approach for the coding agent

Before coding, provide a concise implementation plan covering:

1. current Results state/data flow found in the repository;
2. current Portfolio Viewer patterns that will be reused;
3. whether scenario persistence is already present;
4. files expected to change;
5. backend analytical extensions needed, especially waterfall breakdown and case impact;
6. how display sign/unit consistency will be preserved;
7. how Results Settings draft/apply state will work;
8. testing plan.

Then implement in focused stages.

Recommended sequence:

1. Add/test pure analytical backend changes for waterfall breakdown and impact.
2. Add any API/client functions.
3. Add pure frontend helpers and tests.
4. Build Results Settings panel and applied/draft state.
5. Build KPI row.
6. Build reusable Profile/Variance chart panel.
7. Replace Applied Changes table.
8. Integrate optional comparison-scenario path if available.
9. Run regression tests/build.
10. Update README.
11. Summarise exact files changed and verification results.

At completion, report:

- files changed;
- key UX changes;
- API/service changes;
- testing performed and results;
- current Comparison Scenario behaviour;
- any remaining manual checks or deliberately deferred items.

Do not describe unimplemented future persistence or comparison capability as complete.

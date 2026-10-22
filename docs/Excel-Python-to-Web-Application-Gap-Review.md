# Excel Python to Streamlit and React: implementation gap review

**Repository:** `dandeatsdan/portfolio_application`  
**Reviewed:** 7 September 2026  
**Source snapshot:** [1a0ffe5760d9e71822c3aeac4451e33a332399c9](https://github.com/dandeatsdan/portfolio_application/tree/1a0ffe5760d9e71822c3aeac4451e33a332399c9)

## Feature implementation update — shared post-tax calculations

This section supersedes the corresponding React findings in the historical review below; it does not declare all Excel parity gaps closed.

- **G01–G03:** shared tax validation and post-tax calculation now feed React's baseline and scenario paths. A shared valuation service uses post-tax cash flow, default 8%, fixed 2026 base and period-1 discounting. Ranking includes a calculated Post-tax NPV option. The fixed-rate Excel discounted profile row is deliberately not reproduced; the API calculates NPV directly.
- **G04:** React withholds invalid candidates and retains the previous successful result, with a failed-attempt label. The active Streamlit path remains unchanged.
- **G07/G09/G10:** React now returns the normalised instruction snapshot (all five parameters), scenario ID/name/description/rationale, row timestamps, valuation assumptions and diagnostics. This does not close the broader preparation/diagnostic gaps or add durable history.
- **Still deferred:** active Streamlit financial integration, complete Excel preparation parity, multi-scenario orchestration, elapsed-run timing, price operations and production fiscal validation.

Verification: 70 Python/API tests pass; frontend build passes with a bundle-size warning. Tests include explicit expected tax values, missing/duplicate/invalid rates, repeat calculation, NoChange baseline equality, failed-publication protection and NPV reconciliation across rankings, entity summaries and creaming. Zero-capex cases are retained in creaming totals, with undefined PI sorted last. Browser acceptance remains outstanding because the environment blocked the local preview. This is not a full binary-workbook reconciliation.

## Historical main finding

The core operation library has largely been transferred. **All 12 operations in the committed Excel Python dispatch table are present in the shared web engine**, and each produced matching outputs in a targeted synthetic comparison. The substantial gaps are the surrounding financial-calculation, preparation, validation, publication, and traceability stages.

Both applications use `07_streamlit_app/src/scenario_modeller/engine/scenario_engine.py`, so changes to that shared engine can address most common gaps once. React introduces additional losses when it serialises the engine output into its API response.

This report compares executable source, including the six extracted Excel Python files, shared Python modules, active Streamlit pages, React backend, and React frontend. It does not inspect Python cells inside the binary workbook or establish that the extracted files exactly match the current workbook. It excludes VBA, Power Query, DAX, and enterprise connectivity except where needed to explain the Python boundary. No application code was changed.

## Summary of confirmed differences

**Missing** means no equivalent was found in the active path. **Partial** means some behaviour exists, but does not reproduce the complete Excel behaviour. **Different** means an alternative implementation exists and needs an explicit decision about equivalence.

| ID | Excel Python capability | Streamlit | React | Suggested priority |
| --- | --- | --- | --- | --- |
| G01 | Recalculate tax charge, cash tax, post-tax RCOP, and post-tax cash flow after operations | Missing | Missing | High |
| G02 | Generate annual discounted post-tax cash flow using the Excel period convention | Missing | Different pre-tax NPV calculation in portfolio API | High |
| G03 | Apply and validate country/year tax assumptions during execution | Missing from active path | Missing from active path | High |
| G04 | Withhold refreshed output when a run fails | Partial results can replace previous results | Partial results can replace previous results | High |
| G05 | Full case-listing preparation and validation | Partial | Same shared loader | High |
| G06 | Full profile preparation, precision treatment, and validation diagnostics | Partial | Same shared loader | High/medium |
| G07 | Clear stale operations/parameters and report instruction normalisation | Partial | Partial; direct API behaviour also differs | Medium |
| G08 | Prepare and execute S1–S5 as one coordinated batch | Active UI runs scenario 1 | Active UI submits one scenario | Medium |
| G09 | Publish enriched scenario and case metadata with every output row | Partial; metadata held separately | Partial; further fields removed by API | High/medium |
| G10 | Preserve all five operation parameters with published results | Present in engine output, but stale NoChange values possible | Removed from response; results table shows placeholders | High |
| G11 | Produce structured input, preparation, and execution summaries | Partial counts and errors | Partial counts, health, and errors | Medium |
| G12 | Record elapsed execution time and London-time start/end status | Timestamp only | Engine timestamp omitted from API | Medium |

## G01 — Post-tax calculation stage

After operations, Excel joins country/year tax assumptions and creates four additional metrics. With `U` as transformed Underlying RCOP and `F` as transformed Pre Tax Cash Flow, its rules are:

| Output metric | Excel calculation |
| --- | --- |
| `Tax Charge` | `-max(U, 0) × ETR` |
| `Cash Tax Payment` | `-max(U, 0) × CTR` |
| `Post-Tax RCOP` | `U - max(U, 0) × ETR` |
| `Post-Tax Cash Flow` | `F - matched cash-tax amount` |

The last calculation matches cash tax on `Scenario × ID × Year`. Where a cash-flow row has no matching RCOP-derived cash-tax row, Excel records it in `missing_cash_tax_matches` and applies zero cash tax. This is an existing modelling assumption, not a new recommendation.

The shared web engine returns the transformed input metrics immediately after operation execution and horizon clipping. It does not run this financial stage. A post-tax metric supplied in an input CSV would therefore not demonstrate that post-tax amounts had been correctly recalculated after an operation.

**Effect:** operations may reproduce the pre-tax transformation while failing to produce the same after-tax decision measures.

**Completion criterion:** move the financial stage into a shared service, run it after operations for both applications, and reconcile all four metrics at case/year level. Include positive, zero, and negative RCOP, changing annual rates, and unmatched cash-flow rows.

Evidence: [Excel engine][excel-engine], [shared web engine][web-engine], [React scenario API][react-scenario].

## G02 — Discounted cash flow and NPV convention

Excel generates `Discounted Post-Tax Cash Flow @ 8%` for every applicable output row:

```text
discount period = Year - 2026 + 1
discounted value = Post-Tax Cash Flow / 1.08 ** discount period
```

Thus 2026 is period 1. The downstream NPV aggregation is a DAX responsibility, but generating these annual discounted values is part of the Excel Python implementation.

Streamlit does not reproduce that calculation. Its shared portfolio service's creaming function ranks contributions and calculates cumulative totals; it does not discount cash flow.

React has NPV calculations in the portfolio API, but they use **Pre Tax Cash Flow**, a selectable discount rate, and `Year - year_from`, making the selected first year period 0. These support reference portfolio analysis; the scenario-run endpoint does not append the Excel discounted post-tax metric.

**Effect:** the same label “NPV” would conceal different tax and timing bases. Even with identical cash flows and an 8% rate, period-0 discounting gives values 8% higher than period-1 discounting over the same years. Different tax bases introduce a further difference.

**Completion criterion:** retain the Excel convention as an explicit calculation option, identify pre-/post-tax basis and valuation date in metadata, and use a shared calculation for reference and scenario comparison.

Evidence: [Excel engine][excel-engine], [Streamlit portfolio services][web-portfolio], [React portfolio API][react-portfolio].

## G03 — Tax-data validation and coverage controls

Excel's input preparation standardises tax identifiers, checks required fields, rejects incomplete key/rate records, checks ETR and CTR are between 0 and 1, and rejects duplicate `Country Key × Year` records. During execution it validates a many-to-one tax join, requires the RCOP and cash-flow source metrics, rejects missing tax rates on RCOP rows, and validates the cash-tax-to-cash-flow join as one-to-one.

A web `load_tax_rates()` function exists, but it currently checks required columns and duplicate country/year keys without the full completeness or rate-bound checks. The active Streamlit four-screen route and React startup do not load it for scenario calculations. Tax loading in an older Streamlit page is not an active financial pipeline.

**Verified example:** the web loader accepted an ETR of `1.5` in a synthetic record. Excel's range check rejects that value.

**Completion criterion:** bring tax loading, range/completeness checks, join validation, missing-rate diagnostics, and unmatched-cash-flow reporting into the common runtime when adding G01.

Evidence: [Excel input preparation][excel-inputs], [Excel engine][excel-engine], [web loaders][web-loaders], [active Streamlit builder][streamlit-builder], [React startup data][react-state].

## G04 — Failure handling and publication of results

Excel stops on an operation exception, marks the run invalid, and does not assign a new `scenario_outputs_tall`. Downstream metadata, tax, or discounting failures also prevent publication. With an existing valid output in the Python environment, that assignment pattern preserves the previous output. If no scenario results are generated, Excel marks the run invalid.

The shared web engine records an error and continues to other cases. It returns successful rows together with errors. Streamlit assigns these rows to `last_results` regardless of errors, and can show a completion message when any results exist. React returns the rows through the API and navigates to Results, where an error count is displayed. Error visibility exists; an equivalent publication gate does not.

**Verified example:** one successful NoChange case followed by an invalid negative Delay produced 405 successful rows plus one error in the web engine. Excel marked the run invalid and retained a sentinel representing its previous valid output.

**Completion criterion:** distinguish candidate results from published results. Define a run-validity contract, retain the previous successful run on failure, and offer partial diagnostic data separately if useful. Cover empty runs and cases wholly clipped outside the horizon as well as explicit exceptions.

Do not overstate the existing Excel protection: its loop silently skips cases with no source profile. The web engine improves visibility here by returning an explicit missing-profile error. That improvement should be retained.

Evidence: [Excel engine][excel-engine], [web engine][web-engine], [Streamlit builder][streamlit-builder], [React scenario API][react-scenario], [React builder][react-builder].

## G05 — Case-listing preparation and validation

| Excel behaviour | Shared web loader comparison |
| --- | --- |
| Strip whitespace and normalise blank case/hierarchy text to missing values | Text-value normalisation is not replicated. Header cleanup is present. |
| Remove records with missing `ID` **or** `Case`, and report counts | Removes invalid IDs, but does not apply the equivalent missing-case rule or report removal counts. |
| Identify duplicate IDs and duplicate `Case` values | Duplicate IDs are rejected; duplicate `Case` values are not checked. |
| Retain duplicate-record details | An exception reports duplicate IDs, but there is no equivalent diagnostic dataframe. |
| Count incomplete hierarchy rows | Missing. |
| Sort by the hierarchy/case fields deterministically | Missing; input order is retained. |
| Publish imported/retained/removed counts and business/technical status | Missing as a structured loader output. |

**Verified example:** two different IDs with the same `Case` value were accepted by the web loader. This finding concerns the full `Case` field, not an assumption that the shorter display field `Case Name` must be unique.

**Effect:** ambiguous case definitions and incomplete metadata may reach aggregation and presentation with less diagnostic information. Excel reports incomplete hierarchy as a count; it is not necessarily a blocking error there.

Evidence: [Excel input preparation][excel-inputs], [web loaders][web-loaders].

## G06 — Profile cleaning, precision, and diagnostic outputs

Both implementations require the core profile columns, convert numeric data, default invalid/missing values to zero, reset floating noise below `1e-9`, and check duplicate `ID × Metric × Year` rows. The following Excel behaviours are not fully replicated:

- Strip whitespace from `Case` and `Metric`, and treat empty strings as missing.
- Remove rows missing any of `ID`, `Case`, `Metric`, or `Year`, with a removal count.
- Round profile values to six decimal places after floating-noise handling.
- Sort by the modelling key.
- Retain duplicate-row diagnostics and report counts of values defaulted to zero and floating values reset, plus case/metric/year coverage.

The web profile loader can retain missing keys as nullable values rather than applying the same removal policy. Its duplicate check raises an exception; Excel creates diagnostic records and a validity flag. Those are different mechanisms, so the web implementation should not simply be described as lacking duplicate protection.

**Verified example:** the web loader preserved surrounding spaces in a synthetic case and metric name, and retained `1.123456789` rather than Excel's six-decimal result `1.123457`.

**Effect:** exact metric-name matching can fail, and small numerical differences may arise before any modelling operation runs.

**Completion criterion:** use a documented shared preparation contract that returns both cleaned data and diagnostics. Decide explicitly whether to retain Excel's rounding convention; do not silently apply a new precision policy.

Evidence: [Excel input preparation][excel-inputs], [web loaders][web-loaders].

## G07 — Instruction normalisation and stale-parameter clearing

Excel prepares one canonical instruction table. It removes workbook placeholder rows, normalises inclusion, maps operation labels, defaults included blank/invalid operations to NoChange, clears operations on excluded rows, coerces all five parameters, and clears parameters on excluded and NoChange rows. It counts the corrections by scenario.

The web applications implement parts of this behaviour, but there is no equivalent shared preparation service and correction summary:

- Streamlit maps unknown labels to NoChange, but does not zero stale parameters when building NoChange instructions.
- React filters out excluded cases before submission, but retains parameters when an operation changes to NoChange. Disabling inputs does not clear their values.
- React's direct API accepts typed instructions, but an unknown operation is passed to the engine and produces an error rather than the Excel defaulting behaviour. A blank operation is not normalised by the shared engine.

**Effect:** inactive assumptions can remain in output metadata, while different entry points apply different rules. Rejecting an unknown operation may be preferable to defaulting it, but that is a deliberate change to document rather than an automatic parity claim.

Workbook-specific placeholder cleanup need not be copied literally into web forms. Its purpose—valid, unambiguous, normalised instructions—should be preserved.

Evidence: [Excel instructions][excel-instructions], [Streamlit state helpers][streamlit-state], [React scenario hook][react-hook], [React scenario API][react-scenario].

## G08 — Coordinated S1–S5 execution

Excel reads all five scenario tables, concatenates their instructions, joins scenario metadata, executes by scenario, and publishes one consolidated output with per-scenario execution summaries.

The shared web engine can process different scenario IDs in a dataframe, but the active Streamlit builder fixes `SCENARIO_ID = 1`. React's request describes one scenario and its current hook does not send a scenario ID, so the API default of `1` is used. Both active interfaces primarily hold the latest result.

**Effect:** the calculation loop is partly reusable, but the original coordinated five-scenario preparation, metadata, run-status reporting, and combined result publication are not exposed end to end.

**Completion criterion:** support a scenario collection, independent configurations and metadata, batch execution, and consolidated results if S1–S5 equivalence remains a requirement. Exactly five slots need not be retained as a software design constraint.

Evidence: [Excel instructions][excel-instructions], [Excel engine][excel-engine], [Streamlit builder][streamlit-builder], [React schemas][react-schemas], [React hook][react-hook].

## G09 — Enriched output and controlled metadata joins

Excel adds scenario name/description and case hierarchy attributes using validated many-to-one joins before publishing results. Its final output is self-describing at row level.

| Field group | Excel published output | Streamlit engine output | React scenario response rows |
| --- | --- | --- | --- |
| Scenario ID | Present | Present | Removed |
| Scenario name and description | Present on rows | Stored separately in session state | Name at response level; description not submitted by the run hook |
| ID and full Case | Present | Present | Present |
| Case Name, Group Entity, Segment, Region, Country, Country Key, Plan Type | Present | Joined separately where needed for presentation | Available partly through separate endpoints; absent from result rows |
| Operation and Param1–Param5 | Present | Present | Operation only |
| Metric, Year, Value | Present | Present | Present |
| RunDateTime | Present | Present | Removed |

Streamlit's separate metadata is useful, but is not the same as an enriched, validated output dataset. React's description and rationale fields are held in local hook state; the run payload contains scenario name and instructions, not those descriptive fields.

**Effect:** exported or independently consumed results would need additional context to reconstruct the scenario. Presentation joins are not an equivalent run-time metadata snapshot, and the original join-cardinality checks are absent from the shared engine.

**Completion criterion:** define a durable result contract containing rows, scenario metadata, normalised instructions, case metadata or a versioned reference, and run information. It need not duplicate every field on every API row, provided traceability is preserved explicitly.

Evidence: [Excel engine][excel-engine], [web engine][web-engine], [Streamlit builder][streamlit-builder], [React schemas][react-schemas], [React scenario API][react-scenario], [React hook][react-hook].

## G10 — React loses parameter evidence in the results path

The shared engine produces all five parameter columns, but the React API's `_df_to_records()` serialiser removes them. Its `ProfileRow` schema also omits them. The Results screen renders three parameter headings with literal dash placeholders and does not show parameters 4–5.

Streamlit does show all five parameters in its applied-changes table, so this is principally a React gap on top of G07's stale-parameter issue.

**Effect:** a user can see an operation name without the values that produced the result. Payment/proceeds parameters 4–5 are particularly relevant for participation operations.

**Completion criterion:** return a normalised instruction snapshot with the run and populate the applied-changes table from it, including all active parameter slots and their business labels.

Evidence: [React scenario API][react-scenario], [React schemas][react-schemas], [React Results][react-results], [Streamlit Results][streamlit-results].

## G11 — Structured model-health reporting

Excel's Python prepares business-facing status, business interpretation, and technical detail for case inputs, tax inputs, profiles, scenario preparation, and execution. Its run summary records completed/skipped scenarios, processed cases, output rows, unique cases, missing hierarchy cases, and elapsed time. The execution log distinguishes skipped scenarios and scenarios with no output.

The web implementations provide useful error lists, some row/case counts, and application status. They do not reproduce the complete structured model-health outputs or instruction-correction counts. React's health endpoint reports loaded case/profile counts; it is not equivalent to financial readiness or a valid scenario run.

**Completion criterion:** expose a common validation report with counts, severity, scope, stage, and affected records, then render it appropriately in both interfaces. Retain the existing explicit missing-profile errors.

Evidence: [Excel inputs][excel-inputs], [Excel instructions][excel-instructions], [Excel engine][excel-engine], [web engine][web-engine], [React main][react-main].

## G12 — Run timing and timestamp context

Excel's first and last Python blocks record London-time model-run status and elapsed duration. The engine separately calculates execution seconds and attaches a run timestamp to output rows.

The shared engine attaches `datetime.now().isoformat(...)` without explicit timezone information, and calculates no elapsed duration. React then drops that timestamp from result rows. Streamlit therefore has a partial timestamp implementation, while React's response loses it entirely.

**Completion criterion:** generate a shared run ID, timezone-aware start/end timestamps, and elapsed seconds. Use an explicit display timezone, preserving the distinction between engine duration and complete application workflow duration.

The Excel end-timer block contains an exception fallback followed by an unconditional access to `run_end_model`; copying that code verbatim would also copy its edge-case weakness. Preserve the intended behaviour while improving its implementation.

Evidence: [Excel timer start][timer-start], [Excel timer end][timer-end], [Excel engine][excel-engine], [web engine][web-engine], [React scenario API][react-scenario].

## Additional workflow discrepancy: Streamlit shortlist scope

This is an integration discrepancy rather than a missing operation. The active Streamlit builder displays `working_cl`, which may contain only shortlisted cases, but initialises scenario state for the full `case_listing`, with every case included by default. Its run action builds instructions using the full `case_listing` again.

Consequently, hidden non-shortlisted cases can remain included in the run, while the visible inclusion count covers only the working selection. React passes `workingCases` to its run hook, so the two interfaces can submit different case populations for an apparently similar shortlist.

The earlier README description that differences can reflect omitted shortlisted cases needs this qualification for Streamlit: the code does not necessarily omit non-shortlisted cases.

**Recommended check:** shortlist one case from a fresh session and inspect the exact submitted IDs. Make the intended baseline/scenario scope explicit, and align displayed counts, instructions, and results. This finding is based on source tracing; browser interaction was not run.

Evidence: [Streamlit builder][streamlit-builder], [Streamlit state helpers][streamlit-state], [React builder][react-builder], [React hook][react-hook].

## What has already been replicated

The dispatch keys in both committed libraries are `NoChange`, `Delay`, `Accelerate`, `Increase`, `Dilution`, `TruncateBefore`, `TruncateAfter`, `ProdnAdj`, `CostAdjOpex`, `CostAdjCapex`, `CapexAbsolute`, and `OpexAbsolute`.

The transferred functionality includes timing penalties, acceleration funding, participation payments/proceeds, truncation, production-related financial changes, percentage cost changes, and absolute cost/capital changes. The two libraries use different Python function names for absolute OPEX adjustment, but the same `OpexAbsolute` dispatch key. Both retain baseline-copy transformations and the 2026–2040 horizon.

Source comparison found mostly type annotations, shorter expressions, variable renaming, and error-message edits within these functions. A defensive column check added to production adjustment does not establish a missing financial-driver calculation: the preceding reindex already creates the expected driver columns.

**Price correction:** neither committed dispatch table contains a price operation. The earlier statement that this was an Excel-to-web migration gap was not supported by the current source. Commodity-price modelling, chance-of-success controls, optimisation, and enterprise authentication are not counted as missing Excel Python capabilities in this review.

Evidence: [Excel operations][excel-operations], [shared operations][web-operations].

## Verification performed and limits

| Check | Result |
| --- | --- |
| Source inspection of six Excel Python blocks and web calculation/integration paths | Completed against the pinned commit. |
| One synthetic comparison per operation, including delay penalty, acceleration funding, participation cash effects, and absolute adjustments | All 12 produced matching output dataframes for the selected examples. |
| Synthetic NoChange run with RCOP 100, cash flow 100, ETR 30%, CTR 20% | Excel generated tax charge −30, cash tax −20, post-tax RCOP 70, post-tax cash flow 80, and 2026 discounted post-tax cash flow 74.074074. The web engine generated none of these additional metrics. |
| One valid case followed by an invalid Delay | Confirmed partial output in web engine versus withheld publication in Excel Python. |
| Duplicate full Case values under different IDs | Accepted by web case loader. |
| ETR 1.5 | Accepted by web tax loader. |
| Whitespace and value-precision example | Web retained whitespace and more than six decimal places. |

These were isolated Python checks with synthetic data, not workbook execution, a browser test, or full regression/business validation. They support the specific findings above; they do not prove every operation equivalent for all edge cases. The existing committed web tests concentrate on loaders, NoChange, and Delay. Broader parity tests should accompany any completion work.

## Suggested implementation order

1. **Protect interpretation:** align case inclusion, prevent failed/partial runs from becoming published results, and preserve a normalised instruction snapshot through the API.
2. **Restore financial equivalence:** complete tax loading/validation, post-tax calculations, and the explicit Excel discounting convention in shared services.
3. **Restore preparation and traceability:** align text/key cleaning, precision policy, metadata joins, and structured diagnostics.
4. **Extend workflow:** expose multiple scenarios and full run metadata where required.
5. **Demonstrate equivalence:** reconcile clean baseline and transformed cases across preparation, pre-tax output, post-tax output, discounting, and failure behaviour before describing the applications as equivalent.

The 12 operation functions should be reused, with focused regression checks. The main engineering work lies in completing the shared execution pipeline and connecting its results consistently to both interfaces.

## Pending README correction

The three README replacements were pushed in the reviewed commit. A subsequent attempt to correct the root README's price-operation sentence was rejected by automatic approval review because it treated that as a new, unapproved change to `main`. No correction commit was made.

Suggested replacement sentence:

> The committed Excel Python library includes timing, participation, truncation, production, cost, and capital operations, with financial calculations and embedded validation.

[excel-inputs]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/01_excel_application/04_python/002_dataframe_setup.py
[excel-instructions]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/01_excel_application/04_python/003_scenario_instructions.py
[excel-operations]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/01_excel_application/04_python/004_operations_library.py
[excel-engine]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/01_excel_application/04_python/005_model_engine.py
[timer-start]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/01_excel_application/04_python/001_init_timer_start.py
[timer-end]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/01_excel_application/04_python/006_timer_end.py
[web-loaders]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/07_streamlit_app/src/scenario_modeller/data/loaders.py
[web-engine]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/07_streamlit_app/src/scenario_modeller/engine/scenario_engine.py
[web-operations]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/07_streamlit_app/src/scenario_modeller/engine/operations.py
[web-portfolio]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/07_streamlit_app/src/scenario_modeller/services/portfolio_service.py
[streamlit-state]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/07_streamlit_app/src/scenario_modeller/ui/state.py
[streamlit-builder]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/07_streamlit_app/app_pages/03_build_scenario.py
[streamlit-results]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/07_streamlit_app/app_pages/04_scenario_results.py
[react-main]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/backend/main.py
[react-state]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/backend/state.py
[react-scenario]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/backend/routers/scenario.py
[react-portfolio]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/backend/routers/portfolio.py
[react-schemas]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/backend/schemas.py
[react-hook]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/frontend/src/hooks/useScenario.js
[react-builder]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/frontend/src/pages/BuildScenario.jsx
[react-results]: https://github.com/dandeatsdan/portfolio_application/blob/1a0ffe5760d9e71822c3aeac4451e33a332399c9/08_react_app/frontend/src/pages/ScenarioResults.jsx

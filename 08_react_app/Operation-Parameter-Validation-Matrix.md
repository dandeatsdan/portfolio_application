# Operation parameter validation matrix

Review date: 10 September 2026. Status: agreed rules implemented in React/FastAPI on `feature-operations-input-handling`. The current-behaviour columns below describe the pre-change review baseline.

This document scopes the parameter-validation work that precedes scenario persistence, the Results redesign and portfolio optimisation. It covers all 12 selectable operations and every active Param1–Param5 position.

**Confirmed** means supported by the inspected metadata or executable code; it does not mean the entire web implementation has been business validated. **Proposed** means a new validation or presentation rule. **Decision** identifies behaviour requiring agreement before implementation.

## Evidence and scope

The review used:

- [Project guidance](../CLAUDE.md), including the source-of-truth hierarchy and 2026–2040 horizon.
- [Original operation metadata](../01_excel_application/00_sanitised_datasets/005_operations_library.csv) and [sample operation metadata](../07_streamlit_app/data/sample/005_operations_library.csv). These files matched in this review. They establish labels, positions and requiredness, but do not define every accepted range.
- [Original instruction preparation](../01_excel_application/04_python/003_scenario_instructions.py) and [original Python operations](../01_excel_application/04_python/004_operations_library.py).
- [Shared Python operations](../07_streamlit_app/src/scenario_modeller/engine/operations.py), [engine orchestration](../07_streamlit_app/src/scenario_modeller/engine/scenario_engine.py) and [React execution service](../07_streamlit_app/src/scenario_modeller/services/scenario_service.py).
- [Frontend operation mapping](frontend/src/hooks/scenarioInstructions.js), [current editor validation](frontend/src/components/caseConfigUtils.js), [configuration panel](frontend/src/components/CaseConfiguration.jsx) and [configuration tests](frontend/src/components/caseConfiguration.test.js).
- [Frontend guide content](frontend/src/components/operationGuideData.js), which records its derivation from the operations PDF and its checks against metadata/code; [API schemas](backend/schemas.py).

The [original PDF guide](../04_user_guides/operations_user_guide.pdf) was not independently extracted in this review because a PDF reader was unavailable locally. Guide observations below use the existing frontend transcription. Workbook controls and stakeholder-validation evidence have not been independently audited here. The original and shared Python functions were inspected for the parameter behaviours described below; this is not a complete numerical parity test.

## Common input contract

| Topic | Confirmed current behaviour | Proposed validation contract |
| --- | --- | --- |
| Calendar year | The model horizon is 2026–2040. Some fields enforce this, others accept arbitrary integers. | An explicitly supplied calendar year must be an integer from 2026 through 2040. Preserve the optional-bound zero sentinel described below. This extends validation for truncation and effective-period fields. |
| Year shift | Delay/Accelerate accept non-negative whole numbers. A shift is a duration, not a calendar year. | Keep integer ≥ 0. Handle extreme shifts under D1 rather than applying the calendar-year bounds to durations. |
| Finite numeric values | Editor and API reject non-finite numbers. API parameters are floats and default to zero. | Keep finite-number checks. Validate before any integer conversion; never silently round a year. Very large finite inputs can still overflow calculations: reject non-finite derived outputs rather than inventing business caps. |
| Required values | Metadata/editor require explicit input. API defaults can make an omitted required value indistinguishable from a deliberate zero. | Agreed D6: enforce required inputs in the panel and backend while preserving meaningful explicit zeros. Distinguish omission from zero before applying API defaults; document compatibility for legacy payloads. |
| Optional effective bounds | Blank editor values serialize to zero. Zero selects an operation-specific default. | Show blank as “Use default”; retain zero compatibility in the engine-facing contract. Resolve defaults before checking start ≤ end. |
| Optional amount/year pairs | Editor requires both a non-zero amount and a valid year when either is active. Both blank/zero means unused. Some Python helpers silently ignore incomplete pairs. | Reject incomplete pairs consistently in the editor and React backend. A year alone is invalid; a zero amount with an active year is invalid. |
| Fractions | `0.10` means 10%; `1` means 100%. | Keep the existing representation and show an adjacent percentage interpretation. No implicit division by 100. |
| Monetary inputs | Inputs are in $m. Transaction magnitudes and signed adjustments have different semantics. | Label units and direction per operation. Do not apply a universal “positive numbers only” rule. |
| Unused positions | Editor clears positions not used by the selected operation. No Change execution clears all five. | Keep unused positions zero in generated instructions. Define a consistent backend policy for unexpected non-zero unused values rather than executing them. |
| Excluded cases | Editor retains the last applied settings; execution skips excluded cases. | Preserve settings without requiring completion of an excluded draft. Validate on re-inclusion; do not erase stored configuration just because it is excluded. |

No arbitrary maximum increase, monetary cap or decimal-place limit is established by the reviewed sources. Technical representability limits are distinct from business limits.

## 1. No Change — `NoChange`

| Parameter | Required | Accepted values / meaning |
| --- | --- | --- |
| P1–P5 | No; unused | No inputs shown. Generate five zeros; retain the included reference profile. |

Confirmed: exclusion is a separate inclusion decision. No Change does not mean exclusion. Unknown operation labels currently fall back to NoChange in the frontend instruction builder; the backend engine rejects unknown non-empty keys. Proposed: detect unknown labels before serialization so a malformed loaded configuration cannot silently become a reference case.

## 2. Delay — `Delay`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Years to delay | Yes | Integer ≥ 0; zero retains timing. No explicit maximum. | Agreed D1: warn only for partial or complete horizon clipping; do not block the shift because of clipping. |
| P2: Delay penalty ($m) | Optional, paired with P3 | Finite non-zero amount when active. Either sign currently becomes a cash outflow through `-abs(amount)`. Blank/zero with unused P3 means no penalty. | Agreed D2: require a positive amount when active. |
| P3: Penalty year | Optional, required with P2 | Booking calendar year, independent of the shift duration. Editor requires 2026–2040. | Backend must reject fractional, out-of-horizon and incomplete pairs instead of truncating/ignoring them. |
| P4–P5 | Unused | Zero. | — |

Confirmed: shift first, discard years after 2040, then apply the penalty. A missing booking-year row can be created if the shifted profile still has templates for every impacted metric. Complete clipping can make a requested penalty fail because those templates are gone.

Example: `[2, 5, 2027, 0, 0]` delays two years and books a $5m penalty in 2027.

## 3. Accelerate — `Accelerate`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Years to accelerate | Yes | Integer ≥ 0; zero retains timing. No explicit maximum. | Agreed D1: warn only for partial or complete horizon clipping; do not block the shift because of clipping. |
| P2: Funding required ($m) | Optional, paired with P3 | Finite non-zero magnitude when active; either sign becomes additional Cash Capex through `-abs(amount)`. | Agreed D2: require a positive amount when active. |
| P3: Funding year | Optional, required with P2 | Booking calendar year; editor requires an integer in 2026–2040. | Enforce this and pair completeness in the backend. |
| P4–P5 | Unused | Zero. | — |

Confirmed: shift first, discard years before 2026, then apply funding. Missing year rows can be created from surviving Cash Capex and Pre Tax Cash Flow templates. Funding need not occur in the shifted profile's existing years.

Example: `[1, 10, 2026, 0, 0]` accelerates one year and adds $10m funding in 2026.

## 4. Farm In (Increase) — `Increase`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Increase fraction | Yes | Finite ≥ 0; profile multiplier is `1 + P1`. Zero permits no scaling, including a payment-only treatment. No explicit upper cap. | Agreed D3: finite increase fraction ≥ 0, with no upper business cap. |
| P2: Effective start year | Optional | Blank/zero defaults to the first year in this case's profile. | Explicit non-zero value must be an integer in 2026–2040. |
| P3: Effective end year | Optional | Blank/zero defaults to the last year in this case's profile. Effective start must be ≤ effective end; bounds are inclusive. | Check ordering after defaults, including when only one bound is supplied. |
| P4: Acquisition payment ($m) | Optional, paired with P5 | Finite non-zero magnitude when active; either sign creates a cash outflow through `-abs(amount)`. | Agreed D2: require a positive amount when active; enforce pair validation in the backend. |
| P5: Payment year | Optional, required with P4 | Editor requires integer 2026–2040. Does not have to fall inside the scaling period. | Enforce calendar-year validation before conversion in the backend. |

Confirmed: a 10% increase means 10% relative to the existing profile, not adding ten ownership percentage points. A missing payment-year/metric row can be created from the original case template. The payment affects Cash Capex and Pre Tax Cash Flow. Frontend guide notes record a discrepancy with the PDF transaction summary; preserve the inspected Python treatment.

Example: `[0.10, 2028, 2030, 20, 2027]` increases the profile by 10% in 2028–2030 and books a $20m acquisition payment in 2027.

## 5. Farm Down (Dilution) — `Dilution`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Dilution fraction | Yes | Finite from 0 to 1 inclusive. Below 1, multiplier is `1 - P1`. At 1, rows in the selected period are removed. | Preserve the full 0–1 range, including complete dilution. |
| P2: Effective start year | Optional | Blank/zero defaults to the first case-profile year. | Explicit non-zero value must be an integer in 2026–2040. |
| P3: Effective end year | Optional | Blank/zero defaults to the last case-profile year. Inclusive; resolved start ≤ resolved end. | Validate resolved ordering in the editor as well as backend. |
| P4: Disposal proceeds ($m) | Optional, paired with P5 | Finite non-zero magnitude when active; either sign becomes an inflow through `abs(amount)`. | Agreed D2: require a positive amount when active; enforce pair validation in the backend. |
| P5: Proceeds year | Optional, required with P4 | Editor requires integer 2026–2040. Can be outside the dilution period. | Reject invalid calendar years in backend before conversion. |

Confirmed: proceeds affect Cash Flow from Sale of Operations and Pre Tax Cash Flow. Original-profile templates can create proceeds rows even after 100% dilution removes the affected profile rows. Complete dilution and exclusion are therefore not interchangeable.

Example: `[0.25, 2028, 2030, 15, 2027]` removes 25% of the profile in 2028–2030 and books $15m proceeds in 2027.

## 6. Truncate Before — `TruncateBefore`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Retain profile from year | Yes | Retain rows whose year is ≥ P1. Editor currently accepts any non-zero integer; Python converts to integer without a horizon check. | Require integer 2026–2040; reject `235`, `0`, `2041` and fractional years. |
| P2–P5 | Unused | Zero. | — |

Example: `[2030, 0, 0, 0, 0]` retains 2030 and later years. An in-horizon cutoff can still remove all rows from a short case profile; the agreed treatment is a warning only, rather than treating an empty case as an invalid calendar year.

## 7. Truncate After — `TruncateAfter`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Retain profile until year | Yes | Retain rows whose year is ≤ P1. Editor currently accepts any non-zero integer; Python converts without a horizon check. | Require integer 2026–2040; reject `235`, `0`, `2041` and fractional years. |
| P2–P5 | Unused | Zero. | — |

Example: `[2030, 0, 0, 0, 0]` retains 2030 and earlier years. As agreed for Truncate Before, warn only if a valid cutoff removes the entire case profile.

## 8. Production Change % — `ProdnAdj`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Change fraction | Yes | Finite ≥ -1, no explicit upper cap. Zero is valid; -1 is a 100% reduction. | Agreed D3: finite fraction ≥ -1, with no upper business cap. Show percentage interpretation. |
| P2: Start year | Optional | Blank/zero defaults to 2026. | Explicit non-zero value must be integer 2026–2040. |
| P3: End year | Optional | Blank/zero defaults to 2040; inclusive; resolved start ≤ resolved end. | Check resolved bounds, not only two explicitly entered values. |
| P4–P5 | Unused | Zero. | — |

Confirmed: scales production and specified financial drivers, then propagates driver deltas into related financial measures. A -100% production change does not necessarily zero all cash flows. The Python function checks duplicate driver rows and requires each calculated target metric to exist somewhere in the selected interval; this is not complete per-year coverage validation.

Example: `[-0.10, 2028, 2030, 0, 0]` applies a 10% reduction over the inclusive period.

## 9. OPEX Change % — `CostAdjOpex`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Change fraction | Yes | Finite ≥ -1; zero is valid; no explicit upper cap. Positive means higher costs under the negative-outflow convention. | Agreed D3: finite fraction ≥ -1, with no upper business cap. Show percentage and direction. |
| P2: Start year | Optional | Blank/zero defaults to 2026. | Explicit non-zero integer 2026–2040. |
| P3: End year | Optional | Blank/zero defaults to 2040; inclusive; resolved start ≤ resolved end. | Validate resolved ordering. |
| P4–P5 | Unused | Zero. | — |

Confirmed: requires Total Cash Costs and checks its year uniqueness. It propagates cost deltas to existing affected rows. It does not create all missing related-metric rows or reject every empty selected interval.

Example: `[0.10, 2028, 2030, 0, 0]` changes a -100 cost to -110 in the selected years.

## 10. CAPEX Change % — `CostAdjCapex`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Change fraction | Yes | Finite ≥ -1; zero is valid; no explicit upper cap. Positive means higher Capex under the negative-outflow convention. | Agreed D3: finite fraction ≥ -1, with no upper business cap. Show percentage and direction. |
| P2: Start year | Optional | Blank/zero defaults to 2026. | Explicit non-zero integer 2026–2040. |
| P3: End year | Optional | Blank/zero defaults to 2040; inclusive; resolved start ≤ resolved end. | Validate resolved ordering. |
| P4–P5 | Unused | Zero. | — |

Confirmed: requires Cash Capex and checks its year uniqueness; propagates the Capex delta to existing Cash Capex and Pre Tax Cash Flow rows. Preserve its existing profile-coverage behaviour separately from input-range validation.

Example: `[-0.20, 2028, 2030, 0, 0]` changes a -100 Capex value to -80 in the selected years.

## 11. CAPEX Change $m — `CapexAbsolute`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Change in year 1 ($m) | Yes | Finite non-zero signed amount. Positive adds spending; negative reduces it. | Agreed D4: allow reductions beyond existing spending with a sign-reversal warning; do not block. |
| P2: Year 1 | Yes | Integer 2026–2040 in editor; backend checks horizon after integer conversion. | Reject fractional years before conversion. |
| P3: Change in year 2 ($m) | Optional, paired with P4 | Same signed non-zero rule. Blank/zero with unused P4 means no second adjustment. | Preserve pair completeness. |
| P4: Year 2 | Optional, required with P3 | Integer 2026–2040 in editor. | Backend whole-year check. Agreed D5: same-year adjustments accumulate; either chronological order is allowed. |
| P5 | Unused | Zero. | — |

Confirmed: both Cash Capex and Pre Tax Cash Flow must have exactly one row for each booking year; missing rows fail. Two adjustments in the same year accumulate; year 2 need not follow year 1. Metadata/editor require the first pair, but Python permits both pairs to be unused, or only the second pair to be active (D6).

Example: `[15, 2027, -10, 2028, 0]` adds $15m spending in 2027 and reduces it by $10m in 2028.

## 12. OPEX Change $m — `OpexAbsolute`

| Parameter | Required | Confirmed meaning and accepted values | Proposed additions |
| --- | --- | --- | --- |
| P1: Change in year 1 ($m) | Yes | Finite non-zero signed amount. Positive adds costs; negative reduces them. | Agreed D4: allow reductions beyond existing costs with a sign-reversal warning; do not block. |
| P2: Year 1 | Yes | Integer 2026–2040 in editor; backend checks horizon after conversion. | Reject fractional years before conversion. |
| P3: Change in year 2 ($m) | Optional, paired with P4 | Same signed non-zero rule. Blank/zero with unused P4 means unused. | Preserve pair completeness. |
| P4: Year 2 | Optional, required with P3 | Integer 2026–2040 in editor. | Backend whole-year check. Agreed D5: same-year adjustments accumulate; either chronological order is allowed. |
| P5 | Unused | Zero. | — |

Confirmed: Total Cash Costs, Underlying RCOP, Operating Cashflow and Pre Tax Cash Flow each require exactly one row for every booking year. The absolute OPEX operation's target list does not include EBITDA; do not add it as a validation side effect. Original Python names the function `apply_CashCostAbsolute`, while the shared implementation uses `apply_OpexAbsolute`; the dispatch key is `OpexAbsolute` in both. Required-first-pair discrepancy is the same as CAPEX (D6).

Example: `[-10, 2027, 5, 2028, 0]` reduces costs by $10m in 2027 and adds $5m in 2028.

## Observed validation gaps

| ID | Finding | Consequence / next action |
| --- | --- | --- |
| G1 | Truncation and effective-period years lack editor horizon checks. | `235` can pass Apply. Add explicit typed year rules instead of inferring types from label text. |
| G2 | Many Python calendar-year inputs use `int(...)` without checking integrality. | Direct API calls can silently truncate fractional years. Validate before dispatch. |
| G3 | Delay/Accelerate and farm transaction helpers silently ignore some missing/out-of-horizon booking inputs. | A run can omit a requested financial event. Bring backend checks up to the editor's pairing rules. |
| G4 | Editor checks start/end ordering only when both supplied values are truthy. | A single bound can conflict with a defaulted case-profile bound. Resolve defaults consistently. |
| G5 | All five API parameters default to zero; first absolute pair is optional in Python. | Missing required values can masquerade as deliberate inputs. Implement agreed D6. |
| G6 | Errors appear only after Apply; editing a field clears its error without validating the replacement. | Add hints and blur validation; revalidate related fields together and always validate on Apply. |
| G7 | Frontend fallback converts an unknown operation label to NoChange. | Reject invalid operation selections before save/run, especially when persistence arrives. |
| G8 | An empty transformed case is not automatically a per-case error. The execution service rejects an entirely empty portfolio result. | Distinguish intentional 100% dilution, profile removal and accidental extreme shifts (D1). |

Read-only probes of the current editor validator reproduced G1: Truncate Before/After with `235`, Farm In with bounds `235–2030`, and Production Change % with bounds `235–2030` all returned no errors. Delay with shift `235` also passed. Delay with a $5m penalty in year `235` was correctly rejected. A negative penalty amount in a valid year passed, consistent with the magnitude treatment.

These are targeted function checks, not browser or complete API verification.

## Agreed decisions

**D6 agreed:** required inputs must be supplied and validated in both the configuration panel and React backend. Preserve meaningful explicit zeros, including zero-year timing shifts and zero percentage changes where permitted. CAPEX/OPEX $m operations require the first non-zero amount and valid year pair; the second pair remains optional but must be complete when active. Detect omitted required inputs before API defaults turn them into zero, and document legacy-payload compatibility during implementation. Implemented in the React/FastAPI input-handling change. Calendar-year horizon restrictions and truncation-specific complete-removal treatment are also agreed, as recorded below.

**D5 agreed:** retain both absolute CAPEX/OPEX adjustment pairs, including when they use the same year or are entered in reverse chronological order. Same-year amounts add together. No duplicate-year or chronological-order restriction should be introduced. This preserves existing calculation behaviour.

**D4 agreed:** absolute CAPEX/OPEX reductions that exceed existing spending and reverse the cost’s sign are allowed with a warning only. Assess the combined adjustments for each case and year against Cash Capex or Total Cash Costs, respectively. The warning must not block Apply or execution solely because of the sign reversal. Implemented in the React/FastAPI input-handling change.

**D3 agreed:** increases remain uncapped, subject to finite numeric values. Production/OPEX/CAPEX percentage adjustments must be ≥ -1 (no reduction beyond 100%). Farm In remains ≥ 0; Farm Down remains between 0 and 1 inclusive, where 1 represents a 100% reduction. These ranges preserve the existing operation-specific sign conventions. These ranges are preserved by the implemented validation.

**D2 agreed:** require amounts greater than zero for active delay penalties, acceleration funding, acquisition payments and disposal proceeds. CAPEX/OPEX adjustments in $m remain signed and non-zero when active. Blank/zero optional pairs still mean no transaction. Implemented in the React/FastAPI input-handling change. Recommended handling of any existing negative transaction inputs is to flag them for correction rather than silently rewrite them.

**D1 agreed for Delay and Accelerate:** warn only when the shift clips part or all of a case profile outside 2026–2040. The user confirmed that moving a profile outside the planning horizon is reasonable. Clipping must not block Apply or introduce a shift limit. Existing numeric validity, calculation errors and the empty-portfolio result check remain separate from this clipping warning. Implemented in the React/FastAPI input-handling change. The user also agreed that a valid truncation cutoff removing an entire case profile should produce a warning only.

| ID | Decision | Recommendation | Why it needs an explicit decision |
| --- | --- | --- | --- |
| D1 | Extreme timing shifts and complete profile removal | **Agreed for Delay/Accelerate:** allow partial and complete clipping with a warning identifying the case and model horizon. No blocking restriction based on clipping. Valid truncation cutoffs removing an entire case profile also produce a warning only. | The user confirmed that a delay or acceleration can reasonably move a profile outside the horizon. |
| D2 | Negative penalty, funding, acquisition and proceeds inputs | **Agreed:** active delay penalties, acceleration funding, acquisition payments and disposal proceeds must be positive. CAPEX/OPEX adjustments in $m accept either sign. Optional unused transaction pairs retain their blank/zero convention. | The user confirmed positive transaction magnitudes and signed absolute adjustments. This changes input validation; the operation continues to determine transaction cash direction. |
| D3 | Maximum farm-in / percentage increases | **Agreed:** no upper business cap on finite increases. Percentage adjustments must be ≥ -1; Farm In ≥ 0; Farm Down from 0 to 1 inclusive. Show percentage interpretation. | The user confirmed uncapped increases and no reductions beyond 100%. Preserve each operation’s existing sign convention. |
| D4 | Absolute reductions that exceed baseline spending | **Agreed:** allow with a sign-reversal warning only. Assess combined adjustments in a year; do not block solely on this basis. | The user confirmed warning-only treatment for reductions that reverse the cost’s sign. |
| D5 | Two absolute adjustments in the same year or reverse chronological order | **Agreed:** preserve both; same-year amounts accumulate and either chronological order is allowed. Show their combined annual adjustment where useful. | The user confirmed retaining existing behaviour without additional restrictions. |
| D6 | Enforcing required values through the API | **Agreed:** enforce required fields in the panel and backend; preserve legitimate explicit zeros. Require the first CAPEX/OPEX $m amount/year pair; keep the second optional. Distinguish missing fields from zero before defaults and document legacy-payload compatibility. | The user confirmed consistent required-input validation. The implementation must preserve omission information at the request boundary. |

**Calendar-year rules agreed:** explicitly supplied calendar years must be whole numbers within 2026–2040, including truncation and effective bounds. Preserve documented blank/zero defaults for optional bounds and unused pairs. This intentionally tightens permissive input handling; it does not authorize changes to the original Excel artefacts or unrelated Streamlit behaviour.

**Truncation agreed:** when an otherwise valid cutoff removes the entire case profile, allow it with a warning only. Invalid calendar years still fail validation. The existing empty-portfolio result check remains a separate execution constraint.

## Implementation and verification plan

1. Decision review is complete: implement the agreed year rules, D1–D6 and warning-only truncation treatment recorded here.
2. Define explicit parameter types, bounds, defaults and pair relationships. Keep display labels separate from validation types and preserve stable engine keys/positions.
3. Add React-backend validation before execution, with case ID, operation and parameter-specific errors. Keep authoritative profile checks in Python. Preserve shared calculation functions and active Streamlit behaviour unless a separate change is agreed.
4. Add field hints, blur validation and linked-field revalidation. Allow temporary incomplete typing; keep Apply validation and focus the first invalid field. Do not replace user values with clamped or rounded values.
5. Reuse the validation contract for future Save/Open and optimiser hand-off. Invalid loaded configurations must remain visibly invalid rather than silently resetting to No Change.
6. Test each boundary and the real API execution path, then perform browser checks and the documented regression/build checks when code is implemented.

| Test family | Cases to cover |
| --- | --- |
| Calendar years | 2026 and 2040 accepted; 2025, 2041, 235 and 2028.5 rejected for active calendar-year inputs. Zero accepted only as the documented unused/default sentinel. |
| Timing | 0, 1, -1, 1.5; partial clipping; complete clipping; optional financial event after clipping. |
| Fractions | Farm In: 0, 0.1, -0.1, >1. Dilution: 0, 1, -0.1, 1.1. Percentage adjustments: -1, -1.01, 0, 0.1, >1. |
| Effective periods | Both omitted, one omitted, both equal, reversed, case-specific farm defaults and no overlapping profile years. |
| Monetary pairs | Both unused; amount alone; year alone; zero with active year; signed amounts; invalid booking year; two same-year adjustments. |
| Profile checks | Missing/duplicate required metric-year rows; supported creation of transaction rows; full dilution with proceeds. |
| API protection | Bypass editor with fractional years, invalid ranges, unknown keys, missing required parameters and non-finite inputs. Invalid runs preserve the last successful result. |
| State behaviour | Cancel preserves applied values; operation switch clears unused inputs; exclusion retains settings; re-inclusion validates; no-change and unshortlisting restore reference instructions. |
| UX | Partial year typing is allowed; errors appear on blur/Apply, clear when corrected, describe accepted values, and remain accessible by keyboard and screen reader. |

The accompanying React/FastAPI change implements the recorded user agreements; shared calculation rules are unchanged. The proposed columns preserve the review history. Automated verification and any remaining manual checks are recorded in the implementation report.

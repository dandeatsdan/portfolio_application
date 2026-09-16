# Portfolio optimiser — next steps

Date: 16 September 2026. Status: implemented, with the scope amendments below.

The existing timing alternatives, constraint-period columns and rename to **Advanced controls** form the baseline. Steps 1–5 are implemented. Per the subsequent user instruction, operations other than Delay and Accelerate are deferred. Additional metadata ingestion remains out of scope.

## Implementation and subsequent user decisions

- Independent **Allow Delay** and **Allow Accelerate** switches replace the combined checkbox. Advanced-control booleans use accessible switches. Limits are retained while off and omitted from the solve until enabled.
- FCF constraints support total/annual periods, signed targets, timing alternatives and scoped cases. Negative-target flexibility widens in the correct direction.
- Region, country, plan-type and case controls offer **Keep as per reference**, **Allow to be modelled** and **Exclude**. Exclusions remain shortlisted with Include false. Reference locks prohibit all changes. The legacy API's `mandatory` rule retains its original inclusion-only meaning; the UI uses the new `reference` rule.
- Absolute or reference-relative targets use server-computed previews. Annual targets use each year's own baseline. Nonpositive relative baselines require an absolute value. Reference fingerprints prevent stale previews/recommendations from silently using a changed dataset.
- Optional ordered priorities protect higher-priority flexible constraints first. Weights act within a priority; annual rules use mean normalised violation. Strict limits and adjustment caps remain binding. The existing 1% relaxation behaviour remains when priorities are off.
- **Run recommended scenario** saves a new scenario, runs it, and opens Results. **Modify recommended scenario** opens an unsaved builder copy. Both protect existing unsaved edits. Failed runs retain their saved definition for retry; stale responses cannot replace newer work.
- Desktop constraint fields remain on one compact row, using different widths for different fields. Narrow screens wrap. Reference previews appear underneath. Recommendation actions align right and the step badge is **4**.
- Steps 1–5 complete the implementation described here; the earlier baseline commits remain part of the branch history.

Validation: **267 Python/API tests**, **102 frontend tests**, and the production build passed. Existing Python deprecation warnings and the Vite bundle-size warning remain. Browser checks against the local application confirmed reference previews, plan-type reference selection, independent timing switches, FCF-constrained NPV optimisation, Modify → builder with shortlisted exclusions, cancellation of unsaved-edits replacement, and Run → saved scenario → Results. The browser-created test scenario was deleted by its captured ID. Desktop and 390px mobile layouts were checked; the mobile pane had no horizontal overflow and no browser runtime errors were reported.

## Follow-on ideas, not implemented

Case-specific delay penalties and dependencies between cases were discussed during implementation. A dependency must distinguish equal shifts, a sequencing relationship, and whether the dependent case must be included. Implement structured, validated inputs and solver rules first. A later chat interface can translate language into those visible rules for review. It must use the same calculation and validation path. Penalties, dependencies, chat entry, other operations and broader metadata are deferred.

Baseline committed as `17c6139`. Verification: all 245 Python/API tests and all 12 frontend test files passed; the production build passed with its existing bundle-size warning. Python/API tests required execution outside the sandbox because the sandboxed API test client stalled in its event loop.

## Excel exports — recorded for later implementation

User decision: record this work in the plan now; do not implement export buttons in this update. Provide real `.xlsx` workbooks at the points where a user pauses to review or share a decision:

| Location | Workbook contents |
| --- | --- |
| Optimiser recommendation | Objective and dates; reference/version metadata; advanced settings; case decisions and timing; reference/target/actual constraint checks, priorities and adjustments; per-case constraint contributions. |
| Scenario builder | Current working definition, scenario metadata/rationale, included and excluded cases, shortlist status, operations and all parameter values. Clearly identify unsaved edits. |
| Scenario Results | Reference and scenario KPI values, differences, annual metric profiles, case contributions and comparison metadata. Include the active dates and filter scope. |

Export the exact snapshot being reviewed; do not optimise, save or run implicitly. State which views are filtered and whether the workbook includes the full portfolio. Preserve numeric cell types, metric units, cash-flow sign conventions and readable sheet names; keep input assumptions distinct from calculated results. Include export time and data/scenario identity. Verify workbook totals against the application, annual units, exclusions and timing, multiple comparisons, empty data, long labels, and text beginning with Excel formula characters. Export must not change the working scenario.

## Intended experience

Keep **Objective → Constraints → Run optimisation** on the main page. Use **Advanced controls** for allowed operations, reference-case rules, portfolio mix and constraint priorities. Show a concise summary of active advanced settings on the main page; closing or hiding controls must retain their effects.

After a verified recommendation, offer two actions:

- **Run recommended scenario**: create the normal scenario definition, save it as a new scenario, run it and open Results without visiting Build a Scenario.
- **Modify recommended scenario**: open the recommendation as an unsaved working scenario in Build a Scenario, using the current hand-off.

Saving before the direct run is the implemented default because Build a Scenario already uses Save and run. Make this behaviour clear beside the action. Optimisation itself still produces a recommendation for review; it does not automatically save or run a scenario.

## 1. Allowed operations

Replace the combined timing switch with an **Allowed operations** section. Start with independent **Allow Delay** and **Allow Accelerate** toggles, each revealing its maximum whole-year shift. Both start off; turning one off preserves its entered limit but sends no alternatives for that operation. No Change remains available for cases allowed to be modelled. Cases marked Keep as per reference must use No Change.

An enabled toggle gives the optimiser permission to use an operation; it does not require the operation. Keep as per reference cases get exactly their unchanged alternative; cases allowed to be modelled get at most one alternative, including the possibility of not being selected; excluded cases get none. Allow timing to clip source rows outside 2026–2040, matching normal Delay/Accelerate, while preserving shared tax/valuation calculations. Alternatives must retain profile rows. Do not display the omitted-alternatives message.

**Deferred by the user: do not expose these operations in the current optimiser.** Future candidates include: Farm In, Farm Down, Truncate Before/After, Production Change, OPEX Change and CAPEX Change. Each needs a defined, bounded candidate set and its applicable costs/penalties before it can be enabled. For example, a production uplift cannot become a free unlimited improvement just because its operation toggle is on. Reuse the operation catalogue and validation rules; do not advertise unsupported operations as usable.

Initially choose a single operation per case, matching the current scenario definition. Combining operations on one case requires a separate scenario-contract change. Cap the alternative count, include preparation in the solve budget, report omitted alternatives and retain independent scenario replay.

Acceptance: disabled operations are never selected; enabling an operation does not force it; bounds and costs survive both hand-off paths; all operations off reproduces reference-only selection. Retain compatibility with existing timing request fields during migration.

## 2. Free Cash Flow constraints

Add **Free Cash Flow** to the constraint metric selector independently of the selected objective. Example: maximise Post-tax NPV while requiring at least $500m of FCF over 2026–2030, or at least $100m in each year.

- Use the existing derived **Post-Tax Cash Flow** metric, undiscounted and in $m. Reuse financial calculations rather than deriving FCF again in the optimiser.
- Support total and each-year periods, minimum and maximum rules, scoped cases and timing alternatives consistently with existing constraints. Default to Minimum.
- Allow signed FCF targets: negative cash flow is meaningful. Keep existing metric-specific validation for Capex and Production.
- Add FCF to constraint checks, per-case constraint-period columns and scenario rationale, with the same reconciliation as existing metrics.
- Make metric-to-unit and conversion mappings explicit. The current coefficient helper applies the production conversion to every non-Capex cumulative metric; extending its metric list alone would incorrectly scale FCF by 0.36525.
- For signed targets, relaxing a minimum must lower it and relaxing a maximum must raise it. Use an allowance based on absolute target magnitude, not multiplication that reverses direction for negative targets. Zero targets remain strict unless a later absolute allowance is explicitly supported.

Acceptance: independent small-portfolio enumeration proves that NPV maximisation respects FCF floors; test annual versus total limits, negative/zero cash flow, scoped cases, shifted tax, relaxed negative targets and scenario replay.

## 3. Consistent case controls, including plan type

User clarification: **must use means keep the reference case as is**. Use these three substantive choices everywhere case controls are offered: Region, Country, Plan type and individual Case.

| Control | Inclusion and operation behaviour | Scenario hand-off |
| --- | --- | --- |
| **Keep as per reference** | Must be included, with No Change and zero operation parameters. No timing or other operation is permitted. | Included at its original reference profile. |
| **Allow to be modelled** | The optimiser may select an allowed operation, leave the case unchanged, or omit it, subject to the objective and constraints. | Selected changes become shortlisted configurations; an omitted case becomes a shortlisted exclusion. |
| **Exclude** | Must not contribute to the recommended portfolio. | Keep the case in the case universe and add it to Shortlisted cases with Include set to false. Do not delete the case. |

Use the already loaded `plan_type` metadata for the new Plan type group in Advanced controls. Do not add a separate user-facing Require inclusion choice: it would allow changes to a case the user intended to preserve. Migrate the existing UI's mandatory controls to explicit reference locks; retain legacy API inclusion semantics for existing clients through a separate field or versioned contract rather than silently reinterpreting older requests.

Plan type overlaps geography, so it must not be treated as another Region → Country → Case level. Implemented resolution:

1. Resolve the existing Region → Country hierarchy, preserving geographic inheritance. An unset child inherits; an explicit Allow to be modelled clears its inherited geographic restriction.
2. Combine that result with the plan-type rule. Allow to be modelled adds no restriction. Keep as per reference versus Exclude is a conflict.
3. An explicit case choice overrides both dimensions, including Allow to be modelled. Otherwise conflicting requirements block the solve and identify affected cases.

Inheritance is the absence of a local choice, not a fourth case treatment. Provide a clear way to reset a child override and show its inherited/effective value. Display effective reference-locked, modelled and excluded counts, plus the source of each case's effective rule. Missing plan types appear in an explicit Unspecified group. Resolve and validate against authoritative backend metadata, and record the rules in the recommendation rationale. Hiding the section preserves settings; Clear advanced controls resets them.

Reference locking applies to the original loaded case profile, independently of which operations are globally enabled. Exclusion is represented by a retained, shortlisted case with Include false in both Modify recommended scenario and Run recommended scenario. Solver-selected omissions use that same representation.

Acceptance: the three choices at every control level; plan-type reference locks across multiple regions; missing values; conflicting group rules; explicit case overrides and reset-to-inheritance; locked cases cannot shift or change; excluded cases remain visible in the shortlist with Include false; matching frontend/backend resolution and both hand-off paths.

## 4. Targets relative to reference

Each constraint gains a target basis: **Absolute value** or **Relative to reference**, plus a higher/lower percentage for relative targets. Keep the Minimum/Maximum rule explicit; a percentage alone does not specify the inequality.

Examples using a positive reference total:

| Intent | Rule | Resolved target |
| --- | --- | --- |
| Spend at least 10% less Capex than reference | Maximum; 10% lower | Reference Capex × 0.90 |
| Permit up to 12% more Capex than reference | Maximum; 12% higher | Reference Capex × 1.12 |
| Deliver at least 12% more production | Minimum; 12% higher | Reference Production × 1.12 |

Compute the baseline server-side from the original unshifted loaded reference, using the constraint's metric, case scope, dates, units and aggregation. Inclusion/exclusion rules and chosen operations must not change that baseline. Each-year constraints resolve against each year's own reference value; total constraints resolve once for their entire period.

Show the reference value and resulting numerical limit before solving. Return both, the requested percentage, actual value and any relaxation in the result. Keep reference adjustment and permitted relaxation separate: the relative setting defines the requested target; flexibility defines how far that target may subsequently move.

Implemented first-release boundary: allow percentage-relative targets only when every relevant reference total/year is positive. For zero or negative reference values, explain the issue and require an absolute target rather than silently reversing the meaning of higher/lower. Absolute signed FCF remains supported. Explicitly validate percentage ranges by metric and rule, including 100% lower and increases above 100%.

Acceptance: total and differing annual baselines, scoped reference values, Capex expenditure signs, independent objective dates, zero/negative baseline handling, timing-invariant baselines and clear requested-versus-relaxed targets. Changes to reference data invalidate stale previews/recommendations.

## 5. Constraint priorities and weighting

Treat this as a policy for relaxing flexible constraints. Every strict constraint remains binding regardless of priority. If all original limits can be met, maximise the chosen objective normally.

Use ordered priority levels first, because “Capex must take precedence over Production” is stronger than a numerical weight. A weighted sum can trade some Capex breach for a larger Production improvement; it does not guarantee precedence.

When the original problem is proven infeasible, use bounded violation variables for flexible limits. Minimise normalised violation at the highest priority, fix that best value within a documented numerical tolerance, and proceed to lower priorities. Finally maximise NPV or the chosen objective while preserving those best priority outcomes. All passes share the existing time budget; inconclusive passes must not produce an optimal recommendation.

- Never exceed each constraint's allowed adjustment. Case rules, unchanged locks and mix bands remain strict.
- Normalise violations by the absolute requested target so $m and production units are comparable. Keep zero targets strict initially.
- For each-year rules, propose mean normalised violation across their years so a longer window does not acquire greater weight solely from more rows. Document and test this choice.
- Explicit weights within a priority level are implemented. Do not mix raw $m and production deviations, or mix constraint penalties directly into NPV with arbitrary units.
- Return original targets, achieved values, violations, priority and capped allowances. Replace the single global relaxation percentage with per-constraint outcomes when priority mode is used.

This deliberately differs from the legacy shared 1% relaxation steps. Legacy behaviour remains when priorities are not enabled; priorities start off. Put priority editing in Advanced controls, keyed by stable constraint IDs, with priority indicators beside the main constraint rows.

Acceptance: conflicting Capex/Production/FCF targets; higher-priority violations never worsen to benefit lower priorities; strict and capped limits; equal-priority normalisation; annual aggregation; signed targets; final objective tie-breaking; infeasibility and timeout reporting.

## 6. Direct recommendation actions

Both buttons consume the same verified recommendation snapshot and the same `recommendationDefinition` conversion. Preserve selected operations and every parameter, exclusions, objective, constraint settings and rationale. Require an optimal, reconciled and nonempty recommendation; changing inputs invalidates both actions.

**Modify recommended scenario** keeps the existing transition to `/build`, with no save or run. Streamline the generic confirmation; retain a warning when replacing unsaved working edits.

**Run recommended scenario** creates a new saved definition, submits its ordinary scenario instructions to the existing run endpoint, stores the normal result context and opens `/results` only after a valid run. Share the save/run orchestration with the builder. Build the payload directly from the captured definition so asynchronous reducer updates cannot run an older working scenario. Do not rerun optimisation or reinterpret the recommendation along the way.

Protect unsaved working edits before replacement, never overwrite an existing saved scenario, and prevent duplicate clicks. On save failure do not run; on run failure retain the newly saved definition and offer retry or modify. Retrying should reuse the new scenario rather than create duplicates. Discard late responses if the relevant working scenario/reference snapshot has changed.

Acceptance: direct action and modify-then-run produce identical definitions and results; valid navigation skips the builder; exclusions and timing survive; unsaved-edit cancellation preserves state; save/run failures are recoverable; repeated clicks/retries do not duplicate saves; invalid or stale recommendations cannot run.

## Delivery sequence

| Step | Deliverable | Reason |
| --- | --- | --- |
| 0 — complete | Commit current timing work, constraint-period columns and Advanced controls rename | Verified baseline: `17c6139`. |
| 1 — complete | Independent Delay/Accelerate toggles and two recommendation actions | Improve control and remove the unnecessary builder visit. |
| 2 — complete | FCF constraints with explicit metric/unit handling | Support NPV optimisation with a cash-generation floor. |
| 3 — complete | Three consistent case-control choices and plan-type reference locks | Express what the starting portfolio must retain. |
| 4 — complete | Reference-relative targets and baseline previews | Express budget/production ambitions without manual calculations. |
| 5 — complete | Ordered constraint priorities, then optional weights within levels | Add explainable trade-offs once target semantics are stable. |
| 6 — deferred | Further operations with bounded, validated parameters | Expand decisions without uncontrolled alternative growth. |

For each increment, update the domain/API contract, shared solver, UI, scenario rationale and focused regression coverage together. Verify representative end-to-end browser flows when behaviour changes. Retain independent enumeration and full scenario replay for changes to optimiser mathematics. Broader metadata expansion remains deferred.

The implemented policies are documented above: explicit case overrides resolve cross-dimension conflicts; direct run saves first; relative baselines must be positive; annual priority violations are averaged. Other operations are deferred by user request. Case-specific penalties, dependencies and chat entry remain follow-on work.

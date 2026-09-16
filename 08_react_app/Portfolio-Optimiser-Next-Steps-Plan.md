# Portfolio optimiser — next steps

Date: 16 September 2026. Status: proposed implementation plan following user feedback.

The existing timing alternatives, constraint-period columns and rename to **Advanced controls** form the baseline. The capabilities below are planned, not implemented. Additional metadata ingestion is out of scope for this work.

Baseline committed as `17c6139`. Verification: all 245 Python/API tests and all 12 frontend test files passed; the production build passed with its existing bundle-size warning. Python/API tests required execution outside the sandbox because the sandboxed API test client stalled in its event loop.

## Intended experience

Keep **Objective → Constraints → Run optimisation** on the main page. Use **Advanced controls** for allowed operations, reference-case rules, portfolio mix and constraint priorities. Show a concise summary of active advanced settings on the main page; closing or hiding controls must retain their effects.

After a verified recommendation, offer two actions:

- **Run recommended scenario**: create the normal scenario definition, save it as a new scenario, run it and open Results without visiting Build a Scenario.
- **Modify recommended scenario**: open the recommendation as an unsaved working scenario in Build a Scenario, using the current hand-off.

Saving before the direct run is the proposed default because Build a Scenario already uses Save and run. Make this behaviour clear beside the action. Optimisation itself still produces a recommendation for review; it does not automatically save or run a scenario.

## 1. Allowed operations

Replace the combined timing switch with an **Allowed operations** section. Start with independent **Allow Delay** and **Allow Accelerate** toggles, each revealing its maximum whole-year shift. Both start off; turning one off preserves its entered limit but sends no alternatives for that operation. No Change remains available for cases allowed to be modelled. Cases marked Keep as per reference must use No Change.

An enabled toggle gives the optimiser permission to use an operation; it does not require the operation. Keep as per reference cases get exactly their unchanged alternative; cases allowed to be modelled get at most one alternative, including the possibility of not being selected; excluded cases get none. Preserve the current complete-profile horizon checks and shared tax/valuation calculations.

Add other existing scenario operations incrementally: Farm In, Farm Down, Truncate Before/After, Production Change, OPEX Change and CAPEX Change. Each needs a defined, bounded candidate set and its applicable costs/penalties before it can be enabled. For example, a production uplift cannot become a free unlimited improvement just because its operation toggle is on. Reuse the operation catalogue and validation rules; do not advertise unsupported operations as usable.

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

Plan type overlaps geography, so it must not be treated as another Region → Country → Case level. Proposed resolution:

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

Proposed first-release boundary: allow percentage-relative targets only when every relevant reference total/year is positive. For zero or negative reference values, explain the issue and require an absolute target rather than silently reversing the meaning of higher/lower. Absolute signed FCF remains supported. Explicitly validate percentage ranges by metric and rule, including 100% lower and increases above 100%.

Acceptance: total and differing annual baselines, scoped reference values, Capex expenditure signs, independent objective dates, zero/negative baseline handling, timing-invariant baselines and clear requested-versus-relaxed targets. Changes to reference data invalidate stale previews/recommendations.

## 5. Constraint priorities and weighting

Treat this as a policy for relaxing flexible constraints. Every strict constraint remains binding regardless of priority. If all original limits can be met, maximise the chosen objective normally.

Recommend ordered priority levels first, because “Capex must take precedence over Production” is stronger than a numerical weight. A weighted sum can trade some Capex breach for a larger Production improvement; it does not guarantee precedence.

When the original problem is proven infeasible, use bounded violation variables for flexible limits. Minimise normalised violation at the highest priority, fix that best value within a documented numerical tolerance, and proceed to lower priorities. Finally maximise NPV or the chosen objective while preserving those best priority outcomes. All passes share the existing time budget; inconclusive passes must not produce an optimal recommendation.

- Never exceed each constraint's allowed adjustment. Case rules, unchanged locks and mix bands remain strict.
- Normalise violations by the absolute requested target so $m and production units are comparable. Keep zero targets strict initially.
- For each-year rules, propose mean normalised violation across their years so a longer window does not acquire greater weight solely from more rows. Document and test this choice.
- Optionally add explicit weights within a priority level after validating the priority model. Do not mix raw $m and production deviations, or mix constraint penalties directly into NPV with arbitrary units.
- Return original targets, achieved values, violations, priority and capped allowances. Replace the single global relaxation percentage with per-constraint outcomes when priority mode is used.

This deliberately differs from today's shared 1% relaxation steps. Preserve legacy behaviour when priorities are not enabled; choose migration/default behaviour explicitly when introducing the new mode. Put priority editing in Advanced controls, keyed by stable constraint IDs, with priority indicators beside the main constraint rows.

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
| 1 | Independent Delay/Accelerate toggles and two recommendation actions | Improve control and remove the unnecessary builder visit. |
| 2 | FCF constraints with explicit metric/unit handling | Support NPV optimisation with a cash-generation floor. |
| 3 | Three consistent case-control choices and plan-type reference locks | Express what the starting portfolio must retain. |
| 4 | Reference-relative targets and baseline previews | Express budget/production ambitions without manual calculations. |
| 5 | Ordered constraint priorities, then optional weights within levels | Add explainable trade-offs once target semantics are stable. |
| 6 | Further operations with bounded, validated parameters | Expand decisions without uncontrolled alternative growth. |

For each increment, update the domain/API contract, shared solver, UI, scenario rationale and focused regression coverage together. Verify representative end-to-end browser flows when behaviour changes. Retain independent enumeration and full scenario replay for changes to optimiser mathematics. Broader metadata expansion remains deferred.

Proposals to settle during implementation are clearly stated above: cross-dimension conflict resolution, save-before-direct-run, percentage behaviour for nonpositive references, and within-priority annual aggregation. The three case-control choices and the meaning of Keep as per reference are confirmed user requirements. None of the remaining proposals blocks committing the current baseline.

import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPTIMISER, newConstraint, optimiserRequest, recommendationDefinition, constraintUnit, referenceMix, changeMixShare, excludeRegionShares, mixTotal, runGateBlocked, countryRuleKey, effectiveCaseRule, excludedRegionRules, changeControlRules } from './optimiserHelpers.js'
import { initialScenario, scenarioReducer, serializeScenario, isDirty } from '../hooks/scenarioDefinition.js'
import { buildScenarioInstructions } from '../hooks/scenarioInstructions.js'

test('constraints start strict and reject blank, negative, invalid periods or excessive flexibility', () => {
  const c = newConstraint('a')
  assert.equal(c.flexibility_pct, 0)
  for (const update of [{}, { target: -1 }, { target: 'NaN' }, { target: 1, year_from: 2030, year_to: 2028 }, { target: 1, flexibility_pct: 16 }, { target: 1, flexibility_pct: 1.5 }, { target: 0, flexibility_pct: 1 }]) {
    assert.throws(() => optimiserRequest({ ...DEFAULT_OPTIMISER, constraints: [{ ...c, ...update }] }))
  }
  const request = optimiserRequest({ ...DEFAULT_OPTIMISER, constraints: [{ ...c, target: '100', flexibility_pct: '15' }] })
  assert.equal(request.constraints[0].target, 100)
  assert.equal(request.constraints[0].flexibility_pct, 15)
  assert.equal(constraintUnit({ metric: 'production', basis: 'total' }), 'mmboe')
  assert.equal(constraintUnit({ metric: 'production', basis: 'each_year' }), 'mboed')
})

test('recommendation hands off exclusions only, preserving default inclusion and requiring a new save', () => {
  const result = { status: 'optimal', reconciled: true, selected_case_ids: [1, 3], excluded_case_ids: [2], relaxation_pct: 0, constraint_checks: [] }
  const definition = recommendationDefinition(result, optimiserRequest(DEFAULT_OPTIMISER))
  assert.deepEqual(definition.shortlisted_case_ids, [2])
  const current = { ...initialScenario(), savedId: 'keep-saved', name: 'Original' }
  const next = scenarioReducer(current, { type: 'recommendation', definition })
  assert.equal(next.savedId, null)
  assert.ok(isDirty(next))
  assert.equal(current.savedId, 'keep-saved')
  const cases = [1, 2, 3].map(id => ({ id, case: `Case ${id}` }))
  const instructions = buildScenarioInstructions(cases, new Set(next.selectedIds), next.caseConfig)
  assert.deepEqual(instructions.map(i => i.include), [true, false, true])
  assert.equal(serializeScenario(next).case_configurations[2].include, false)
  for (const update of [{ status: 'infeasible' }, { reconciled: false }, { selected_case_ids: [] }]) assert.throws(() => recommendationDefinition({ ...result, ...update }, optimiserRequest(DEFAULT_OPTIMISER)))
})

test('recommended cases stay first during sorting and reset preserves source order within groups', async () => {
  const { sortRecommendedCases } = await import('./optimiserHelpers.js')
  const rows = [{ id: 1, selected: false, npv: 100 }, { id: 2, selected: true, npv: 5 }, { id: 3, selected: true, npv: 10 }, { id: 4, selected: false, npv: -20 }]
  assert.deepEqual(sortRecommendedCases(rows).map(r => r.id), [2, 3, 1, 4])
  assert.deepEqual(sortRecommendedCases(rows, { key: 'npv', direction: 'descending' }).map(r => r.id), [3, 2, 1, 4])
  assert.deepEqual(sortRecommendedCases(rows, { key: 'npv', direction: 'ascending' }).map(r => r.id), [2, 3, 4, 1])
  assert.deepEqual(rows.map(r => r.id), [1, 2, 3, 4])
})

test('reference mix includes unknown categories and follows period data without inventing zero-production shares', () => {
  const cases = [{ id: 1, group_entity: 'Oil', region: 'North' }, { id: 2, group_entity: 'Gas', region: '' }]
  const first = referenceMix(cases, [{ id: 1, value: 60 }, { id: 2, value: 40 }])
  assert.deepEqual(first.group_entity, { Oil: 60, Gas: 40 })
  assert.deepEqual(first.region, { North: 60, Unknown: 40 })
  assert.deepEqual(referenceMix(cases, [{ id: 1, value: 10 }, { id: 2, value: 90 }]).group_entity, { Oil: 10, Gas: 90 })
  assert.throws(() => referenceMix(cases, [{ id: 1, value: 0 }, { id: 2, value: 0 }]), /positive production/)
  assert.throws(() => referenceMix(cases, [{ id: 1, value: 1 }]), /missing or invalid/)
})

test('slider edits redistribute the remaining shares, respecting whole-region exclusions', () => {
  const shares = changeMixShare({ A: 50, B: 30, C: 20 }, 'A', 60)
  assert.deepEqual(shares, { A: 60, B: 24, C: 16 })
  const excluded = excludeRegionShares(shares, { B: 'excluded' })
  assert.equal(excluded.B, 0)
  assert.equal(mixTotal(excluded), 100)
  assert.deepEqual(changeMixShare(excluded, 'A', 70, ['B']), { A: 70, B: 0, C: 30 })
  const rounded = referenceMix([1, 2, 3].map(id => ({ id, region: String(id), group_entity: 'Oil' })), [1, 2, 3].map(id => ({ id, value: 1 })))
  assert.equal(mixTotal(rounded.region), 100)
  assert.deepEqual(excludeRegionShares({ A: 50, B: 50 }, { A: 'excluded', B: 'excluded' }), { A: 0, B: 0 })
})

test('only Advanced sends mix and region rules; switching mode keeps base constraints', () => {
  const draft = { ...DEFAULT_OPTIMISER, mode: 'mix', constraints: [{ ...newConstraint('a'), target: 100 }],
    group_entity_mix: { enabled: true, tolerance: 5, sliders: { Oil: 60, Gas: 40 } },
    region_mix: { enabled: true, tolerance: 2, sliders: { North: 100, South: 0 } },
    region_rules: { North: 'mandatory', South: 'excluded' } }
  const request = optimiserRequest(draft)
  assert.equal(request.objective, 'post_tax_npv')
  assert.deepEqual(request.mix_constraints[0], { dimension: 'group_entity', value: 'Oil', target_share_pct: 60, tolerance_pct_points: 5 })
  assert.deepEqual(request.region_rules, [{ region: 'North', rule: 'mandatory' }, { region: 'South', rule: 'excluded' }])
  const full = optimiserRequest({ ...draft, mode: 'full' })
  assert.deepEqual(full.mix_constraints, [])
  assert.deepEqual(full.region_rules, [])
  assert.deepEqual(full.constraints, request.constraints)
  assert.ok(runGateBlocked({ ...draft, region_mix: { ...draft.region_mix, sliders: { North: 0, South: 0 } } }))
  assert.ok(runGateBlocked({ ...draft, region_mix: { ...draft.region_mix, tolerance: '' } }))
})

test('recommendation preserves mix policy, region rules and actual constraint outcomes in normal rationale', () => {
  const request = { ...optimiserRequest(DEFAULT_OPTIMISER), mode: 'mix', region_rules: [{ region: 'North', rule: 'mandatory' }],
    mix_constraints: [{ dimension: 'group_entity', value: 'Oil', target_share_pct: 60, tolerance_pct_points: 5 }] }
  const definition = recommendationDefinition({ status: 'optimal', reconciled: true, selected_case_ids: [1], excluded_case_ids: [2],
    relaxation_pct: 2, constraint_checks: [{ id: 'budget', year_from: 2026, year_to: 2030, adjusted_target: 102, actual: 101, unit: '$m' }] }, request)
  assert.match(definition.rationale, /Oil, production target 60% ±5/)
  assert.match(definition.rationale, /North: Included by default/)
  assert.match(definition.rationale, /adjusted 102, actual 101/)
  assert.deepEqual(definition.case_configurations[2], { include: false, operation: 'No Change', params: [0, 0, 0, 0, 0] })
})

test('both modes preserve the chosen objective and describe it accurately in the scenario', () => {
  for (const mode of ['full', 'mix']) {
    for (const [objective, label, wording] of [
      ['post_tax_npv', 'Post-tax NPV', 'discounted at 8%'],
      ['post_tax_fcf', 'Free Cash Flow', 'undiscounted'],
      ['underlying_rcop', 'Underlying RCOP', 'before tax'],
      ['production', 'Production', 'mmboe'],
    ]) {
      const draft = { ...DEFAULT_OPTIMISER, objective, mode,
        group_entity_mix: { enabled: false }, region_mix: { enabled: false } }
      const request = optimiserRequest(draft)
      assert.equal(request.objective, objective)
      const definition = recommendationDefinition({ status: 'optimal', reconciled: true,
        selected_case_ids: [1], excluded_case_ids: [], relaxation_pct: 0 }, request)
      assert.ok(definition.description.startsWith(label))
      assert.ok(definition.rationale.includes(wording))
      if (objective !== 'post_tax_npv') assert.ok(!definition.rationale.includes('8%'))
    }
  }
  assert.throws(() => optimiserRequest({ ...DEFAULT_OPTIMISER, objective: 'unknown' }), /supported objective/)
})

test('hierarchical controls inherit and override in region, country, case order', () => {
  const a = { id: 1, region: 'North', country: 'A' }, b = { id: 2, region: 'North', country: 'B' }
  let draft = { ...DEFAULT_OPTIMISER, region_rules: { North: 'mandatory' }, country_rules: {}, case_rules: {} }
  assert.equal(effectiveCaseRule(draft, a), 'mandatory')
  draft = { ...draft, country_rules: { [countryRuleKey('North', 'A')]: 'excluded' } }
  assert.equal(effectiveCaseRule(draft, a), 'excluded')
  assert.equal(effectiveCaseRule(draft, b), 'mandatory')
  draft = { ...draft, case_rules: { 1: 'optional' } }
  assert.equal(effectiveCaseRule(draft, a), 'optional')
  draft = { ...draft, region_rules: { North: 'excluded' } }
  assert.equal(effectiveCaseRule(draft, a), 'optional')
  assert.deepEqual(excludedRegionRules(draft, [a, b]), {})
  assert.equal(effectiveCaseRule({ ...draft, case_rules: {} }, a), 'excluded')
  assert.notEqual(countryRuleKey('North', 'A'), countryRuleKey('South', 'A'))
})

test('Standard never submits Advanced controls, even when the draft retains them', () => {
  const draft = { ...DEFAULT_OPTIMISER, region_rules: { North: 'mandatory' },
    country_rules: { [countryRuleKey('North', 'A')]: 'excluded' }, case_rules: { 1: 'optional' },
    mandatory_case_ids: [99], excluded_case_ids: [88],
    group_entity_mix: { enabled: false }, region_mix: { enabled: false } }
  const standard = optimiserRequest(draft)
  for (const key of ['mandatory_case_ids', 'excluded_case_ids', 'region_rules', 'country_rules', 'case_rules', 'mix_constraints']) {
    assert.deepEqual(standard[key], [])
  }
  const advanced = optimiserRequest({ ...draft, mode: 'mix' })
  assert.deepEqual(advanced.country_rules, [{ region: 'North', country: 'A', rule: 'excluded' }])
  assert.deepEqual(advanced.case_rules, [{ case_id: 1, rule: 'optional' }])
})

test('region share becomes available again when a descendant overrides an exclusion', () => {
  const cases = [{ id: 1, region: 'North', country: 'A' }, { id: 2, region: 'South', country: 'B' }]
  let draft = { ...DEFAULT_OPTIMISER, region_mix: { enabled: true, tolerance: 5, sliders: { North: 60, South: 40 } } }
  draft = { ...draft, ...changeControlRules(draft, cases, { region_rules: { North: 'excluded' } }, { North: 60, South: 40 }) }
  assert.deepEqual(draft.region_mix.sliders, { North: 0, South: 100 })
  draft = { ...draft, ...changeControlRules(draft, cases, { case_rules: { 1: 'mandatory' } }, { North: 60, South: 40 }) }
  assert.deepEqual(draft.region_mix.sliders, { North: 60, South: 40 })
  assert.equal(effectiveCaseRule(draft, cases[0]), 'mandatory')
})

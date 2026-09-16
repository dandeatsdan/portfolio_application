import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPTIMISER, optimiserRequest, effectiveCaseRule, effectiveCaseControl, newConstraint,
  recommendationDefinition, clearPortfolioControls, constraintPeriodColumns } from './optimiserHelpers.js'
import { scenarioReducer, initialScenario } from '../hooks/scenarioDefinition.js'
import { buildScenarioInstructions } from '../hooks/scenarioInstructions.js'
const c = { id: 1, case: 'A', region: 'North', country: 'UK', plan_type: 'Base' }
test('plan type conflicts require explicit case choices and missing plan types are visible', () => {
  const draft = { ...DEFAULT_OPTIMISER, plan_type_rules: { Base: 'reference' }, region_rules: { North: 'excluded' } }
  assert.equal(effectiveCaseRule(draft, c), 'conflict')
  for (const rule of ['reference', 'optional', 'excluded']) assert.equal(effectiveCaseRule({ ...draft, case_rules: { 1: rule } }, c), rule)
  assert.equal(effectiveCaseControl({ ...draft, region_rules: {} }, c).source, 'Plan type')
  assert.equal(effectiveCaseRule({ ...DEFAULT_OPTIMISER, plan_type_rules: { Unspecified: 'reference' } }, { ...c, plan_type: null }), 'reference')
})
test('independent timing toggles only submit enabled directions', () => {
  const draft = { ...DEFAULT_OPTIMISER, timing: { ...DEFAULT_OPTIMISER.timing, delay_enabled: true, max_delay_years: 3, max_acceleration_years: 4 } }
  assert.equal(optimiserRequest(draft).max_delay_years, 3)
  assert.equal(optimiserRequest(draft).max_acceleration_years, 0)
  assert.equal(draft.timing.max_acceleration_years, 4)
})
test('FCF supports signed targets; relative targets retain priorities and dollar units', () => {
  const request = optimiserRequest({ ...DEFAULT_OPTIMISER, use_priorities: true, constraints: [
    { ...newConstraint('cash'), metric: 'post_tax_fcf', target: '-10', flexibility_pct: 5 },
    { ...newConstraint('reference'), target_basis: 'relative', relative_pct: '-10', priority: 1, weight: '2' },
  ] })
  assert.equal(request.constraints[0].target, -10)
  assert.equal(request.constraints[1].relative_pct, -10)
  assert.equal(request.constraints[1].weight, 2)
  assert.match(constraintPeriodColumns([{ id: 'cash', metric: 'post_tax_fcf', year_from: 2026, year_to: 2028, unit: '$m' }], request.constraints)[0].label, /Free Cash Flow.*\$m/)
  assert.throws(() => optimiserRequest({ ...DEFAULT_OPTIMISER, constraints: [{ ...newConstraint('x'), target_basis: 'relative', relative_pct: -101 }] }))
})
test('clear advanced controls resets timing and plan rules but preserves constraints', () => {
  const update = clearPortfolioControls()
  assert.deepEqual(update.plan_type_rules, {})
  assert.equal(update.timing.delay_enabled, false)
  assert.equal(update.use_priorities, false)
  assert.equal(Object.hasOwn(update, 'constraints'), false)
})

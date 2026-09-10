import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPTIMISER, newConstraint, optimiserRequest, recommendationDefinition, constraintUnit } from './optimiserHelpers.js'
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
  const definition = recommendationDefinition(result, DEFAULT_OPTIMISER)
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
  for (const update of [{ status: 'infeasible' }, { reconciled: false }, { selected_case_ids: [] }]) assert.throws(() => recommendationDefinition({ ...result, ...update }, DEFAULT_OPTIMISER))
})

test('recommended cases stay first during sorting and reset preserves source order within groups', async () => {
  const { sortRecommendedCases } = await import('./optimiserHelpers.js')
  const rows = [{ id: 1, selected: false, npv: 100 }, { id: 2, selected: true, npv: 5 }, { id: 3, selected: true, npv: 10 }, { id: 4, selected: false, npv: -20 }]
  assert.deepEqual(sortRecommendedCases(rows).map(r => r.id), [2, 3, 1, 4])
  assert.deepEqual(sortRecommendedCases(rows, { key: 'npv', direction: 'descending' }).map(r => r.id), [3, 2, 1, 4])
  assert.deepEqual(sortRecommendedCases(rows, { key: 'npv', direction: 'ascending' }).map(r => r.id), [2, 3, 4, 1])
  assert.deepEqual(rows.map(r => r.id), [1, 2, 3, 4])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { filterScenarioCases } from './scenarioCaseFilters.js'
import { buildScenarioInstructions } from '../hooks/scenarioInstructions.js'

const cases = [
  { id: 1, case: 'A', plan_type: 'Base', group_entity: 'One', segment: 'Oil', region: 'North', country: 'UK', case_name: 'A' },
  { id: 2, case: 'B', plan_type: 'Growth', group_entity: 'Two', segment: 'Gas', region: 'South', country: 'US', case_name: 'B' },
]
test('all six dimensions filter rows; selections union within a dimension and intersect across dimensions', () => {
  const filters = { planTypes: ['Base'], groupEntities: ['One'], segments: ['Oil'], regions: ['North'], countries: ['UK'], caseNames: ['A'] }
  for (const [key, value] of Object.entries(filters)) assert.deepEqual(filterScenarioCases(cases, { [key]: value }), [cases[0]])
  assert.deepEqual(filterScenarioCases(cases, filters), [cases[0]])
  assert.deepEqual(filterScenarioCases(cases, { regions: ['North', 'South'] }), cases)
  assert.deepEqual(filterScenarioCases(cases, { regions: ['North'], countries: ['US'] }), [])
  assert.deepEqual(filterScenarioCases(cases, {}), cases)
})
test('hiding a shortlisted case does not remove its operation or change run scope', () => {
  const selected = new Set([1])
  const config = { 1: { include: true, operation: 'Delay', params: [2, 0, 0, 0, 0] } }
  const before = buildScenarioInstructions(cases, selected, config)
  assert.deepEqual(filterScenarioCases(cases.filter(c => selected.has(c.id)), { countries: ['US'] }), [])
  assert.deepEqual(buildScenarioInstructions(cases, selected, config), before)
  assert.equal(before.length, 2)
  assert.equal(before[0].param1, 2)
})

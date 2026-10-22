import test from 'node:test'
import assert from 'node:assert/strict'
import { buildScenarioInstructions, defaultCase, OPERATION_LABELS } from './scenarioInstructions.js'

const caseRow = id => ({ id, case: `Case ${id} | Main Plan`, case_name: `Case ${id}` })
const unchanged = row => ({
  id: row.id,
  case: row.case,
  include: true,
  operation: 'NoChange',
  param1: 0,
  param2: 0,
  param3: 0,
  param4: 0,
  param5: 0,
})

test('an empty shortlist runs the full 1000-case portfolio unchanged in source order', () => {
  const cases = Array.from({ length: 1000 }, (_, index) => caseRow(1000 - index))
  assert.deepEqual(buildScenarioInstructions(cases, new Set(), {}), cases.map(unchanged))
})

test('shortlisting cases for visibility alone leaves the full baseline instructions unchanged', () => {
  const cases = [caseRow(7), caseRow(2), caseRow(9)]
  const config = { 2: { include: true, operation: 'No Change', params: [0, 0, 0, 0, 0] } }
  assert.deepEqual(buildScenarioInstructions(cases, new Set([2, 7]), config), cases.map(unchanged))
})

test('only shortlisted cases override inclusion and operations; excluded cases remain explicit in the request', () => {
  const cases = [caseRow(4), caseRow(3), caseRow(2), caseRow(1)]
  const config = {
    4: { include: true, operation: 'Delay', params: [2, 100, 2028, 0, 0] },
    3: { include: false, operation: 'No Change', params: [0, 0, 0, 0, 0] },
    2: { include: false, operation: 'CAPEX Change %', params: [40, 2027, 2031, 0, 0] },
  }
  assert.deepEqual(buildScenarioInstructions(cases, new Set([3, 4]), config), [
    { ...unchanged(cases[0]), operation: 'Delay', param1: 2, param2: 100, param3: 2028 },
    { ...unchanged(cases[1]), include: false },
    unchanged(cases[2]),
    unchanged(cases[3]),
  ])
})

test('removing an excluded or modified case from the shortlist restores included NoChange despite stale config', () => {
  const cases = [caseRow(1), caseRow(2)]
  const config = {
    1: { include: false, operation: 'Delay', params: [3, 200, 2029, 0, 0] },
    2: { include: true, operation: 'Farm In (Increase)', params: [0.25, 2027, 2032, 20, 2029] },
  }
  const selected = buildScenarioInstructions(cases, new Set([1, 2]), config)
  assert.equal(selected[0].include, false)
  assert.equal(selected[1].operation, 'Increase')

  assert.deepEqual(buildScenarioInstructions(cases, new Set([2]), config)[0], unchanged(cases[0]))
  assert.deepEqual(buildScenarioInstructions(cases, new Set(), config), cases.map(unchanged))
})

test('No Change clears leftover parameter values from a previously selected operation', () => {
  const cases = [caseRow(1)]
  const config = { 1: { include: true, operation: 'No Change', params: [2, 100, 2028, 40, 2030] } }
  assert.deepEqual(buildScenarioInstructions(cases, new Set([1]), config), cases.map(unchanged))
})

test('all cases can be explicitly excluded without dropping their instruction records', () => {
  const cases = [caseRow(2), caseRow(1)]
  const config = Object.fromEntries(cases.map(row => [row.id, {
    include: false, operation: 'No Change', params: [0, 0, 0, 0, 0],
  }]))
  assert.deepEqual(buildScenarioInstructions(cases, new Set([1, 2]), config),
    cases.map(row => ({ ...unchanged(row), include: false })))
})

test('no loaded cases yields no instructions even when stale shortlist IDs exist', () => {
  assert.deepEqual(buildScenarioInstructions([], new Set([12]), { 12: defaultCase() }), [])
})

test('Farm In keeps all five configured parameters in their defined positions', () => {
  const cases = [caseRow(1)]
  const config = { 1: { include: true, operation: 'Farm In (Increase)', params: [0.25, 2027, 2032, 75, 2030] } }
  assert.deepEqual(buildScenarioInstructions(cases, new Set([1]), config), [{
    id: 1,
    case: 'Case 1 | Main Plan',
    include: true,
    operation: 'Increase',
    param1: 0.25,
    param2: 2027,
    param3: 2032,
    param4: 75,
    param5: 2030,
  }])
})

test('duplicate display names retain their numeric IDs and distinct full Case identifiers', () => {
  const cases = [
    { id: 42, case: 'Shared name | Main Plan', case_name: 'Shared name' },
    { id: 17, case: 'Shared name | Manual', case_name: 'Shared name' },
  ]
  const config = { 17: { include: false, operation: 'No Change', params: [0, 0, 0, 0, 0] } }
  assert.deepEqual(buildScenarioInstructions(cases, new Set([17]), config), [
    unchanged(cases[0]),
    { ...unchanged(cases[1]), include: false },
  ])
})

const operationKeys = [
  ['No Change', 'NoChange'],
  ['Delay', 'Delay'],
  ['Accelerate', 'Accelerate'],
  ['Farm In (Increase)', 'Increase'],
  ['Farm Down (Dilution)', 'Dilution'],
  ['Truncate Before', 'TruncateBefore'],
  ['Truncate After', 'TruncateAfter'],
  ['Production Change %', 'ProdnAdj'],
  ['OPEX Change %', 'CostAdjOpex'],
  ['CAPEX Change %', 'CostAdjCapex'],
  ['CAPEX Change $m', 'CapexAbsolute'],
  ['OPEX Change $m', 'OpexAbsolute'],
]

test('existing operation labels continue to submit the established engine keys', () => {
  assert.deepEqual(OPERATION_LABELS, operationKeys.map(([label]) => label))
  for (const [label, key] of operationKeys) {
    const config = { 1: { include: true, operation: label, params: [0, 0, 0, 0, 0] } }
    const instructions = buildScenarioInstructions([caseRow(1)], new Set([1]), config)
    assert.equal(instructions[0].operation, key, label)
  }
})

test('instruction generation leaves frozen case data, configuration, parameters and shortlist unchanged', () => {
  const cases = Object.freeze([Object.freeze(caseRow(2)), Object.freeze(caseRow(1))])
  const params = Object.freeze([2, 50, 2029, 0, 0])
  const config = Object.freeze({
    2: Object.freeze({ include: true, operation: 'Delay', params }),
    1: Object.freeze({ include: false, operation: 'Delay', params }),
  })
  const shortlist = new Set([2])
  const before = structuredClone({ cases, config, shortlist })

  const instructions = buildScenarioInstructions(cases, shortlist, config)
  assert.deepEqual(instructions, [
    { ...unchanged(cases[0]), operation: 'Delay', param1: 2, param2: 50, param3: 2029 },
    unchanged(cases[1]),
  ])
  assert.deepEqual({ cases, config, shortlist }, before)
  assert.notEqual(instructions, cases)
  assert.notEqual(instructions[0], cases[0])
})

test('default case settings are independently editable without changing future defaults', () => {
  const first = defaultCase()
  first.include = false
  first.operation = 'Delay'
  first.params[0] = 3
  assert.deepEqual(defaultCase(), { include: true, operation: 'No Change', params: [0, 0, 0, 0, 0] })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { waterfallPositions, changeRows, copySettings, DEFAULT_RESULTS_SETTINGS, settingsError, runSavedDefinition } from './resultsHelpers.js'

test('floating waterfall positions handle positive, negative and zero-crossing steps', () => {
  const positions = waterfallPositions([{ value: 100, type: 'absolute' }, { value: 20, type: 'relative' }, { value: -10, type: 'relative' }, { value: 110, type: 'absolute' }])
  assert.deepEqual(positions.map(r => r.range), [[0, 100], [100, 120], [110, 120], [0, 110]])
  assert.deepEqual(waterfallPositions([{ value: -5, type: 'absolute' }, { value: 10, type: 'relative' }])[1].range, [-5, 5])
})
test('draft settings are independent and reject invalid periods and duplicate comparisons', () => {
  const draft = copySettings(DEFAULT_RESULTS_SETTINGS)
  draft.plot1.metric = 'Cash Capex'
  assert.equal(DEFAULT_RESULTS_SETTINGS.plot1.metric, 'Total Production (mboed)')
  assert.equal(settingsError(draft), null)
  for (const update of [{ yearFrom: 2030, yearTo: 2028 }, { yearFrom: 235 }, { comparison: 'current' }, { changes: { metric: 'Post-tax NPV', period: 'average' } }]) assert.ok(settingsError({ ...draft, ...update }))
})
test('changes hide reference instructions and show exclusions and labelled fractions', () => {
  const rows = changeRows([{ id: 1, include: true, operation: 'NoChange' }, { id: 2, include: false, operation: 'Delay' }, { id: 3, include: true, operation: 'Dilution', param1: .25, param2: 2028, param3: 2030, param4: 20, param5: 2027 }], [{ id: 3, case_name: 'Example' }])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].detail, 'Removed from scenario')
  assert.match(rows[1].detail, /25%/)
  assert.match(rows[1].detail, /Proceeds year: 2,027/)
  assert.doesNotMatch(rows[1].detail, /Param[1-5]/)
})
test('saved comparison uses ordinary execution with full portfolio instructions and rejects invalid definitions', async () => {
  const saved = { name: 'Saved', shortlisted_case_ids: [1], case_configurations: { 1: { include: false, operation: 'No Change', params: [0, 0, 0, 0, 0] } }, validation_errors: [] }
  let payload
  const result = await runSavedDefinition('id', [{ id: 1 }, { id: 2 }], { get: async () => saved, run: async p => { payload = p; return { valid: true } } })
  assert.equal(result.savedScenarioId, 'id')
  assert.equal(payload.instructions[0].include, false)
  assert.equal(payload.instructions[1].include, true)
  await assert.rejects(runSavedDefinition('id', [], { get: async () => ({ ...saved, validation_errors: [{ ID: 1, message: 'Invalid' }] }) }), /Invalid/)
})

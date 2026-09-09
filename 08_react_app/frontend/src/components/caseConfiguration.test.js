import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationDraft, validateConfiguration, configurationToApply, configurationSummary } from './caseConfiguration.js'
import { buildScenarioInstructions, defaultCase } from '../hooks/scenarioInstructions.js'

const draft = (operation, params, include = true) => ({ include, operation, params: Array.from({ length: 5 }, (_, i) => params[i] ?? '') })

test('draft edits do not mutate saved parameters, and optional zero values appear empty', () => {
  const saved = Object.freeze({ include: true, operation: 'Delay', params: Object.freeze([2, 0, 0, 0, 0]) })
  const edit = createConfigurationDraft(saved)
  assert.deepEqual(edit.params, ['2', '', '', '', ''])
  edit.params[0] = '4'
  assert.equal(saved.params[0], 2)
  assert.equal(configurationToApply(edit).params[0], 4)
})

test('every operation produces correctly positioned numeric instructions', () => {
  for (const [operation, params] of [
    ['No Change', []], ['Delay', ['2', '5', '2028']], ['Accelerate', ['1', '10', '2026']],
    ['Farm In (Increase)', ['0.1', '2027', '2030', '20', '2028']],
    ['Farm Down (Dilution)', ['0.25', '2027', '2030', '15', '2029']],
    ['Truncate Before', ['2030']], ['Truncate After', ['2030']],
    ['Production Change %', ['-0.1', '2028', '2030']], ['OPEX Change %', ['0.1']],
    ['CAPEX Change %', ['-0.2']], ['CAPEX Change $m', ['15', '2027', '-10', '2028']],
    ['OPEX Change $m', ['-10', '2027', '5', '2028']],
  ]) {
    const configuration = configurationToApply(draft(operation, params))
    const [instruction] = buildScenarioInstructions([{ id: 1, case: 'Case 1' }], new Set([1]), { 1: configuration })
    assert.deepEqual(configuration.params, Array.from({ length: 5 }, (_, i) => Number(params[i] ?? 0)), operation)
    for (let i = 0; i < 5; i++) assert.equal(instruction[`param${i + 1}`], Number(params[i] ?? 0), operation)
  }
})

test('missing required values, non-finite inputs and fractional years block Apply', () => {
  for (const edit of [draft('Delay', []), draft('Delay', ['1.5']), draft('Delay', ['Infinity']), draft('Delay', ['-2']), draft('Truncate After', ['2028.5'])]) {
    assert.ok(Object.keys(validateConfiguration(edit)).length)
    assert.throws(() => configurationToApply(edit), /Invalid/)
  }
  assert.deepEqual(validateConfiguration(draft('Delay', ['0'])), {})
})

test('fraction bounds and reversed year ranges follow operation constraints', () => {
  for (const edit of [draft('Farm In (Increase)', ['-0.1']), draft('Farm Down (Dilution)', ['1.1']), draft('Production Change %', ['-1.1']), draft('CAPEX Change %', ['0.1', '2030', '2028'])]) {
    assert.ok(Object.keys(validateConfiguration(edit)).length)
  }
  assert.deepEqual(validateConfiguration(draft('Farm Down (Dilution)', ['1'])), {})
  assert.deepEqual(validateConfiguration(draft('Production Change %', ['-1'])), {})
})

test('transaction and absolute adjustments require paired amount/year with valid horizon', () => {
  for (const edit of [draft('Delay', ['2', '5']), draft('Accelerate', ['1', '0', '2027']), draft('Farm In (Increase)', ['0.1', '', '', '10']), draft('CAPEX Change $m', ['15', '2027', '10']), draft('OPEX Change $m', ['10', '2041'])]) {
    assert.ok(Object.keys(validateConfiguration(edit)).length)
  }
})

test('exclusion retains last applied configuration even with an incomplete draft', () => {
  const saved = Object.freeze({ include: true, operation: 'Farm In (Increase)', params: Object.freeze([0.1, 2028, 2030, 50, 2027]) })
  const excluded = configurationToApply(draft('Delay', [], false), saved)
  assert.deepEqual(excluded, { ...saved, include: false })
  assert.notEqual(excluded.params, saved.params)
  const reinclude = createConfigurationDraft(excluded)
  reinclude.include = true
  assert.deepEqual(configurationToApply(reinclude), saved)
})

test('No Change clears all old inputs; unshortlisting restores full reference instructions', () => {
  const saved = configurationToApply(draft('No Change', ['2', '30', '2028', '50', '2027']))
  assert.deepEqual(saved, defaultCase())
  const [instruction] = buildScenarioInstructions([{ id: 1, case: 'Case 1' }], new Set(), { 1: { include: false, operation: 'Delay', params: [2, 5, 2028, 0, 0] } })
  assert.equal(instruction.include, true)
  assert.equal(instruction.operation, 'NoChange')
  assert.deepEqual([1, 2, 3, 4, 5].map(i => instruction[`param${i}`]), [0, 0, 0, 0, 0])
})

test('summary distinguishes exclusion, reference profile, timing and fractional scale', () => {
  assert.equal(configurationSummary(defaultCase()), 'Included · Reference profile')
  assert.equal(configurationSummary({ ...defaultCase(), include: false }), 'Excluded')
  assert.equal(configurationSummary(configurationToApply(draft('Delay', ['2']))), 'Included · Delay: 2 years')
  assert.equal(configurationSummary(configurationToApply(draft('Farm In (Increase)', ['0.1']))), 'Included · Farm In (Increase): 10%')
})

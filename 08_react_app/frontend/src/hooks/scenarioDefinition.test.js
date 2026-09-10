import test from 'node:test'
import assert from 'node:assert/strict'
import { initialScenario, serializeScenario, hydrateScenario, scenarioReducer, isDirty, persistScenario } from './scenarioDefinition.js'
import { buildScenarioInstructions, defaultCase } from './scenarioInstructions.js'

const record = () => ({ schema_version: 1, scenario_id: 'saved-1', updated_at: '2026-09-10T10:00:00Z',
  name: 'Example', description: 'A description', rationale: 'A rationale', shortlisted_case_ids: [3, 1, 2],
  case_configurations: { 1: defaultCase(), 2: { include: true, operation: 'Farm In (Increase)', params: [.1, 2028, 2030, 20, 2027] },
    3: { include: false, operation: 'Delay', params: [2, 5, 2028, 0, 0] } } })

test('rehydration restores independent editing state and survives initialization', () => {
  const saved = record()
  const loaded = scenarioReducer(initialScenario(), { type: 'load', saved })
  assert.equal(isDirty(loaded), false)
  assert.deepEqual(loaded.selectedIds, [3, 1, 2])
  const initialized = scenarioReducer(loaded, { type: 'init', ids: [1, 2, 3] })
  assert.deepEqual(serializeScenario(initialized).case_configurations, saved.case_configurations)
  assert.equal(isDirty(initialized), false)
  loaded.caseConfig[2].params[0] = .2
  assert.equal(saved.case_configurations[2].params[0], .1)
  assert.equal(isDirty(loaded), true)
  const instructions = buildScenarioInstructions([1, 2, 3, 4].map(id => ({ id, case: `Case ${id}` })), new Set(initialized.selectedIds), initialized.caseConfig)
  assert.equal(instructions[2].include, false)
  assert.equal(instructions[3].operation, 'NoChange')
  assert.equal(instructions[1].param5, 2027)
})

test('all persisted fields affect dirty state; selection removal resets retained overrides', () => {
  const loaded = hydrateScenario(record())
  for (const field of ['name', 'description', 'rationale']) assert.equal(isDirty(scenarioReducer(loaded, { type: 'field', field, value: 'Changed' })), true)
  let removed = scenarioReducer(loaded, { type: 'selection', value: ids => { ids.delete(2); return ids } })
  assert.equal(isDirty(removed), true)
  assert.equal(serializeScenario(removed).case_configurations[2], undefined)
  removed = scenarioReducer(removed, { type: 'selection', value: ids => ids.add(2) })
  assert.deepEqual(removed.caseConfig[2], defaultCase())
})

test('Save updates existing ID; Save As creates an independent record', async () => {
  const working = scenarioReducer(initialScenario(), { type: 'load', saved: record() })
  const calls = []
  const client = {
    update: async (id, body) => { calls.push([id, body]); return { scenario_id: id, updated_at: 'later' } },
    create: async body => { calls.push(['create', body]); return { scenario_id: 'copy', updated_at: 'later' } },
  }
  const action = await persistScenario(working, client)
  assert.equal(calls[0][0], 'saved-1')
  assert.equal(calls[0][1].expected_updated_at, record().updated_at)
  const copy = scenarioReducer(working, await persistScenario(working, client, true))
  assert.equal(copy.savedId, 'copy')
  assert.equal(isDirty(copy), false)
  assert.equal(working.savedId, 'saved-1')
  assert.equal(calls[1][0], 'create')
  assert.equal(calls[1][1].expected_updated_at, undefined)
  assert.equal(isDirty(scenarioReducer(working, action)), false)
})

test('failed saves preserve state; edits during save remain dirty; late saves cannot replace a different scenario', async () => {
  const working = scenarioReducer(initialScenario(), { type: 'load', saved: record() })
  const before = structuredClone(working)
  await assert.rejects(persistScenario(working, { update: async () => { throw Error('Disk full') } }))
  assert.deepEqual(working, before)
  const action = await persistScenario(working, { update: async () => ({ scenario_id: 'saved-1', updated_at: 'later' }) })
  const edited = scenarioReducer(working, { type: 'field', field: 'name', value: 'New edit' })
  assert.equal(isDirty(scenarioReducer(edited, action)), true)
  const fresh = scenarioReducer(working, { type: 'new' })
  assert.deepEqual(scenarioReducer(fresh, action), fresh)
})

test('new scenario Save creates a record, with no results in the payload', async () => {
  const working = initialScenario()
  const action = await persistScenario(working, { create: async body => {
    assert.equal(body.results, undefined)
    assert.deepEqual(body.shortlisted_case_ids, [])
    return { scenario_id: 'new', updated_at: 'now' }
  } })
  const saved = scenarioReducer(working, action)
  assert.equal(saved.savedId, 'new')
  assert.equal(isDirty(saved), false)
})


test('running waits for a successful save; failed saves never execute', async () => {
  const { saveBeforeRun } = await import('./scenarioDefinition.js')
  const calls = []
  let finishSave
  const pending = saveBeforeRun(() => new Promise(resolve => { finishSave = resolve }), async () => calls.push('run'))
  assert.deepEqual(calls, [])
  finishSave(true)
  assert.equal(await pending, true)
  assert.deepEqual(calls, ['run'])
  assert.equal(await saveBeforeRun(async () => false, async () => calls.push('unexpected')), false)
  await assert.rejects(saveBeforeRun(async () => { throw Error('Storage unavailable') }, async () => calls.push('unexpected')))
  assert.deepEqual(calls, ['run'])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { runRecommendation, scenarioRunPayload } from './recommendationRun.js'
import { buildScenarioInstructions } from './scenarioInstructions.js'
const cases = [{ id: 1, case: 'A' }, { id: 2, case: 'B' }]
const definition = { name: 'Recommendation', description: 'Test', rationale: 'Verified', shortlisted_case_ids: [1, 2],
  case_configurations: { 1: { include: true, operation: 'Delay', params: [2, 0, 0, 0, 0] },
    2: { include: false, operation: 'No Change', params: [0, 0, 0, 0, 0] } } }
test('direct run saves first and uses exactly the builder instructions', async () => {
  const calls = []
  const completed = await runRecommendation({ definition, cases, isCurrent: () => true,
    create: async d => { calls.push('save'); assert.deepEqual(d, definition); return { ...d, scenario_id: 'new' } },
    onSaved: () => calls.push('saved'), run: async payload => {
      calls.push('run')
      assert.deepEqual(payload.instructions, buildScenarioInstructions(cases, new Set(definition.shortlisted_case_ids), definition.case_configurations))
      return { valid: true }
    } })
  assert.deepEqual(calls, ['save', 'saved', 'run'])
  assert.equal(completed.result.savedScenarioId, 'new')
  assert.equal(scenarioRunPayload(definition, cases).instructions[1].include, false)
})
test('failed save never runs; retry after run failure reuses the saved definition', async () => {
  let saves = 0, runs = 0, saved
  const options = { definition, cases, isCurrent: () => true, onSaved: s => { saved = s },
    create: async () => { saves++; return { ...definition, scenario_id: 'new' } },
    run: async () => { runs++; throw new Error('Run failed') } }
  await assert.rejects(runRecommendation({ ...options, create: async () => { throw new Error('Save failed') } }), /Save failed/)
  assert.equal(runs, 0)
  await assert.rejects(runRecommendation(options), /Run failed/)
  const completed = await runRecommendation({ ...options, saved, run: async () => ({ valid: true }) })
  assert.equal(saves, 1)
  assert.equal(completed.result.savedScenarioId, 'new')
})
test('stale saves do not run; stale run responses do not publish', async () => {
  let current = true, ran = false
  const result = await runRecommendation({ definition, cases, isCurrent: () => current,
    create: async () => { current = false; return { scenario_id: 'new' } }, onSaved: () => {},
    run: async () => { ran = true; return { valid: true } } })
  assert.equal(result, null)
  assert.equal(ran, false)
  current = true
  assert.equal(await runRecommendation({ definition, cases, saved: { scenario_id: 'new' }, isCurrent: () => current,
    onSaved: () => {}, run: async () => { current = false; return { valid: true } } }), null)
})

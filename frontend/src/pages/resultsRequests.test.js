import test from 'node:test'
import assert from 'node:assert/strict'
import { analysisRequest, createAnalysisLoader } from './resultsRequests.js'

test('requests retain selected metrics, scope and raw signs, including NPV cash flows', () => {
  const rows = [
    { id: 1, metric: 'Cash Capex', year: 2026, value: -50 },
    { id: 2, metric: 'Cash Capex', year: 2026, value: -70 },
    { id: 1, metric: 'Cash Capex', year: 2027, value: -80 },
    { id: 1, metric: 'Post-Tax Cash Flow', year: 2026, value: -100 },
    { id: 1, metric: 'Revenue', year: 2026, value: 300 },
  ]
  const original = structuredClone(rows)
  const payload = { baseline: rows, scenario: rows, comparison: rows, kind: 'profile', metric: 'Cash Capex', case_ids: [1], year_from: 2026, year_to: 2026 }
  const result = analysisRequest(payload)
  for (const field of ['baseline', 'scenario', 'comparison']) assert.deepEqual(result[field], [rows[0]])
  assert.deepEqual(analysisRequest({ ...payload, kind: 'impact', metric: 'Post-tax NPV' }).scenario, [rows[3]])
  assert.deepEqual(analysisRequest({ ...payload, kind: 'kpis' }).scenario, [rows[0], rows[3]])
  assert.deepEqual(analysisRequest({ ...payload, case_ids: [] }).scenario, [])
  assert.deepEqual(rows, original)
})

test('requests share pending and completed results; failures retry and cache stays bounded', async () => {
  let calls = 0
  const load = createAnalysisLoader(async payload => { calls++; if (payload.fail) throw new Error('failed'); return payload }, 2)
  const first = load('a', { value: 1 })
  assert.equal(load('a', { value: 1 }), first)
  await first
  assert.equal(load('a', { value: 1 }), first)
  assert.equal(calls, 1)
  await assert.rejects(load('b', { fail: true }))
  await load('b', { value: 2 })
  await load('c', { value: 3 })
  await load('a', { value: 1 })
  assert.equal(calls, 5)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeRun } from './runSummary.js'
const cases = [1, 2, 3, 4].map(id => ({ id, case: `Full ${id}`, case_name: 'Same display name' }))
test('empty shortlist ignores stale configuration and includes all reference cases', () => {
  assert.deepEqual(summarizeRun(cases, new Set(), { 1: { include: false, operation: 'Delay', params: [2] } }), {
    referenceCount: 4, modifiedCount: 0, excludedCount: 0, changes: [],
  })
})
test('summary partitions cases and shows all five saved inputs; excluded operations do not apply', () => {
  const configs = {
    1: { include: true, operation: 'Farm Down (Dilution)', params: [0.25, 2027, 2030, 100, 2028] },
    2: { include: false, operation: 'Delay', params: [2, 10, 2027, 0, 0] },
    3: { include: true, operation: 'No Change', params: [0, 0, 0, 0, 0] },
  }
  const before = JSON.stringify(configs)
  const summary = summarizeRun(cases, new Set([1, 2, 3]), configs)
  assert.equal(summary.referenceCount, 2)
  assert.equal(summary.modifiedCount, 1)
  assert.equal(summary.excludedCount, 1)
  assert.deepEqual(summary.changes.map(row => row.id), [1, 2])
  assert.deepEqual(summary.changes[0].inputs.map(input => input.value), configs[1].params)
  assert.ok(summary.changes[0].inputs.every(input => input.label))
  assert.deepEqual(summary.changes[1].inputs, [])
  assert.equal(summary.changes[1].operation, 'Excluded')
  assert.equal(JSON.stringify(configs), before)
})
test('all excluded cases leave no runnable population', () => {
  const configs = Object.fromEntries(cases.map(row => [row.id, { include: false, operation: 'No Change', params: [] }]))
  const summary = summarizeRun(cases, new Set(cases.map(row => row.id)), configs)
  assert.equal(summary.referenceCount + summary.modifiedCount, 0)
  assert.equal(summary.excludedCount, 4)
})

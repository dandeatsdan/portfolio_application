import test from 'node:test'
import assert from 'node:assert/strict'
import { sortScenarioCases } from './scenarioCaseSort.js'

const ids = rows => rows.map(row => row.id)
const sort = (key, direction = 'ascending') => ({ key, direction })

test('no selected sort and unknown columns preserve the original order', () => {
  const rows = [{ id: 10 }, { id: 2 }, { id: 1 }]
  assert.deepEqual(ids(sortScenarioCases(rows)), [10, 2, 1])
  assert.deepEqual(ids(sortScenarioCases(rows, sort('unknown'))), [10, 2, 1])
  assert.notEqual(sortScenarioCases(rows), rows)
  assert.deepEqual(sortScenarioCases([], sort('reference')), [])
})

for (const key of ['case_name', 'region', 'country', 'plan_type']) {
  test(`${key}: text sorts in both directions and case-insensitive ties keep source order`, () => {
    const rows = ['Zulu', 'beta', 'Alpha', 'Beta', 'Alpha'].map((value, id) => ({ id, [key]: value }))
    assert.deepEqual(ids(sortScenarioCases(rows, sort(key))), [2, 4, 1, 3, 0])
    assert.deepEqual(ids(sortScenarioCases(rows, sort(key, 'descending'))), [0, 1, 3, 2, 4])
  })
}

test('IDs sort numerically, rather than in display string order', () => {
  const rows = [100, 2, 10, 1].map(id => ({ id }))
  assert.deepEqual(ids(sortScenarioCases(rows, sort('id'))), [1, 2, 10, 100])
  assert.deepEqual(ids(sortScenarioCases(rows, sort('id', 'descending'))), [100, 10, 2, 1])
})

test('reference sorts raw numbers including negatives, zero, precision and ties', () => {
  const rows = [1000, -20, 10.04, 0, 2, 10.01, 2, 100].map((reference, id) => ({ id, reference }))
  assert.deepEqual(ids(sortScenarioCases(rows, sort('reference'))), [1, 3, 4, 6, 5, 2, 7, 0])
  assert.deepEqual(ids(sortScenarioCases(rows, sort('reference', 'descending'))), [0, 7, 2, 5, 4, 6, 3, 1])
})

for (const direction of ['ascending', 'descending']) {
  test(`missing text stays last in source order when ${direction}`, () => {
    const rows = [null, 'Zulu', undefined, '', 'Alpha', '  ', 'Beta'].map((country, id) => ({ id, country }))
    assert.deepEqual(ids(sortScenarioCases(rows, sort('country', direction))),
      direction === 'ascending' ? [4, 6, 1, 0, 2, 3, 5] : [1, 6, 4, 0, 2, 3, 5])
  })

  test(`missing and non-finite numbers stay last in source order when ${direction}`, () => {
    const rows = [null, 10, undefined, NaN, 0, '', Infinity, -2, -Infinity, '  ']
      .map((reference, id) => ({ id, reference }))
    assert.deepEqual(ids(sortScenarioCases(rows, sort('reference', direction))),
      direction === 'ascending' ? [7, 4, 1, 0, 2, 3, 5, 6, 8, 9] : [1, 4, 7, 0, 2, 3, 5, 6, 8, 9])
  })
}

test('sorts the supplied visible cases, preserving source arrays, row objects and sort state', () => {
  const rows = Object.freeze([
    Object.freeze({ id: 1, case_name: 'Alpha', reference: 20 }),
    Object.freeze({ id: 2, case_name: 'Beta', reference: 500 }),
    Object.freeze({ id: 3, case_name: 'Alpine', reference: 100 }),
    Object.freeze({ id: 4, case_name: 'Alto', reference: 10 }),
  ])
  const visible = Object.freeze(rows.filter(row => row.case_name.startsWith('Al')))
  const selectedSort = Object.freeze(sort('reference', 'descending'))
  const result = sortScenarioCases(visible, selectedSort)
  assert.deepEqual(ids(result), [3, 1, 4])
  assert.deepEqual(ids(rows), [1, 2, 3, 4])
  assert.deepEqual(ids(visible), [1, 3, 4])
  assert.notEqual(result, visible)
  for (const row of result) assert.equal(row, rows.find(original => original.id === row.id))
  assert.deepEqual(selectedSort, { key: 'reference', direction: 'descending' })
  assert.deepEqual(ids(sortScenarioCases(rows, selectedSort)), [2, 3, 1, 4])
})

test('shortlist and available sorts remain independent and preserve case configurations', () => {
  const delayed = Object.freeze({ include: true, operation: 'Delay', params: Object.freeze([2, null, null, null, null]) })
  const excluded = Object.freeze({ include: false, operation: 'NoChange', params: Object.freeze([]) })
  const rows = Object.freeze([
    Object.freeze({ id: 1, case_name: 'Alpha', reference: 30, config: delayed }),
    Object.freeze({ id: 2, case_name: 'Beta', reference: 10 }),
    Object.freeze({ id: 3, case_name: 'Zulu', reference: -5, config: excluded }),
    Object.freeze({ id: 4, case_name: 'Gamma', reference: 100 }),
  ])
  const shortlist = Object.freeze(rows.filter(row => row.config))
  const available = Object.freeze(rows.filter(row => !row.config))
  const shortlistSort = Object.freeze(sort('reference'))
  const availableSort = Object.freeze(sort('case_name', 'descending'))

  const sortedShortlist = sortScenarioCases(shortlist, shortlistSort)
  const sortedAvailable = sortScenarioCases(available, availableSort)

  assert.deepEqual(ids(sortedShortlist), [3, 1])
  assert.deepEqual(ids(sortedAvailable), [4, 2])
  assert.deepEqual(ids(sortScenarioCases(shortlist)), [1, 3])
  assert.deepEqual(ids(sortScenarioCases(available)), [2, 4])
  assert.equal(sortedShortlist[0], rows[2])
  assert.equal(sortedShortlist[0].config, excluded)
  assert.equal(sortedShortlist[1].config, delayed)
  assert.equal(sortedAvailable[0], rows[3])
  assert.deepEqual(ids(rows), [1, 2, 3, 4])
  assert.deepEqual(shortlistSort, { key: 'reference', direction: 'ascending' })
  assert.deepEqual(availableSort, { key: 'case_name', direction: 'descending' })
})

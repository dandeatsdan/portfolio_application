import test from 'node:test'
import assert from 'node:assert/strict'
import { sortCaseSummaryRows } from './caseSummarySort.js'

const ids = rows => rows.map(row => row.ID)
const sort = (key, direction = 'ascending') => ({ key, direction })

test('shortlist first with original order, including tick and untick without a column sort', () => {
  const rows = [1, 2, 3, 4].map(ID => ({ ID }))
  assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set())), [1, 2, 3, 4])
  assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([4, 2]))), [2, 4, 1, 3])
  assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([4]))), [4, 1, 2, 3])
  assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([1, 2, 3, 4]))), [1, 2, 3, 4])
})

for (const key of ['Case Name', 'Plan Type', 'Group Entity', 'Segment', 'Region', 'Country']) {
  test(`${key}: ascending and descending inside both shortlist groups, preserving text ties`, () => {
    const rows = ['Zulu', 'beta', 'Alpha', 'Beta', 'Alpha', 'Zulu'].map((value, ID) => ({ ID, [key]: value }))
    const shortlist = new Set([0, 4])
    assert.deepEqual(ids(sortCaseSummaryRows(rows, shortlist, sort(key))), [4, 0, 2, 1, 3, 5])
    assert.deepEqual(ids(sortCaseSummaryRows(rows, shortlist, sort(key, 'descending'))), [0, 4, 5, 1, 3, 2])
  })
}

for (const key of ['Production', 'Capex', 'FCF', 'NPV']) {
  test(`${key}: raw numeric ordering with negatives, zero, decimals and ties`, () => {
    const rows = [1000, -20, 10.04, 0, 2, 10.01, 2, 100].map((value, ID) => ({ ID, [key]: value }))
    const shortlist = new Set([0, 1])
    assert.deepEqual(ids(sortCaseSummaryRows(rows, shortlist, sort(key))), [1, 0, 3, 4, 6, 5, 2, 7])
    assert.deepEqual(ids(sortCaseSummaryRows(rows, shortlist, sort(key, 'descending'))), [0, 1, 7, 2, 5, 4, 6, 3])
  })
}

for (const direction of ['ascending', 'descending']) {
  test(`missing text stays last within each group when ${direction}`, () => {
    const rows = [null, 'Zulu', undefined, '', 'Alpha', '  ', 'Beta'].map((value, ID) => ({ ID, Country: value }))
    assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([0, 1]), sort('Country', direction))),
      direction === 'ascending' ? [1, 0, 4, 6, 2, 3, 5] : [1, 0, 6, 4, 2, 3, 5])
  })

  test(`missing and non-finite numbers stay last within each group when ${direction}`, () => {
    const rows = [null, 10, undefined, NaN, 0, '', Infinity, -2].map((value, ID) => ({ ID, NPV: value }))
    assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([0, 1]), sort('NPV', direction))),
      direction === 'ascending' ? [1, 0, 7, 4, 2, 3, 5, 6] : [1, 0, 4, 7, 2, 3, 5, 6])
  })
}

test('tick and untick return rows to the selected column order', () => {
  const rows = [30, 10, 20, 40].map((NPV, ID) => ({ ID, NPV }))
  assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([3]), sort('NPV'))), [3, 1, 2, 0])
  assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([3, 0]), sort('NPV'))), [0, 3, 1, 2])
  assert.deepEqual(ids(sortCaseSummaryRows(rows, new Set([0]), sort('NPV'))), [0, 1, 2, 3])
})

test('sort only visible search/filter results, retain hidden shortlist IDs and original row objects', () => {
  const rows = Object.freeze([
    Object.freeze({ ID: 1, 'Case Name': 'Alpha', Country: 'UK', NPV: 10 }),
    Object.freeze({ ID: 2, 'Case Name': 'Beta', Country: 'US', NPV: 50 }),
    Object.freeze({ ID: 3, 'Case Name': 'Alpine', Country: 'UK', NPV: 20 }),
    Object.freeze({ ID: 4, 'Case Name': 'Alto', Country: 'UK', NPV: 100 }),
  ])
  const shortlist = new Set([2, 3])
  const visible = Object.freeze(rows.filter(row => row.Country === 'UK' && row['Case Name'].toLowerCase().includes('al')))
  const result = sortCaseSummaryRows(visible, shortlist, sort('NPV', 'descending'))
  assert.deepEqual(ids(result), [3, 4, 1])
  assert.deepEqual([...shortlist], [2, 3])
  assert.deepEqual(ids(rows), [1, 2, 3, 4])
  assert.deepEqual(ids(visible), [1, 3, 4])
  assert.notEqual(result, visible)
  for (const row of result) assert.equal(row, rows.find(original => original.ID === row.ID))
  assert.deepEqual(ids(sortCaseSummaryRows(rows, shortlist, sort('NPV', 'descending'))), [2, 3, 4, 1])
  assert.deepEqual(sortCaseSummaryRows([], shortlist, sort('NPV')), [])
})

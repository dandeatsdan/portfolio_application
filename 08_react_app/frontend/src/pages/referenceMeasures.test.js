import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_REFERENCES, REFERENCE_KEYS, referenceLabel, updateReference, NPV_METRIC } from './referenceMeasures.js'
import { sortScenarioCases } from './scenarioCaseSort.js'

test('reference headings distinguish cumulative production, annual rates and NPV', () => {
  assert.match(referenceLabel(DEFAULT_REFERENCES[0]), /mmboe.*2026–2040/)
  assert.match(referenceLabel({ ...DEFAULT_REFERENCES[0], period: '2026' }), /mboed.*2026/)
  assert.match(referenceLabel({ ...DEFAULT_REFERENCES[0], period: 'average' }), /mboed.*Average/)
  assert.match(referenceLabel(DEFAULT_REFERENCES[2]), /8%/)
})
test('switching an average to NPV selects a total without mutating the other settings', () => {
  const previous = Object.freeze({ metric: 'Cash Capex', period: 'average' })
  assert.deepEqual(updateReference(previous, 'metric', NPV_METRIC), { metric: NPV_METRIC, period: 'five' })
  assert.equal(previous.period, 'average')
})
for (const key of REFERENCE_KEYS) test(`${key} sorts raw numbers, stable ties and missing values`, () => {
  const rows = Object.freeze([10, null, -20, 10].map((value, i) => Object.freeze({ id: i, [key]: value })))
  assert.deepEqual(sortScenarioCases(rows, { key, direction: 'ascending' }).map(r => r.id), [2, 0, 3, 1])
  assert.deepEqual(sortScenarioCases(rows, { key, direction: 'descending' }).map(r => r.id), [0, 3, 2, 1])
  assert.deepEqual(rows.map(r => r.id), [0, 1, 2, 3])
})


test('time slicer intersects reference periods and identifies periods outside its range', async () => {
  const { filteredReferencePeriod, referenceLabel } = await import('./referenceMeasures.js')
  const full = { from: 2026, to: 2040 }
  const timeframe = filteredReferencePeriod(full, 2028, 2032)
  assert.equal(timeframe.from, 2028)
  assert.equal(timeframe.to, 2032)
  assert.match(referenceLabel({ metric: 'Cash Capex', period: 'full', timeframe }), /2028–2032/)
  assert.equal(filteredReferencePeriod({ from: 2026, to: 2030, average: true }, 2031, 2035).empty, true)
  const average = filteredReferencePeriod({ from: 2026, to: 2030, average: true }, 2028, 2035)
  assert.equal(average.average, true)
  assert.equal(average.to, 2030)
})

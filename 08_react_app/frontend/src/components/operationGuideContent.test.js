import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { OPERATION_LABELS } from '../hooks/scenarioInstructions.js'
import { OPERATION_GUIDE_CATEGORIES } from './operationGuideData.js'

// Compare help against the library consumed by the original workflow, rather
// than a second expected list maintained alongside the guide content.
const csv = readFileSync(new URL('../../../../07_streamlit_app/data/sample/005_operations_library.csv', import.meta.url), 'utf8')
const [header, ...lines] = csv.trim().split(/\r?\n/).map(line => line.split(','))
const library = lines.map(values => Object.fromEntries(header.map((key, index) => [key, values[index]])))
const guideOperations = OPERATION_GUIDE_CATEGORIES.flatMap(category => category.operations)

test('guide covers each selectable operation once, in its library category and order', () => {
  assert.deepEqual(guideOperations.map(operation => operation.name).sort(), [...OPERATION_LABELS].sort())
  assert.equal(new Set(guideOperations.map(operation => operation.name)).size, guideOperations.length)
  assert.deepEqual(OPERATION_GUIDE_CATEGORIES.map(category => category.title), [...new Set(library.map(row => row.Category))])
  for (const category of OPERATION_GUIDE_CATEGORIES) {
    assert.deepEqual(category.operations.map(operation => operation.name),
      library.filter(row => row.Category === category.title).map(row => row.Operation))
  }
})

test('guide preserves the library input positions and required/optional contract for every operation', () => {
  for (const row of library) {
    const operation = guideOperations.find(item => item.name === row.Operation)
    const expected = Array.from({ length: 5 }, (_, index) => index + 1)
      .filter(position => row[`Input ${position} Label`] !== 'n/a')
      .map(position => ({ position, required: row[`Input ${position} Required`] === 'Yes' }))
    assert.deepEqual(operation.inputs.map(({ position, required }) => ({ position, required })), expected, row.Operation)
  }
})

test('guide input labels retain the library fraction and monetary units', () => {
  for (const row of library) {
    const operation = guideOperations.find(item => item.name === row.Operation)
    for (const { position, label } of operation.inputs) {
      const sourceLabel = row[`Input ${position} Label`]
      if (sourceLabel.includes('as fraction')) assert.match(label, /as fraction/, `${row.Operation}, input ${position}`)
      if (sourceLabel.includes('$m')) assert.ok(label.includes('$m'), `${row.Operation}, input ${position}`)
      if (sourceLabel.includes('±')) assert.ok(label.includes('±'), `${row.Operation}, input ${position}`)
    }
  }
})

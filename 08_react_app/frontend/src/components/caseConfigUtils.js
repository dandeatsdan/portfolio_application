import { OPERATION_GUIDE_CATEGORIES } from './operationGuideData.js'
import { defaultCase } from '../hooks/scenarioInstructions.js'

export const configurationOperations = OPERATION_GUIDE_CATEGORIES.flatMap(category => category.operations)
export const findOperation = name => configurationOperations.find(operation => operation.name === name)

export function createConfigurationDraft(config = defaultCase()) {
  const operation = findOperation(config.operation)
  return {
    include: config.include,
    operation: config.operation,
    params: Array.from({ length: 5 }, (_, index) => {
      const input = operation?.inputs.find(item => item.position === index + 1)
      const value = config.params[index] ?? 0
      return !input || (!input.required && value === 0) ? '' : String(value)
    }),
  }
}

export function validateConfiguration(draft) {
  if (!draft.include) return {}
  const operation = findOperation(draft.operation)
  if (!operation) return { operation: 'Select an operation.' }
  const errors = {}
  const values = draft.params.map(value => Number(value))
  for (const input of operation.inputs) {
    const index = input.position - 1
    const raw = draft.params[index]
    if (String(raw ?? '').trim() === '') {
      if (input.required) errors[index] = 'Enter a value.'
      continue
    }
    if (!Number.isFinite(values[index])) errors[index] = 'Enter a finite number.'
    else if (/year/i.test(input.label) && !/change in year/i.test(input.label) && !Number.isInteger(values[index])) {
      errors[index] = 'Enter a whole number of years.'
    }
  }
  const name = draft.operation
  if (['Delay', 'Accelerate'].includes(name) && values[0] < 0) errors[0] = 'Enter zero or a positive whole number.'
  if (name === 'Farm In (Increase)' && values[0] < 0) errors[0] = 'Enter zero or a positive fraction.'
  if (name === 'Farm Down (Dilution)' && (values[0] < 0 || values[0] > 1)) errors[0] = 'Enter a fraction from 0 to 1.'
  if (name.endsWith('Change %') && values[0] < -1) errors[0] = 'A reduction cannot exceed 100% (-1).'
  if ((name.startsWith('Farm ') || name.endsWith('Change %')) && values[1] && values[2] && values[1] > values[2]) {
    errors[2] = 'End year must be on or after start year.'
  }
  function checkPair(amount, year, required = false) {
    if (!required && !values[amount] && !values[year]) return
    if (!values[amount]) errors[amount] = 'Enter a non-zero amount with this year.'
    if (!Number.isInteger(values[year]) || values[year] < 2026 || values[year] > 2040) {
      errors[year] = 'Enter a year from 2026 to 2040 with this amount.'
    }
  }
  if (['Delay', 'Accelerate'].includes(name)) checkPair(1, 2)
  if (name.startsWith('Farm ')) checkPair(3, 4)
  if (name.endsWith('Change $m')) { checkPair(0, 1, true); checkPair(2, 3) }
  if (name.startsWith('Truncate') && (!Number.isInteger(values[0]) || values[0] === 0)) errors[0] = 'Enter the year to retain the profile from or until.'
  return errors
}

export function configurationToApply(draft, previous = defaultCase()) {
  // Exclusion retains the last applied operation, even if the current draft is incomplete.
  if (!draft.include) return { ...previous, include: false, params: [...previous.params] }
  if (Object.keys(validateConfiguration(draft)).length) throw new Error('Invalid case configuration')
  const operation = findOperation(draft.operation)
  return {
    include: true,
    operation: draft.operation,
    params: Array.from({ length: 5 }, (_, index) => operation.inputs.some(input => input.position === index + 1) ? Number(draft.params[index] || 0) : 0),
  }
}

export function configurationSummary(config) {
  if (!config.include) return 'Excluded'
  const [first, second, third, fourth] = config.params
  const format = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })
  let detail = config.operation
  if (detail === 'No Change') detail = 'Reference profile'
  else if (['Delay', 'Accelerate'].includes(detail)) detail += `: ${format(first)} ${Number(first) === 1 ? 'year' : 'years'}`
  else if (detail.startsWith('Farm ') || detail.endsWith('Change %')) detail += `: ${format(first * 100)}%`
  else if (detail.startsWith('Truncate')) detail += `: ${first}`
  else if (detail.endsWith('Change $m')) detail += `: ${format(first)} in ${second}${third ? `; ${format(third)} in ${fourth}` : ''}`
  return `Included · ${detail}`
}

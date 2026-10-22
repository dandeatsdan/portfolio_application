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

export function parameterRule(name, position) {
  const timing = ['Delay', 'Accelerate'].includes(name)
  const scale = ['Farm In (Increase)', 'Farm Down (Dilution)'].includes(name)
  const percent = ['Production Change %', 'OPEX Change %', 'CAPEX Change %'].includes(name)
  const absolute = ['CAPEX Change $m', 'OPEX Change $m'].includes(name)
  if (timing && position === 1) return { kind: 'shift', hint: 'Zero or a positive whole number of years.' }
  if ((timing && position === 3) || (scale && position === 5) ||
      (absolute && [2, 4].includes(position)) || name.startsWith('Truncate') ||
      ((scale || percent) && [2, 3].includes(position))) {
    const optionalBound = (scale || percent) && [2, 3].includes(position)
    return { kind: 'year', optionalBound, hint: `Whole year: 2026–2040.${optionalBound ? ' Leave blank or enter 0 to use the default bound.' : ''}` }
  }
  if ((scale || percent) && position === 1) return { kind: 'fraction', hint: 'Enter a fraction: 0.10 = 10%.', min: name === 'Farm Down (Dilution)' || scale ? 0 : -1, max: name === 'Farm Down (Dilution)' ? 1 : Infinity }
  return { kind: 'amount', positive: !absolute, hint: absolute ? 'Non-zero $m: positive adds spending; negative reduces it.' : `Positive $m amount (${name === 'Farm Down (Dilution)' ? 'cash inflow' : 'cash outflow'}). Leave the amount and year blank for no transaction.` }
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
    const value = values[index]
    const rule = parameterRule(operation.name, input.position)
    if (String(raw ?? '').trim() === '') {
      if (input.required) errors[index] = 'Enter a value.'
      continue
    }
    if (!Number.isFinite(value)) errors[index] = 'Enter a finite number.'
    else if (rule.kind === 'year' && !(!input.required && value === 0) &&
      (!Number.isInteger(value) || value < 2026 || value > 2040)) errors[index] = 'Enter a whole year from 2026 to 2040.'
    else if (rule.kind === 'shift' && (!Number.isInteger(value) || value < 0)) errors[index] = rule.hint
    else if (rule.kind === 'fraction' && (value < rule.min || value > rule.max)) errors[index] = rule.min === -1 ? 'A reduction cannot exceed 100% (-1).' : rule.max === 1 ? 'Enter a fraction from 0 to 1.' : 'Enter zero or a positive fraction.'
    else if (rule.kind === 'amount' && rule.positive && value < 0) errors[index] = 'Enter a positive amount.'
  }
  const name = draft.operation
  if ((name.startsWith('Farm ') || name.endsWith('Change %')) && values[1] && values[2] && values[1] > values[2]) errors[2] = 'End year must be on or after start year.'
  function checkPair(amount, year, required = false) {
    if (!required && !values[amount] && !values[year]) return
    if (!values[amount]) errors[amount] = 'Enter a non-zero amount with this year.'
    if (!Number.isInteger(values[year]) || values[year] < 2026 || values[year] > 2040) errors[year] = 'Enter a year from 2026 to 2040 with this amount.'
  }
  if (['Delay', 'Accelerate'].includes(name)) checkPair(1, 2)
  if (name.startsWith('Farm ')) checkPair(3, 4)
  if (name.endsWith('Change $m')) { checkPair(0, 1, true); checkPair(2, 3) }
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

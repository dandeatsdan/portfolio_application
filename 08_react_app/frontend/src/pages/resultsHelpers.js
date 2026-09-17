import { OPERATION_LABELS, buildScenarioInstructions } from '../hooks/scenarioInstructions.js'
import { configurationOperations, parameterRule } from '../components/caseConfigUtils.js'
import { REFERENCE_PERIODS, NPV_METRIC } from './referenceMeasures.js'

export const KPI_TITLES = ['Cumulative Production', 'Cumulative Cash Capex', 'Cumulative Post-Tax RCOP', 'Cumulative Post-Tax Free Cash Flow']
export const BREAKDOWNS = { plan_type: 'Plan Type', group_entity: 'Group Entity', region: 'Region', country: 'Country', case_name: 'Case' }
export const DEFAULT_RESULTS_SETTINGS = {
  primary: 'current', comparison: '', yearFrom: 2026, yearTo: 2040,
  plot1: { metric: 'Total Production (mboed)', breakdown: 'region' },
  plot2: { metric: 'Post-Tax Cash Flow', breakdown: 'region' },
  plot3: { metric: 'Cash Capex', breakdown: 'region' },
  changes: { metric: 'Post-Tax Cash Flow', period: 'full' },
}
export const copySettings = settings => structuredClone(settings)
export function settingsError(settings) {
  if (!Number.isInteger(settings.yearFrom) || !Number.isInteger(settings.yearTo) || settings.yearFrom < 2026 || settings.yearTo > 2040 || settings.yearFrom > settings.yearTo) return 'Choose an ordered year range within 2026–2040.'
  if (settings.primary === settings.comparison) return 'Choose a different comparison scenario.'
  if (settings.changes.metric === NPV_METRIC && settings.changes.period === 'average') return 'NPV requires a total period.'
  if (!REFERENCE_PERIODS.some(p => p.value === settings.changes.period)) return 'Choose an impact period.'
  return null
}
export function waterfallPositions(rows) {
  let running = 0
  return rows.map(row => {
    const start = row.type === 'absolute' ? 0 : running
    const end = row.type === 'absolute' ? row.value : running + row.value
    running = end
    return { ...row, start, end, range: [Math.min(start, end), Math.max(start, end)] }
  })
}
const ENGINE_LABELS = Object.fromEntries(OPERATION_LABELS.map(operation => [buildScenarioInstructions([{ id: 1 }], new Set([1]), { 1: { include: true, operation, params: [] } })[0].operation, operation]))
export function changeRows(instructions, cases) {
  const names = new Map(cases.map(c => [c.id, c.case_name]))
  return instructions.filter(row => !row.include || !['NoChange', 'No Change'].includes(row.operation)).map(row => {
    if (!row.include) return { id: row.id, name: names.get(row.id) ?? row.case, change: 'Excluded', detail: 'Removed from scenario' }
    const label = ENGINE_LABELS[row.operation] ?? row.operation
    const operation = configurationOperations.find(op => op.name === label)
    const detail = (operation?.inputs ?? []).flatMap(input => {
      const value = row[`param${input.position}`]
      if (!input.required && !value) return []
      const kind = parameterRule(label, input.position).kind
      const displayLabel = input.label.replace(' (as fraction)', '')
      return [`${displayLabel}: ${kind === 'fraction' ? `${Number(value * 100).toLocaleString()}%` : Number(value).toLocaleString()}`]
    }).join(' · ')
    return { id: row.id, name: names.get(row.id) ?? row.case, change: label, detail }
  })
}

export async function runSavedDefinition(id, cases, api) {
  const saved = await api.get(id)
  if (saved.validation_errors?.length) throw Error(saved.validation_errors.map(e => `Case ${e.ID}: ${e.message}`).join('; '))
  const instructions = buildScenarioInstructions(cases, new Set(saved.shortlisted_case_ids), saved.case_configurations)
  const result = await api.run({ scenario_name: saved.name, scenario_description: saved.description, rationale: saved.rationale, instructions })
  if (!result.valid) throw Error('The saved scenario did not produce valid results.')
  return { ...result, savedScenarioId: id }
}

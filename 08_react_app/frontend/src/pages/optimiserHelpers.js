import { compareTableValues } from '../utils/tableSort.js'

export const YEARS = Array.from({ length: 15 }, (_, i) => 2026 + i)
export const DEFAULT_OPTIMISER = { year_from: 2026, year_to: 2040, constraints: [], mandatory_case_ids: [], excluded_case_ids: [] }
export const constraintUnit = c => c.metric === 'capex' ? '$m' : c.basis === 'each_year' ? 'mboed' : 'mmboe'
export const newConstraint = id => ({ id, metric: 'capex', basis: 'total', year_from: 2026, year_to: 2028, operator: 'max', target: '', flexibility_pct: 0 })

export function optimiserRequest(draft) {
  const year = value => Number.isInteger(Number(value)) && Number(value) >= 2026 && Number(value) <= 2040
  if (!year(draft.year_from) || !year(draft.year_to) || Number(draft.year_from) > Number(draft.year_to)) throw new Error('Choose an ordered objective period between 2026 and 2040.')
  const constraints = draft.constraints.map((c, i) => {
    if (!year(c.year_from) || !year(c.year_to) || Number(c.year_from) > Number(c.year_to)) throw new Error(`Constraint ${i + 1}: check the year range.`)
    if (String(c.target).trim() === '' || !Number.isFinite(Number(c.target)) || Number(c.target) < 0 || Number(c.target) > 1e12) throw new Error(`Constraint ${i + 1}: enter a nonnegative target up to 1 trillion.`)
    if (String(c.flexibility_pct).trim() === '' || !Number.isInteger(Number(c.flexibility_pct)) || Number(c.flexibility_pct) < 0 || Number(c.flexibility_pct) > 15) throw new Error(`Constraint ${i + 1}: flexibility must be a whole percentage from 0 to 15.`)
    if (Number(c.target) === 0 && Number(c.flexibility_pct)) throw new Error(`Constraint ${i + 1}: a zero target must remain strict.`)
    return { ...c, year_from: Number(c.year_from), year_to: Number(c.year_to), target: Number(c.target), flexibility_pct: Number(c.flexibility_pct) }
  })
  return { ...draft, year_from: Number(draft.year_from), year_to: Number(draft.year_to), constraints, objective: 'post_tax_npv' }
}

export function recommendationDefinition(result, request) {
  if (result.status !== 'optimal' || !result.reconciled || !result.selected_case_ids.length) throw new Error('A checked, nonempty recommendation is required.')
  return { schema_version: 1, name: 'Optimised portfolio', description: `Maximise post-tax NPV, ${request.year_from}–${request.year_to}, 8% fixed-2026 basis.`,
    rationale: [
      `Optimiser recommendation: ${result.relaxation_pct ? `flexibility step ${result.relaxation_pct}%` : 'original constraints satisfied'}.`,
      'Scope: all reference cases, with include/exclude decisions only.',
      ...request.constraints.map(c => `${c.metric === 'capex' ? 'Cash Capex' : 'Production'} ${c.operator === 'max' ? 'maximum' : 'minimum'}: ${c.target} ${constraintUnit(c)}, ${c.year_from}–${c.year_to} (${c.basis === 'total' ? 'total' : 'every year'}); ${c.flexibility_pct ? `up to ${c.flexibility_pct}% flexibility` : 'strict'}.`),
      ...['mandatory_case_ids', 'excluded_case_ids'].filter(key => request[key].length).map(key => `${key === 'mandatory_case_ids' ? 'Required' : 'Excluded'} cases: ${request[key].map(id => result.cases?.find(c => c.id === id)?.name ?? `ID ${id}`).join(', ')}.`),
      ...result.constraint_checks.map(c => `${c.metric === 'capex' ? 'Cash Capex' : 'Production'} ${c.year_from}–${c.year_to}: achieved ${c.actual} ${c.unit}; permitted limit ${c.adjusted_target} ${c.unit}.`),
    ].join('\n'),
    shortlisted_case_ids: [...result.excluded_case_ids],
    case_configurations: Object.fromEntries(result.excluded_case_ids.map(id => [id, { include: false, operation: 'No Change', params: [0, 0, 0, 0, 0] }])) }
}

// Keep the recommendation together; column sorting applies within each group.
export function sortRecommendedCases(rows, sort = null) {
  return [...rows].sort((a, b) => Number(b.selected) - Number(a.selected)
    || (sort ? compareTableValues(a[sort.key], b[sort.key], ['npv', 'capex', 'production'].includes(sort.key), sort.direction) : 0))
}

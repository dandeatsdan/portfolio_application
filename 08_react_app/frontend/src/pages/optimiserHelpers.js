export const YEARS = Array.from({ length: 15 }, (_, i) => 2026 + i)

export const DEFAULT_OPTIMISER = {
  year_from: 2026,
  year_to: 2040,
  constraints: [],
  mandatory_case_ids: [],
  excluded_case_ids: [],
  objective: 'post_tax_fcf',  // 'post_tax_fcf' | 'underlying_rcop' | 'production'
  mode: 'full',               // 'full' | 'guided' | 'balanced'
  group_entity_mix: { enabled: false, metric: 'production', sliders: {} },
  region_mix:       { enabled: false, metric: 'production', sliders: {} },
  region_locks:       {},  // { [regionValue]: 'optional' | 'mandatory' | 'excluded' }
  group_entity_locks: {},  // { [groupEntityValue]: 'optional' | 'mandatory' | 'excluded' }
}

export function newConstraint(id) {
  return { id, metric: 'capex', basis: 'total', year_from: 2026, year_to: 2028, operator: 'max', target: '', flexibility_pct: 0 }
}

export function constraintUnit(c) {
  if (c.metric === 'capex') return '$m'
  return c.basis === 'total' ? 'mmboe' : 'mboed'
}

// Build reference totals { production: { group_entity: {Gas: N, ...}, region: {R: N, ...} }, capex: {...} }
// prodRows / capexRows are arrays of { id, value } from getReferenceMeasure
export function buildReferenceTotals(cases, prodRows, capexRows) {
  const byId = id => cases.find(c => c.id === id)
  const group = (rows, dimField) => {
    const totals = {}
    for (const { id, value } of rows) {
      const c = byId(id)
      if (!c) continue
      const dim = c[dimField] || 'Unknown'
      totals[dim] = (totals[dim] || 0) + (value || 0)
    }
    return totals
  }
  return {
    production: { group_entity: group(prodRows, 'group_entity'), region: group(prodRows, 'region') },
    capex:      { group_entity: group(capexRows, 'group_entity'), region: group(capexRows, 'region') },
  }
}

// Initialise sliders for a given dimension from distinct values in cases
export function initSliders(cases, dimField) {
  const values = [...new Set(cases.map(c => c[dimField]).filter(Boolean))]
  return Object.fromEntries(values.map(v => [v, 0]))
}

// Pre-populate sliders from reference proportions, forcing sum = 100
export function prePopulateBalancedMix(cases, referenceTotals) {
  const populate = (dimField, metric) => {
    const totalsMap = referenceTotals[metric][dimField]
    const grandTotal = Object.values(totalsMap).reduce((a, b) => a + b, 0)
    const values = [...new Set(cases.map(c => c[dimField]).filter(Boolean))]
    const raw = values.map(v => ({ v, pct: grandTotal > 0 ? Math.round(((totalsMap[v] || 0) / grandTotal) * 100) : 0 }))
    // Adjust largest to force sum to exactly 100
    const sum = raw.reduce((a, b) => a + b.pct, 0)
    const delta = 100 - sum
    if (delta !== 0 && raw.length > 0) {
      const largest = raw.reduce((a, b) => b.pct > a.pct ? b : a)
      largest.pct = largest.pct + delta
    }
    return Object.fromEntries(raw.map(({ v, pct }) => [v, pct]))
  }
  return {
    group_entity_mix: { enabled: true, metric: 'production', sliders: populate('group_entity', 'production') },
    region_mix:       { enabled: true, metric: 'production', sliders: populate('region', 'production') },
  }
}

export function mixTotal(sliders) {
  return Object.values(sliders).reduce((a, b) => a + Number(b), 0)
}

export function runGateBlocked(draft) {
  if (draft.group_entity_mix.enabled && Math.round(mixTotal(draft.group_entity_mix.sliders)) !== 100) return true
  if (draft.region_mix.enabled && Math.round(mixTotal(draft.region_mix.sliders)) !== 100) return true
  return false
}

// Expand mix sections into absolute Constraint objects with case_ids
function expandMixConstraints(draft, cases, referenceTotals) {
  if (!referenceTotals) return []
  const derived = []
  const sections = [
    ['group_entity', draft.group_entity_mix],
    ['region', draft.region_mix],
  ]
  for (const [dimField, section] of sections) {
    if (!section.enabled) continue
    const metric = section.metric
    const refByDim = referenceTotals[metric][dimField] || {}
    for (const [dimValue, pct] of Object.entries(section.sliders)) {
      const refTotal = refByDim[dimValue] || 0
      const absoluteTarget = (Number(pct) / 100) * Math.abs(refTotal)
      const filteredIds = cases.filter(c => c[dimField] === dimValue).map(c => c.id)
      derived.push({
        id: `mix_${dimField}_${dimValue.replace(/\W+/g, '_')}`,
        metric,
        basis: 'total',
        year_from: Number(draft.year_from),
        year_to: Number(draft.year_to),
        operator: 'min',
        target: absoluteTarget,
        flexibility_pct: 0,
        case_ids: filteredIds,
      })
    }
  }
  return derived
}

// Expand group/region locks to { mandatory: [ids], excluded: [ids] }
function expandGroupLocks(locks, cases, dimField) {
  const mandatory = [], excluded = []
  for (const [dimValue, state] of Object.entries(locks)) {
    const ids = cases.filter(c => c[dimField] === dimValue).map(c => c.id)
    if (state === 'mandatory') mandatory.push(...ids)
    else if (state === 'excluded') excluded.push(...ids)
  }
  return { mandatory, excluded }
}

export function optimiserRequest(draft, cases = [], referenceTotals = null) {
  if (Number(draft.year_from) > Number(draft.year_to)) throw new Error('Start year must not exceed end year')

  // Expand mix constraints
  const mixConstraints = expandMixConstraints(draft, cases, referenceTotals)

  // Expand region and group entity locks
  const regionExpanded = expandGroupLocks(draft.region_locks || {}, cases, 'region')
  const entityExpanded = expandGroupLocks(draft.group_entity_locks || {}, cases, 'group_entity')

  // Merge: start from lock-expanded IDs, then let individual overrides win
  const lockMandatory = new Set([...regionExpanded.mandatory, ...entityExpanded.mandatory])
  const lockExcluded  = new Set([...regionExpanded.excluded,  ...entityExpanded.excluded])

  // Individual overrides win over group locks
  for (const id of draft.mandatory_case_ids) { lockMandatory.add(id); lockExcluded.delete(id) }
  for (const id of draft.excluded_case_ids)  { lockExcluded.add(id);  lockMandatory.delete(id) }

  const mandatoryIds = [...lockMandatory]
  const excludedIds  = [...lockExcluded]

  // Validate no conflict remains
  const conflict = mandatoryIds.filter(id => excludedIds.includes(id))
  if (conflict.length) {
    const names = conflict.map(id => { const c = cases.find(x => x.id === id); return c ? c.case_name : `ID ${id}` })
    throw new Error(`Conflicting controls — the following cases are both required and excluded: ${names.join(', ')}. Resolve in case controls.`)
  }

  const allConstraints = [
    ...draft.constraints.map(c => ({ ...c, target: Number(c.target) })),
    ...mixConstraints,
  ]

  return {
    objective: draft.objective || 'post_tax_fcf',
    year_from: Number(draft.year_from),
    year_to:   Number(draft.year_to),
    constraints: allConstraints,
    mandatory_case_ids: mandatoryIds,
    excluded_case_ids:  excludedIds,
  }
}

const OBJECTIVE_LABELS = {
  post_tax_fcf:    'Free Cash Flow maximisation',
  underlying_rcop: 'Underlying RCOP maximisation',
  production:      'Production maximisation',
}

export function recommendationDefinition(result, request) {
  if (!result?.selected_case_ids?.length) throw new Error('No cases were recommended')
  const selectedSet = new Set(result.selected_case_ids)
  const excluded = result.cases.filter(c => !selectedSet.has(c.id))
  const objLabel = OBJECTIVE_LABELS[request.objective] || 'Post-tax FCF maximisation'
  return {
    scenarioName: 'Optimiser Recommendation',
    scenarioDescription: `${objLabel} · ${request.year_from}–${request.year_to} · ${result.selected_case_ids.length} cases selected`,
    excludedCaseIds: excluded.map(c => c.id),
  }
}

export function sortRecommendedCases(cases, sort) {
  if (!cases.length) return cases
  const sorted = [...cases].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    if (!sort) return 0
    const av = a[sort.key], bv = b[sort.key]
    if (typeof av === 'string') return sort.direction === 'ascending' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sort.direction === 'ascending' ? av - bv : bv - av
  })
  return sorted
}

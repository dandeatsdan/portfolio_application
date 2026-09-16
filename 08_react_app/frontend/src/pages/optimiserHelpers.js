import { defaultCase } from '../hooks/scenarioInstructions.js'

export const YEARS = Array.from({ length: 15 }, (_, i) => 2026 + i)
export const OBJECTIVES = [
  { key: 'post_tax_npv', label: 'Post-tax NPV', description: 'Maximise post-tax cash flow discounted at 8%, using the fixed 2026 basis.', unit: '$m' },
  { key: 'post_tax_fcf', label: 'Free Cash Flow', description: 'Maximise the undiscounted sum of post-tax free cash flow.', unit: '$m' },
  { key: 'underlying_rcop', label: 'Underlying RCOP', description: 'Maximise the undiscounted sum of Underlying RCOP, before tax.', unit: '$m' },
  { key: 'production', label: 'Production', description: 'Maximise cumulative production over the selected years, in mmboe.', unit: 'mmboe' },
]
export const DEFAULT_OPTIMISER = {
  year_from: 2026, year_to: 2040, objective: 'post_tax_npv',
  constraints: [], region_rules: {}, country_rules: {}, case_rules: {}, plan_type_rules: {},
  use_priorities: false,
  group_entity_mix: { enabled: false, tolerance: 5, sliders: {} },
  region_mix: { enabled: false, tolerance: 5, sliders: {} },
  timing: { delay_enabled: false, acceleration_enabled: false, max_delay_years: 2, max_acceleration_years: 2 },
}

export const hasMixTargets = draft => draft.group_entity_mix.enabled || draft.region_mix.enabled

export function clearPortfolioControls(shares) {
  return {
    region_rules: {}, country_rules: {}, case_rules: {}, plan_type_rules: {}, use_priorities: false,
    group_entity_mix: { ...DEFAULT_OPTIMISER.group_entity_mix, sliders: shares?.group_entity ?? {} },
    region_mix: { ...DEFAULT_OPTIMISER.region_mix, sliders: shares?.region ?? {} },
    timing: { ...DEFAULT_OPTIMISER.timing },
  }
}

export function newConstraint(id) {
  return { id, metric: 'capex', basis: 'total', year_from: 2026, year_to: 2028, operator: 'max', target: '', flexibility_pct: 0, target_basis: 'absolute', relative_pct: 0, priority: 2, weight: 1 }
}

export function constraintUnit(c) {
  return c.metric !== 'production' ? '$m' : c.basis === 'total' ? 'mmboe' : 'mboed'
}

export const dimensionValue = value => value || 'Unknown'
export const countryRuleKey = (region, country) => JSON.stringify([dimensionValue(region), dimensionValue(country)])
export const CONTROL_LABELS = { optional: 'Allow to be modelled', reference: 'Keep as per reference', mandatory: 'Included', excluded: 'Exclude', conflict: 'Conflicting rules' }
export const METRIC_LABELS = { capex: 'Cash Capex', production: 'Production', post_tax_fcf: 'Free Cash Flow' }
export const planTypeValue = value => value || 'Unspecified'

export function effectiveCaseControl(draft, c) {
  const explicit = draft.case_rules?.[c.id]
  if (explicit) return { rule: explicit, source: 'Case' }
  const country = draft.country_rules?.[countryRuleKey(c.region, c.country)]
  const geography = country ?? draft.region_rules?.[dimensionValue(c.region)] ?? 'optional'
  const plan = draft.plan_type_rules?.[planTypeValue(c.plan_type)] ?? 'optional'
  const source = country ? 'Country' : 'Region'
  if (plan === 'optional') return { rule: geography, source: geography === 'optional' ? 'Default / geography' : source }
  if (geography === 'optional' || geography === plan) return { rule: plan, source: geography === plan ? `${source} + Plan type` : 'Plan type' }
  if ([plan, geography].every(r => ['mandatory', 'reference'].includes(r))) return { rule: 'reference', source: `${source} + Plan type` }
  return { rule: 'conflict', source: `${source} + Plan type` }
}

export const effectiveCaseRule = (draft, c) => effectiveCaseControl(draft, c).rule

export function excludedRegionRules(draft, cases) {
  const regions = [...new Set(cases.map(c => dimensionValue(c.region)))]
  return Object.fromEntries(regions.filter(region => cases.filter(c => dimensionValue(c.region) === region)
    .every(c => effectiveCaseRule(draft, c) === 'excluded')).map(region => [region, 'excluded']))
}

export function changeControlRules(draft, cases, update, referenceShares = {}) {
  const next = { ...draft, ...update }
  const before = excludedRegionRules(draft, cases), after = excludedRegionRules(next, cases)
  let shares = draft.region_mix.sliders
  for (const region of Object.keys(before)) {
    if (!after[region] && Object.hasOwn(shares, region)) {
      shares = changeMixShare(shares, region, referenceShares[region] ?? 0, Object.keys(after))
    }
  }
  return { ...update, region_mix: { ...draft.region_mix, sliders: excludeRegionShares(shares, after) } }
}
export const mixTotal = sliders => Object.values(sliders).reduce((sum, v) => sum + Number(v), 0)

// Round to hundredths without changing the 100% total.
function allocate(weights, total = 100) {
  const entries = Object.entries(weights)
  if (!entries.length) return {}
  const sum = mixTotal(weights)
  const units = Math.round(total * 100)
  const rows = entries.map(([key, value]) => {
    const exact = units * (sum > 0 ? value / sum : 1 / entries.length)
    return { key, units: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = units - rows.reduce((n, r) => n + r.units, 0)
  const ranked = [...rows].sort((a, b) => b.remainder - a.remainder)
  for (const row of ranked) { if (remaining-- > 0) row.units++ }
  return Object.fromEntries(rows.map(r => [r.key, r.units / 100]))
}

export function referenceMix(cases, rows) {
  const values = new Map(rows.map(r => [r.id, r.value]))
  const result = {}
  for (const dimension of ['group_entity', 'region']) {
    const totals = {}
    for (const c of cases) {
      // The reference endpoint returns null when this case has no metric rows
      // in the period. It contributes zero, just like the solver's sums.
      const value = values.get(c.id) === null ? 0 : values.get(c.id)
      if (!Number.isFinite(value) || value < 0) throw new Error('Reference production is missing or invalid for a case.')
      const key = dimensionValue(c[dimension])
      totals[key] = (totals[key] || 0) + value
    }
    if (mixTotal(totals) <= 0) throw new Error('Mix targets need positive production in the selected period.')
    result[dimension] = allocate(totals)
  }
  return result
}

export function excludeRegionShares(sliders, rules) {
  const available = Object.fromEntries(Object.entries(sliders).filter(([key]) => rules[key] !== 'excluded'))
  const adjusted = allocate(available)
  return Object.fromEntries(Object.keys(sliders).map(key => [key, adjusted[key] ?? 0]))
}

export function changeMixShare(sliders, key, value, excluded = []) {
  const locked = new Set(excluded)
  const others = Object.fromEntries(Object.entries(sliders).filter(([k]) => k !== key && !locked.has(k)))
  const target = Object.keys(others).length ? Math.min(100, Math.max(0, Number(value))) : 100
  const adjusted = allocate(others, 100 - target)
  return Object.fromEntries(Object.keys(sliders).map(k => [k, locked.has(k) ? 0 : k === key ? target : adjusted[k]]))
}

export function runGateBlocked(draft) {
  return timingBlocked(draft) || [draft.group_entity_mix, draft.region_mix].some(s => s.enabled && (
    !Object.keys(s.sliders).length || Math.abs(mixTotal(s.sliders) - 100) > 1e-6 ||
    Object.values(s.sliders).some(v => !Number.isFinite(Number(v)) || v < 0 || v > 100) ||
    s.tolerance === '' || !Number.isFinite(Number(s.tolerance)) || s.tolerance < 0 || s.tolerance > 100
  ))
}

export function timingLimit(draft, direction) {
  const timing = draft.timing ?? {}
  return (timing[`${direction}_enabled`] ?? timing.enabled) ? Number(timing[`max_${direction}_years`]) : 0
}

export function timingBlocked(draft) {
  const timing = draft.timing ?? {}
  const directions = ['delay', 'acceleration'].filter(d => timing[`${d}_enabled`] ?? timing.enabled)
  if (!directions.length) return false
  return directions.some(d => {
    const v = timing[`max_${d}_years`]
    return String(v ?? '').trim() === '' || !Number.isInteger(Number(v)) || v < (typeof timing[`${d}_enabled`] === 'boolean' ? 1 : 0) || v > 14
  }) || directions.every(d => timingLimit(draft, d) === 0)
}

export function timingLabel(c) {
  if (!c.selected) return '—'
  if (c.year_shift) {
    const years = Math.abs(c.year_shift)
    return `${c.year_shift > 0 ? 'Delay' : 'Accelerate'} ${years} ${years === 1 ? 'year' : 'years'}`
  }
  if (!c.operation || c.operation === 'NoChange') return 'Unchanged'
  return 'Unchanged'
}

export function constraintPeriodColumns(checks = [], constraints = []) {
  return checks.map(check => {
    const number = constraints.findIndex(c => c.id === check.id) + 1
    const period = check.year_from === check.year_to ? check.year_from : `${check.year_from}–${check.year_to}`
    return { key: JSON.stringify([check.id, check.year_from, check.year_to]),
      label: `C${number}: ${METRIC_LABELS[check.metric]} · ${period} (${check.unit})`,
      numeric: true, width: 160, constraint: true }
  })
}

export function caseConstraintValues(c) {
  return Object.fromEntries((c.constraint_contributions ?? []).map(v => [JSON.stringify([v.id, v.year_from, v.year_to]), v.value]))
}

function validPeriod(from, to) {
  return YEARS.includes(Number(from)) && YEARS.includes(Number(to)) && Number(from) <= Number(to)
}

export function optimiserRequest(draft) {
  if (!OBJECTIVES.some(o => o.key === draft.objective)) throw new Error('Choose a supported objective.')
  if (!validPeriod(draft.year_from, draft.year_to)) throw new Error('Choose an ordered period within 2026–2040.')
  if (timingBlocked(draft)) throw new Error('Timing limits must be whole years from 0 to 14, with at least one direction enabled.')
  if (runGateBlocked(draft)) throw new Error('Mix targets must total 100%, with a tolerance between 0 and 100 percentage points.')
  const constraints = draft.constraints.map(c => {
    if (draft.use_priorities && (!Number.isInteger(Number(c.priority ?? 2)) || Number(c.priority ?? 2) < 1 || Number(c.priority ?? 2) > 3 || !Number.isFinite(Number(c.weight ?? 1)) || Number(c.weight ?? 1) <= 0 || Number(c.weight ?? 1) > 100)) throw new Error('Constraint priorities must be 1–3 and weights above 0 and at most 100.')
    const relative = c.target_basis === 'relative'
    const target = relative ? 0 : Number(c.target), flexibility = Number(c.flexibility_pct)
    if ((!relative && String(c.target).trim() === '') || !Number.isFinite(target) || (target < 0 && c.metric !== 'post_tax_fcf') || Math.abs(target) > 1e12 ||
        !validPeriod(c.year_from, c.year_to) || !Number.isInteger(flexibility) || flexibility < 0 || flexibility > 15 ||
        (!relative && target === 0 && flexibility > 0)) throw new Error('Check constraint targets, periods and flexibility. Zero targets must stay strict.')
    if (relative && (String(c.relative_pct).trim() === '' || !Number.isFinite(Number(c.relative_pct)) || c.relative_pct < -100 || c.relative_pct > 10000 || (Number(c.relative_pct) === -100 && flexibility))) throw new Error('Reference adjustment must be from −100% to +10,000%; a zero target must stay strict.')
    return { ...c, target, relative_pct: Number(c.relative_pct ?? 0), priority: draft.use_priorities ? Number(c.priority ?? 2) : 2, weight: draft.use_priorities ? Number(c.weight ?? 1) : 1, flexibility_pct: flexibility, year_from: Number(c.year_from), year_to: Number(c.year_to) }
  })
  const mixConstraints = []
  for (const dimension of ['group_entity', 'region']) {
    const section = draft[`${dimension}_mix`]
    if (section.enabled) for (const [value, target] of Object.entries(section.sliders)) {
      mixConstraints.push({ dimension, value, target_share_pct: Number(target), tolerance_pct_points: Number(section.tolerance) })
    }
  }
  return {
    // The existing API's mix contract accepts optional controls, including none.
    objective: draft.objective, mode: 'mix',
    max_delay_years: timingLimit(draft, 'delay'),
    max_acceleration_years: timingLimit(draft, 'acceleration'),
    use_priorities: draft.use_priorities ?? false,
    plan_type_rules: Object.entries(draft.plan_type_rules ?? {}).map(([plan_type, rule]) => ({ plan_type, rule })),
    year_from: Number(draft.year_from), year_to: Number(draft.year_to), constraints,
    mandatory_case_ids: [], excluded_case_ids: [],
    mix_constraints: mixConstraints,
    region_rules: Object.entries(draft.region_rules).filter(([, rule]) => rule !== 'optional').map(([region, rule]) => ({ region, rule })),
    country_rules: Object.entries(draft.country_rules ?? {}).map(([key, rule]) => {
      const [region, country] = JSON.parse(key)
      return { region, country, rule }
    }),
    case_rules: Object.entries(draft.case_rules ?? {}).map(([case_id, rule]) => ({ case_id: Number(case_id), rule })),
  }
}

export function recommendationDefinition(result, request) {
  if (result?.status !== 'optimal' || !result.reconciled || !result.selected_case_ids?.length) {
    throw new Error('Only a verified, nonempty recommendation can become a scenario.')
  }
  const excluded = result.excluded_case_ids
  if (!Array.isArray(excluded)) throw new Error('Recommendation exclusions are missing.')
  const objective = OBJECTIVES.find(o => o.key === request.objective)
  if (!objective) throw new Error('Recommendation objective is unsupported.')
  const shifted = (result.cases ?? []).filter(c => c.selected && c.year_shift)
  for (const c of shifted) {
    const max = c.year_shift > 0 ? request.max_delay_years : request.max_acceleration_years
    if (!Number.isInteger(c.year_shift) || Math.abs(c.year_shift) > (max ?? 0)
        || c.operation !== (c.year_shift > 0 ? 'Delay' : 'Accelerate') || !result.selected_case_ids.includes(c.id)) {
      throw new Error('Recommendation timing is outside the permitted limits.')
    }
  }
  const rationale = [
    'Portfolio optimiser.',
    `${objective.label}: ${objective.description} Period ${request.year_from}–${request.year_to}.`,
    `Verified through the scenario engine. ${request.use_priorities ? 'Ordered constraint priorities' : `Flexibility step: ${result.relaxation_pct}%`}.`,
    `Timing limits: delay ${request.max_delay_years ?? 0} years; accelerate ${request.max_acceleration_years ?? 0} years. Pure year shifts; no penalty or additional acquisition/Capex costs.`,
    ...shifted.map(c => `Case ${c.id}: ${timingLabel(c)}; parameters ${JSON.stringify(c.params ?? [Math.abs(c.year_shift), 0, 0, 0, 0])}.`),
    ...(request.constraints ?? []).map(c => `${c.metric} ${c.operator} ${c.target_basis === 'relative' ? `${c.relative_pct}% relative to reference` : c.target} ${constraintUnit(c)}, ${c.year_from}–${c.year_to}, ${c.basis}; flexibility ${c.flexibility_pct}%; priority ${c.priority ?? 2}, weight ${c.weight ?? 1}.`),
    ...(result.constraint_checks ?? []).map(c => `Limit ${c.id} (${c.year_from}–${c.year_to}): reference ${c.reference_value ?? 'not recorded'}, requested ${c.target}, adjusted ${c.adjusted_target}, actual ${c.actual} ${c.unit}.`),
    ...(request.mix_constraints ?? []).map(c => `${c.dimension}: ${c.value}, production target ${c.target_share_pct}% ±${c.tolerance_pct_points} percentage points.`),
    'Control precedence: case overrides geography and plan type; country overrides region. Conflicting group rules require a case override. Reference locks stay unchanged.',
    ...(request.region_rules ?? []).map(r => `Region ${r.region}: ${CONTROL_LABELS[r.rule]} by default.`),
    ...(request.country_rules ?? []).map(r => `Country ${r.country} (${r.region}): ${CONTROL_LABELS[r.rule]}.`),
    ...(request.plan_type_rules ?? []).map(r => `Plan type ${r.plan_type}: ${CONTROL_LABELS[r.rule]}.`),
    ...(request.case_rules ?? []).map(r => `Case ${r.case_id}: ${CONTROL_LABELS[r.rule]}.`),
    `Required cases: ${(request.mandatory_case_ids ?? []).join(', ') || 'none'}. Excluded cases: ${(request.excluded_case_ids ?? []).join(', ') || 'none'}.`,
  ].join('\n')
  return {
    schema_version: 1, name: 'Optimiser Recommendation',
    description: `${objective.label} maximisation · ${request.year_from}–${request.year_to} · ${result.selected_case_ids.length} cases selected`,
    rationale, shortlisted_case_ids: [...excluded, ...shifted.map(c => c.id)],
    case_configurations: Object.fromEntries([
      ...excluded.map(id => [id, { ...defaultCase(), include: false }]),
      ...shifted.map(c => [c.id, { include: true, operation: c.operation, params: c.params ?? [Math.abs(c.year_shift), 0, 0, 0, 0] }]),
    ]),
  }
}

export function sortRecommendedCases(cases, sort) {
  return [...cases].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    if (!sort) return 0
    const av = a[sort.key], bv = b[sort.key]
    const comparison = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sort.direction === 'ascending' ? comparison : -comparison
  })
}

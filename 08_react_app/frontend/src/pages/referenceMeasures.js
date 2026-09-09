export const NPV_METRIC = 'Post-tax NPV'
export const PRODUCTION_METRIC = 'Total Production (mboed)'
export const REFERENCE_KEYS = ['reference', 'reference2', 'reference3']
export const DEFAULT_REFERENCES = [PRODUCTION_METRIC, 'Cash Capex', NPV_METRIC]
  .map(metric => ({ metric, period: 'full' }))
export const REFERENCE_PERIODS = [
  { value: 'full', label: 'Total 2026–2040', from: 2026, to: 2040 },
  { value: 'five', label: 'Total 2026–2030', from: 2026, to: 2030 },
  { value: 'average', label: 'Average 2026–2030', from: 2026, to: 2030, average: true },
  ...Array.from({ length: 15 }, (_, i) => ({ value: String(2026 + i), label: String(2026 + i), from: 2026 + i, to: 2026 + i })),
]

const METRIC_DISPLAY_NAMES = {
  'Post-tax NPV':               'NPV8 ($m)',
  'Total Production (mboed)':   'Production (mboed)',
  'Post-Tax Cash Flow':         'Post-Tax FCF',
  'Pre Tax Cash Flow':          'Pre-Tax FCF',
  'Total Cash Costs':           'Cash Costs',
}

export function metricDisplayName(metric) {
  return METRIC_DISPLAY_NAMES[metric] ?? metric
}

export function referenceLabel({ metric, period }) {
  const timeframe = REFERENCE_PERIODS.find(p => p.value === period)
  const name = metric === PRODUCTION_METRIC
    ? `Production (${timeframe.from !== timeframe.to && !timeframe.average ? 'mmboe' : 'mboed'})`
    : metricDisplayName(metric)
  return `${name} · ${timeframe.label}`
}

export function updateReference(reference, field, value) {
  const next = { ...reference, [field]: value }
  // NPV is the discounted sum for the selected period, never an average.
  if (next.metric === NPV_METRIC && next.period === 'average') next.period = 'five'
  return next
}

const KPI_METRICS = ['Total Production (mboed)', 'Cash Capex', 'Post-Tax RCOP', 'Post-Tax Cash Flow']

// Keep analytical signs intact. The server applies presentation conventions.
export function analysisRequest(payload) {
  const metrics = new Set(payload.kind === 'kpis' ? KPI_METRICS
    : [payload.metric === 'Post-tax NPV' ? 'Post-Tax Cash Flow' : payload.metric])
  const ids = payload.case_ids == null ? null : new Set(payload.case_ids)
  const select = rows => rows.filter(row => metrics.has(row.metric)
    && (ids === null || ids.has(row.id))
    && row.year >= payload.year_from && row.year <= payload.year_to)
  return { ...payload, baseline: select(payload.baseline), scenario: select(payload.scenario),
    comparison: payload.comparison == null ? null : select(payload.comparison) }
}

// Bounded, page-local cache also shares in-flight requests across effect replays.
export function createAnalysisLoader(fetchAnalysis, limit = 12) {
  const cache = new Map()
  return (key, payload) => {
    if (cache.has(key)) return cache.get(key)
    const pending = Promise.resolve().then(() => fetchAnalysis(payload))
    cache.set(key, pending)
    if (cache.size > limit) cache.delete(cache.keys().next().value)
    pending.catch(() => { if (cache.get(key) === pending) cache.delete(key) })
    return pending
  }
}

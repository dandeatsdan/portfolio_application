/**
 * Thin Axios wrapper for the FastAPI backend.
 * All paths are relative — Vite proxies /api → http://localhost:8000.
 */
import axios from 'axios'

const api = axios.create({ baseURL: '/' })

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.detail ?? err.message ?? 'Unknown error'
    return Promise.reject(new Error(msg))
  }
)

function filterParams(filters = {}) {
  const p = {}
  if (filters.yearFrom) p.year_from = filters.yearFrom
  if (filters.yearTo)   p.year_to   = filters.yearTo
  if (filters.planTypes?.length)     p.plan_types     = filters.planTypes.join(',')
  if (filters.groupEntities?.length) p.group_entities = filters.groupEntities.join(',')
  if (filters.segments?.length)      p.segments       = filters.segments.join(',')
  if (filters.regions?.length)       p.regions        = filters.regions.join(',')
  if (filters.countries?.length)     p.countries      = filters.countries.join(',')
  if (filters.caseNames?.length)     p.case_names     = filters.caseNames.join(',')
  return p
}

export const getCases         = () => api.get('/api/cases')
export const getFilterOptions = (filters) =>
  api.get('/api/filter_options', { params: filterParams(filters) })
export const getOperations = () => api.get('/api/operations')
export const getTotals     = () => api.get('/api/totals')
export const getMetrics    = () => api.get('/api/metrics')
export const getHealth     = () => api.get('/api/health')

export const getPortfolioKpis = (metrics, filters) =>
  api.get('/api/portfolio/kpis', {
    params: {
      metrics: metrics?.join(','),
      ...filterParams(filters),
    },
  })

export const getStacked = (metric, groupBy, filters) =>
  api.get(`/api/portfolio/stacked/${encodeURIComponent(metric)}`, {
    params: {
      ...(groupBy ? { group_by: groupBy } : {}),
      ...filterParams(filters),
    },
  })

export const getRanked = (metric, rankBy, topN, filters) =>
  api.get(`/api/portfolio/ranked/${encodeURIComponent(metric)}`, {
    params: {
      ...(rankBy ? { rank_by: rankBy } : {}),
      ...(topN   ? { top_n:   topN   } : {}),
      ...filterParams(filters),
    },
  })

export const getCreaming = (discountRate, filters, groupBy) =>
  api.get('/api/portfolio/creaming', {
    params: {
      discount_rate: discountRate ?? 8,
      ...(groupBy ? { group_by: groupBy } : {}),
      ...filterParams(filters),
    },
  })

export const getEntitySummary = (filters, discountRate = 8) =>
  api.get('/api/portfolio/entity_summary', {
    params: { discount_rate: discountRate, ...filterParams(filters) },
  })

export const runScenario  = (payload) => api.post('/api/scenario/run', payload)
export const getWaterfall = (payload) => api.post('/api/scenario/waterfall', payload)
export const getKpiDelta  = (payload) => api.post('/api/scenario/kpi-delta', payload)

export default api

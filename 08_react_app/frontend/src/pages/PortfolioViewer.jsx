/**
 * Portfolio Viewer
 */
import { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, LabelList,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import {
  getPortfolioKpis, getStacked, getRanked, getCreaming, getEntitySummary,
} from '../api/client'
import Select from '../components/Select'
import KpiCard from '../components/KpiCard'
import FilterRail from '../components/FilterRail'
import { SelectionContext, SidePanelContext, FiltersContext } from '../App'
import theme, { bp } from '../theme'
import { CASE_SUMMARY_COLUMNS, sortCaseSummaryRows } from './caseSummarySort'

// ─── constants ───────────────────────────────────────────────────────────────

const BP_GREEN   = '#007F00'
const PANEL_H    = 240          // fixed height for all chart/table panels

const PLAN_TYPE_BADGE = {
  'Main Plan':          { bg: '#003600', text: '#fff'     },
  'Selected':           { bg: '#8EDF00', text: '#003600'  },
  'Renewal ADP':        { bg: '#0089A8', text: '#fff'     },
  'Renewal Exploration':{ bg: '#0070FF', text: '#fff'     },
  'Manual':             { bg: '#14BFC8', text: '#003600'  },
}
function planTypeBadge(pt) {
  return PLAN_TYPE_BADGE[pt] ?? { bg: bp.warmGrey4, text: '#fff' }
}

const DIMENSION_OPTIONS = [
  { value: '',             label: 'None (total)'  },
  { value: 'plan_type',    label: 'Plan Type'     },
  { value: 'group_entity', label: 'Group Entity'  },
  { value: 'region',       label: 'Region'        },
  { value: 'country',      label: 'Country'       },
  { value: 'case_name',    label: 'Case'          },
]

const CREAM_DIM_OPTIONS = DIMENSION_OPTIONS.filter(o => o.value !== '')

const RANK_BY_OPTIONS = [
  { value: 'plan_type',    label: 'Plan Type'    },
  { value: 'group_entity', label: 'Group Entity' },
  { value: 'region',       label: 'Region'       },
  { value: 'country',      label: 'Country'      },
  { value: 'case_name',    label: 'Case'         },
]

const TOP_N_OPTIONS = [
  { value: '3',    label: 'Top 3'  },
  { value: '5',    label: 'Top 5'  },
  { value: '10',   label: 'Top 10' },
  { value: '9999', label: 'All'    },
]

const PROD_METRIC = 'Total Production (mboed)'
const KPI_METRICS = [PROD_METRIC, 'Cash Capex', 'Post-Tax RCOP', 'Post-Tax Cash Flow']
const DISCOUNT_RATE = 8
const NPV_METRIC = 'Post-tax NPV'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(v, dp = 0) {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: dp })
}
function fmtBn(v, dp = 1) {
  if (v == null) return '—'
  return (Number(v) / 1000).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function seriesColour(name, i) {
  if (!name || name === 'Total') return BP_GREEN
  return theme.chartPalette[i % theme.chartPalette.length]
}

// ─── shared sub-components ───────────────────────────────────────────────────


function ViewToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
      {['Area', 'Columns', 'Table'].map(v => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: '3px 8px', fontSize: 11, border: 'none', cursor: 'pointer',
          background: value === v ? bp.warmGrey5 : '#fff',
          color:      value === v ? '#fff' : 'var(--color-text)',
          fontWeight: value === v ? 600 : 400,
        }}>{v}</button>
      ))}
    </div>
  )
}

// ─── chart panel ─────────────────────────────────────────────────────────────

function ChartTableView({ data, seriesKeys }) {
  const years = [...new Set(data.map(r => r.Year))].sort()
  const pivot = {}
  data.forEach(r => {
    if (!pivot[r.Year]) pivot[r.Year] = {}
    pivot[r.Year][r.Series] = r.Value
  })
  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', position: 'sticky', top: 0, background: 'var(--color-surface)' }}>Year</th>
            {seriesKeys.map(k => (
              <th key={k} style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)', position: 'sticky', top: 0, background: 'var(--color-surface)', whiteSpace: 'nowrap' }}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map(y => (
            <tr key={y} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '4px 8px', fontWeight: 500 }}>{y}</td>
              {seriesKeys.map(k => (
                <td key={k} style={{ padding: '4px 8px', textAlign: 'right' }}>
                  {pivot[y]?.[k] != null ? Number(pivot[y][k]).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FlexChartPanel({ metrics, defaultMetric, filters }) {
  const [metric,  setMetric]  = useState(defaultMetric)
  const [groupBy, setGroupBy] = useState('')
  const [view,    setView]    = useState('Columns')
  const [data,    setData]    = useState([])

  useEffect(() => {
    getStacked(metric, groupBy, filters).then(setData).catch(() => setData([]))
  }, [metric, groupBy, filters])

  const seriesKeys = [...new Set(data.map(r => r.Series))].sort()
  const wide = {}
  data.forEach(r => {
    if (!wide[r.Year]) wide[r.Year] = { Year: r.Year }
    wide[r.Year][r.Series] = r.Value
  })
  const wideData = Object.values(wide).sort((a, b) => a.Year - b.Year)

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <Select value={metric}  onChange={setMetric}  options={metrics} style={{ maxWidth: 170 }} />
        <label style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Break down</label>
        <Select value={groupBy} onChange={setGroupBy} options={DIMENSION_OPTIONS} />
        <ViewToggle value={view} onChange={setView} />
      </div>

      {/* Fixed-height container — same for chart and table */}
      <div style={{ height: PANEL_H, overflow: 'hidden' }}>
        {view === 'Table' ? (
          <ChartTableView data={data} seriesKeys={seriesKeys} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {view === 'Area' ? (
              <AreaChart data={wideData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="Year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
                {seriesKeys.map((s, i) => (
                  <Area key={s} type="monotone" dataKey={s} stackId="1"
                    stroke={seriesColour(s, i)} fill={seriesColour(s, i)} fillOpacity={0.75}
                  />
                ))}
              </AreaChart>
            ) : (
              <BarChart data={wideData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="Year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
                {seriesKeys.map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="1"
                    fill={seriesColour(s, i)}
                    radius={i === seriesKeys.length - 1 ? [2, 2, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}


// ─── main page ────────────────────────────────────────────────────────────────

export default function PortfolioViewer() {
  const navigate = useNavigate()
  const { cases, metrics, loading, error } = usePortfolio()
  const { selectedIds: shortlistIds, setSelectedIds: setShortlistIds } = useContext(SelectionContext)
  const { setSidePanel } = useContext(SidePanelContext)
  const { filters, setFilters } = useContext(FiltersContext)

  const [kpis,          setKpis]          = useState([])
  const [rankedData,    setRankedData]    = useState([])
  const [rankBy,        setRankBy]        = useState('case_name')
  const [rankMetric,    setRankMetric]    = useState('Post-Tax Cash Flow')
  const [topN,          setTopN]          = useState('10')
  const [creamData,     setCreamData]     = useState([])
  const [creamGroupBy,  setCreamGroupBy]  = useState('case_name')
  const [entityRows,    setEntityRows]    = useState([])
  const [entityStatus,  setEntityStatus]  = useState('loading')
  const [entityRetry,   setEntityRetry]   = useState(0)
  const [entitySearch,  setEntitySearch]  = useState('')
  const [tableSort,     setTableSort]     = useState(null)
  const [chartSelection, setChartSelection] = useState(null)

  const DIM_TO_FIELD = {
    group_entity: 'Group Entity',
    region:       'Region',
    country:      'Country',
    case_name:    'Case Name',
    plan_type:    'Plan Type',
  }

  const selectChart = (dimension, value) =>
    setChartSelection(prev =>
      prev?.dimension === dimension && prev?.value === value ? null : { dimension, value }
    )

  const isChartHighlighted = (row) => {
    if (!chartSelection) return false
    const field = DIM_TO_FIELD[chartSelection.dimension]
    return field ? row[field] === chartSelection.value : false
  }

  // Register FilterRail
  useEffect(() => {
    setSidePanel(<FilterRail filters={filters} onChange={setFilters} cases={cases} />)
    return () => setSidePanel(null)
  }, [filters, cases, setSidePanel])

  useEffect(() => {
    getPortfolioKpis(KPI_METRICS, filters).then(setKpis).catch(() => setKpis([]))
  }, [filters])

  useEffect(() => {
    if (!rankMetric) return
    getRanked(rankMetric, rankBy, Number(topN), filters, DISCOUNT_RATE).then(setRankedData).catch(() => setRankedData([]))
  }, [rankMetric, rankBy, topN, filters])

  useEffect(() => {
    getCreaming(DISCOUNT_RATE, filters, creamGroupBy).then(setCreamData).catch(() => setCreamData([]))
  }, [filters, creamGroupBy])

  useEffect(() => {
    let active = true
    setEntityStatus('loading')
    setEntityRows([])
    getEntitySummary(filters, DISCOUNT_RATE)
      .then(rows => {
        if (!active) return
        setEntityRows(rows)
        setEntityStatus('ready')
      })
      .catch(() => {
        if (active) setEntityStatus('error')
      })
    // Ignore older responses when filters change or the page is left.
    return () => { active = false }
  }, [filters, entityRetry])

  const kpiMap = Object.fromEntries((kpis || []).map(k => [k.metric, k]))

  const toggleShortlist = (id) => {
    setShortlistIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const filteredCases = entityRows.filter(r =>
    !entitySearch || r['Case Name']?.toLowerCase().includes(entitySearch.toLowerCase())
  )
  const sortedCases = sortCaseSummaryRows(filteredCases, shortlistIds, tableSort)

  const toggleTableSort = (key) => {
    setTableSort(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }))
  }

  const maxRankedTotal = rankedData.length ? Math.max(...rankedData.map(r => Math.abs(r.Total))) : 1

  if (loading) return <p style={{ padding: '2rem' }}>Loading portfolio data…</p>
  if (error)   return <p style={{ padding: '2rem', color: 'var(--color-negative)' }}>Error: {error}</p>

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ marginBottom: '0.15rem' }}>Portfolio Viewer</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
          Review portfolio shape, quality and key contributors across the selected portfolio.
        </p>
      </div>

      {/* ── KPI tiles ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <KpiCard
          title="Cumulative Production"
          value={kpiMap[PROD_METRIC]?.total != null ? fmt(kpiMap[PROD_METRIC].total * 0.36525, 0) : '—'}
          unit="mmboe"
          subLabel={kpiMap[PROD_METRIC]?.annual_avg != null ? `Average ${fmt(kpiMap[PROD_METRIC].annual_avg, 1)} mboed p.a.` : ''}
        />
        <KpiCard
          title="Cumulative Cash Capex"
          value={fmtBn(kpiMap['Cash Capex']?.total)}
          unit="$bn"
          subLabel={`Average $${fmtBn(kpiMap['Cash Capex']?.annual_avg)}bn p.a.`}
        />
        <KpiCard
          title="Cumulative Post-Tax RCOP"
          value={fmtBn(kpiMap['Post-Tax RCOP']?.total)}
          unit="$bn"
          subLabel={`Average $${fmtBn(kpiMap['Post-Tax RCOP']?.annual_avg)}bn p.a.`}
        />
        <KpiCard
          title="Cumulative Post-Tax Free Cash Flow"
          value={fmtBn(kpiMap['Post-Tax Cash Flow']?.total)}
          unit="$bn"
          subLabel={`Average $${fmtBn(kpiMap['Post-Tax Cash Flow']?.annual_avg)}bn p.a.`}
        />
      </div>

      {/* ── Three chart panels ── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <FlexChartPanel metrics={metrics} defaultMetric="Total Production (mboed)" filters={filters} />
        <FlexChartPanel metrics={metrics} defaultMetric="Cash Capex"               filters={filters} />
        <FlexChartPanel metrics={metrics} defaultMetric="Post-Tax Cash Flow"        filters={filters} />
      </div>

      {/* ── Ranked contributors + Creaming curve ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* Ranked contributors */}
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
              Ranked Contributors
            </span>
            <Select value={rankBy}     onChange={v => { setRankBy(v); setChartSelection(null) }}     options={RANK_BY_OPTIONS} />
            <Select value={rankMetric} onChange={setRankMetric} options={[...metrics, { value: NPV_METRIC, label: 'NPV8 ($m)' }]} style={{ maxWidth: 210 }} />
            <Select value={topN}       onChange={setTopN}       options={TOP_N_OPTIONS} />
            {rankMetric === NPV_METRIC && <span style={{ fontSize: 11 }}>Fixed 2026 base; period 1.</span>}
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 420 }}>
            {rankedData.map(row => {
              const pct = Math.abs(row.Total) / maxRankedTotal * 100
              const isActive = chartSelection?.dimension === rankBy && chartSelection?.value === row.Label
              return (
                <div
                  key={row.Label}
                  onClick={() => selectChart(rankBy, row.Label)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, cursor: 'pointer', borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent', paddingLeft: isActive ? 4 : 4 }}
                >
                  <div style={{ width: 140, flexShrink: 0, fontSize: 11, color: '#494733', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? 700 : 400 }}>
                    {row.Label}
                  </div>
                  <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 3, height: 18, minWidth: 0 }}>
                    <div style={{ width: `${pct}%`, background: isActive ? 'var(--color-accent)' : BP_GREEN, height: '100%', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ width: 120, flexShrink: 0, fontSize: 10, color: '#494733', whiteSpace: 'nowrap' }}>
                    {Number(row.Total).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({row.Pct}%)
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Creaming curve */}
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Creaming Curve
            </span>
            <Select value={creamGroupBy} onChange={v => { setCreamGroupBy(v); setChartSelection(null) }} options={CREAM_DIM_OPTIONS} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Discount rate: {DISCOUNT_RATE}%</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 0.5rem' }}>
            Ordered by capital efficiency (highest post-tax NPV/Capex first). Fixed 2026 base; 2026 is period 1.
          </p>
          {creamData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ left: 10, right: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="Cum Capex"
                  name="Cumulative Capex ($m)"
                  type="number"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Cumulative Capex ($m)', position: 'insideBottom', offset: -10, fontSize: 10 }}
                />
                <YAxis
                  dataKey="Cum NPV"
                  name="Cumulative Post-Tax NPV ($m)"
                  type="number"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Cum Post-Tax NPV ($m)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', fontSize: 11 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{d?.Label}</div>
                        <div>Post-tax NPV: ${Number(d?.NPV ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}m</div>
                        <div>Capex: ${Number(d?.Capex ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}m</div>
                        <div>PI: {Number(d?.PI ?? 0).toFixed(2)}x</div>
                      </div>
                    )
                  }}
                />
                <Scatter
                  data={creamData.map(d => ({
                    ...d,
                    fill: chartSelection?.dimension === creamGroupBy && chartSelection?.value === d.Label
                      ? 'var(--color-accent)'
                      : BP_GREEN,
                  }))}
                  onClick={(point) => selectChart(creamGroupBy, point.Label)}
                  style={{ cursor: 'pointer' }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: '1rem' }}>No data — ensure Post-Tax Cash Flow and Cash Capex metrics are available.</p>
          )}
        </div>
      </div>

      {/* ── Case Summary ── */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Case Summary</span>
            {entityStatus === 'ready' && <span style={{ color: 'var(--color-text-muted)', fontSize: 13, marginLeft: 8 }}>{filteredCases.length} cases</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={entitySearch}
              onChange={e => setEntitySearch(e.target.value)}
              placeholder="Search cases…"
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, width: 180, outline: 'none' }}
            />
            <button
              type="button"
              onClick={() => setTableSort(null)}
              disabled={tableSort === null}
              style={{
                padding: '0.45rem 1.1rem', background: '#fff',
                color: tableSort ? 'var(--color-accent-dark)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)', borderRadius: 4,
                fontSize: 13, fontWeight: 600,
                cursor: tableSort ? 'pointer' : 'default',
              }}
            >
              Reset sorting
            </button>
            <button
              type="button"
              onClick={() => setShortlistIds(new Set())}
              disabled={shortlistIds.size === 0}
              style={{
                padding: '0.45rem 1.1rem', background: '#fff',
                color: shortlistIds.size > 0 ? 'var(--color-accent-dark)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)', borderRadius: 4,
                fontSize: 13, fontWeight: 600,
                cursor: shortlistIds.size > 0 ? 'pointer' : 'default',
              }}
            >
              Clear shortlist
            </button>
            <button
              type="button"
              onClick={() => navigate('/build')}
              style={{
                padding: '0.45rem 1.1rem',
                background: 'var(--color-accent-dark)',
                color: '#fff', border: 'none', borderRadius: 4,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Build a Scenario ({shortlistIds.size} shortlisted) →
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          All cases are included using their reference profiles by default. Shortlist cases to adjust assumptions, exclude them, or keep them handy for review in the scenario builder.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
                <th scope="col" aria-label="Shortlist" />
                {CASE_SUMMARY_COLUMNS.map(({ key, label, numeric }) => {
                  const direction = tableSort?.key === key ? tableSort.direction : undefined
                  const nextDirection = direction === 'ascending' ? 'descending' : 'ascending'
                  return (
                    <th key={key} scope="col" aria-sort={direction} style={{ padding: '7px 8px', textAlign: numeric ? 'right' : 'left', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <button
                        type="button"
                        onClick={() => toggleTableSort(key)}
                        aria-label={`${label}: sort ${nextDirection}`}
                        title={`${label}: sort ${nextDirection}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: numeric ? 'flex-end' : 'flex-start', gap: 3, width: '100%', padding: 0, border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textAlign: 'inherit' }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                        <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 9 }}>{direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}</span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {(entityStatus !== 'ready' || sortedCases.length === 0) && (
                <tr>
                  <td colSpan={CASE_SUMMARY_COLUMNS.length + 1} style={{ padding: '1rem 8px', textAlign: 'center', color: entityStatus === 'error' ? 'var(--color-negative)' : 'var(--color-text-muted)' }}>
                    <span role={entityStatus === 'error' ? 'alert' : 'status'}>
                      {entityStatus === 'loading' ? 'Loading case summary…'
                        : entityStatus === 'error' ? 'Unable to load the case summary. Please try again.'
                        : 'No cases match your search or filters.'}
                    </span>
                    {entityStatus === 'error' && (
                      <button
                        type="button"
                        onClick={() => setEntityRetry(prev => prev + 1)}
                        style={{ marginLeft: 8, padding: '3px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-accent-dark)', fontSize: 12 }}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {sortedCases.map(row => {
                const isShortlisted = shortlistIds.has(row.ID)
                const isHighlighted = isChartHighlighted(row)
                const badge = planTypeBadge(row['Plan Type'])
                return (
                  <tr
                    key={row.ID}
                    onClick={() => toggleShortlist(row.ID)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border)',
                      background: isShortlisted ? 'rgba(0,127,0,0.05)' : isHighlighted ? 'rgba(0,100,200,0.06)' : 'transparent',
                      borderLeft: isShortlisted ? '3px solid var(--color-accent-dark)' : isHighlighted ? '3px solid var(--color-accent)' : '3px solid transparent',
                    }}
                  >
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isShortlisted}
                        aria-label={`Shortlist ${row['Case Name']}`}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleShortlist(row.ID)}
                        style={{ accentColor: 'var(--color-accent-dark)', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row['Case Name']}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: badge.bg, color: badge.text, whiteSpace: 'nowrap' }}>
                        {row['Plan Type']}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row['Group Entity']}</td>
                    <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row['Segment']}</td>
                    <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.Region}</td>
                    <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.Country}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.Production, 1)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.Capex, 0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.FCF, 0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.NPV, 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

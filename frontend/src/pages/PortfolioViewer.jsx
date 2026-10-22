/**
 * Portfolio Viewer
 */
import { useState, useEffect, useContext, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import {
  getPortfolioKpis, getStacked, getRanked, getCreaming, getEntitySummary,
} from '../api/client'
import { SlidersHorizontal } from 'lucide-react'
import PortfolioViewSettings from '../components/PortfolioViewSettings'
import { metricDisplayName } from './referenceMeasures'
import '../components/ScenarioResults.css'
import KpiCard from '../components/KpiCard'
import FilterRail from '../components/FilterRail'
import { SelectionContext, SidePanelContext, FiltersContext } from '../App'
import theme, { bp } from '../theme'
import { CASE_SUMMARY_COLUMNS, sortCaseSummaryRows } from './caseSummarySort'

// ─── constants ───────────────────────────────────────────────────────────────

const BP_GREEN   = '#007F00'
const PANEL_H    = 240          // fixed height for chart panels


const DIMENSION_OPTIONS = [
  { value: '',             label: 'None (total)'  },
  { value: 'plan_type',    label: 'Plan Type'     },
  { value: 'group_entity', label: 'Group Entity'  },
  { value: 'region',       label: 'Region'        },
  { value: 'country',      label: 'Country'       },
  { value: 'case_name',    label: 'Case'          },
  { value: 'meta',         label: 'Meta'          },
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
const chartTooltipFormatter = (value) => [
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 }),
]
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
      {['Area', 'Columns'].map(v => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)} style={{
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

function ChartDataDetails({ rows, columns }) {
  return <details className="results-data"><summary>View chart data</summary>
    <div style={{ maxHeight: 300, overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead><tr>{columns.map(c => <th key={c.key} scope="col" style={{ textAlign: c.numeric ? 'right' : 'left', padding: 8 }}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i}>{columns.map(c => <td key={c.key} style={{ textAlign: c.numeric ? 'right' : 'left', padding: 8, borderBottom: '1px solid var(--color-border)' }}>{c.numeric ? fmt(row[c.key], 2) : row[c.key]}</td>)}</tr>)}</tbody>
    </table>{rows.length === 0 && <p>No chart data for the selected filters.</p>}</div>
  </details>
}

function FlexChartPanel({ metric, groupBy, filters }) {
  const [view,    setView]    = useState('Columns')
  const [data,    setData]    = useState([])

  useEffect(() => {
    let active = true
    setData([])
    getStacked(metric, groupBy, filters).then(rows => { if (active) setData(rows) }).catch(() => { if (active) setData([]) })
    return () => { active = false }
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
        <div style={{ flex: 1 }}><h3 style={{ fontSize: 15, margin: 0 }}>{metricDisplayName(metric)}</h3>{groupBy && <small className="text-muted">Breakdown by {DIMENSION_OPTIONS.find(o => o.value === groupBy)?.label}</small>}</div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {/* Fixed-height chart; data expands below */}
      <div style={{ height: PANEL_H, overflow: 'hidden' }}>

          <ResponsiveContainer width="100%" height="100%">
            {view === 'Area' ? (
              <AreaChart data={wideData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="Year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={chartTooltipFormatter} />
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
                <Tooltip formatter={chartTooltipFormatter} />
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
      </div>
      <details className="results-data"><summary>View chart data</summary><div style={{ maxHeight: 300, overflow: 'auto' }}><ChartTableView data={data} seriesKeys={seriesKeys} /></div></details>
    </div>
  )
}


// ─── column filter dropdown ───────────────────────────────────────────────────
const FILTERABLE_COLS = ['Case Name', 'Plan Type', 'Group Entity', 'Segment', 'Region', 'Country']

function ColumnFilterDropdown({ colKey, allRows, active, onCommit }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(active)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const options = [...new Set(allRows.map(r => r[colKey]).filter(v => v != null && v !== ''))].sort()

  useEffect(() => { setDraft(active) }, [active])

  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false); setDraft(active)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, active])

  const openDropdown = () => {
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + window.scrollY + 2, left: rect.left + window.scrollX })
    setSearch('')
    setOpen(o => !o)
  }

  const toggle = v => setDraft(prev => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next })
  const hasFilter = active.size > 0

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        title={`Filter ${colKey}`}
        aria-label={`Filter ${colKey}`}
        style={{ padding: '1px 3px', border: 'none', background: 'transparent', cursor: 'pointer', color: hasFilter ? 'var(--color-accent-dark)' : 'var(--color-text-muted)', fontSize: 11, lineHeight: 1, flexShrink: 0 }}
      >
        {hasFilter ? '▼' : '⏷'}
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 200, maxHeight: 280, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setDraft(new Set(options))} style={{ fontSize: 11, padding: '2px 6px', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', background: '#fff' }}>All</button>
            <button type="button" onClick={() => setDraft(new Set())} style={{ fontSize: 11, padding: '2px 6px', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', background: '#fff' }}>None</button>
          </div>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              autoFocus
              style={{ width: '100%', fontSize: 12, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 3, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {options.filter(v => !search || v.toLowerCase().includes(search.toLowerCase())).map(v => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} style={{ accentColor: 'var(--color-accent-dark)', cursor: 'pointer' }} />
                {v}
              </label>
            ))}
          </div>
          <div style={{ padding: '6px 8px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button type="button" onClick={() => { setOpen(false); setDraft(active) }} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', background: '#fff' }}>Cancel</button>
            <button type="button" onClick={() => { onCommit(draft); setOpen(false) }} style={{ fontSize: 11, padding: '3px 8px', border: 'none', borderRadius: 3, cursor: 'pointer', background: 'var(--color-accent-dark)', color: '#fff' }}>Apply</button>
          </div>
        </div>,
        document.body
      )}
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
  const [creamData,     setCreamData]     = useState([])
  const [entityRows,    setEntityRows]    = useState([])
  const [entityStatus,  setEntityStatus]  = useState('loading')
  const [entityRetry,   setEntityRetry]   = useState(0)
  const [entitySearch,  setEntitySearch]  = useState('')
  const [tableSort,     setTableSort]     = useState(null)
  const [tableFilters,  setTableFilters]  = useState(() => Object.fromEntries(FILTERABLE_COLS.map(c => [c, new Set()])))
  const [chartSelection, setChartSelection] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewSettings, setViewSettings] = useState({ metric1: PROD_METRIC, group1: '', metric2: 'Cash Capex', group2: '', metric3: 'Post-Tax Cash Flow', group3: '', rankBy: 'case_name', rankMetric: 'Post-Tax Cash Flow', topN: '10', creamGroupBy: 'case_name' })
  const { rankBy, rankMetric, topN, creamGroupBy } = viewSettings
  const settingsSections = [
    ...[1, 2, 3].map(i => ({ title: `Chart ${i}`, fields: [
      { key: `metric${i}`, label: 'Metric', options: metrics },
      { key: `group${i}`, label: 'Break down', options: DIMENSION_OPTIONS },
    ] })),
    { title: 'Ranked contributors', fields: [
      { key: 'rankBy', label: 'Rank by', options: RANK_BY_OPTIONS },
      { key: 'rankMetric', label: 'Metric', options: [...metrics, { value: NPV_METRIC, label: 'NPV8 ($m)' }] },
      { key: 'topN', label: 'Contributors', options: TOP_N_OPTIONS },
    ] },
    { title: 'Creaming curve', fields: [{ key: 'creamGroupBy', label: 'Group by', options: CREAM_DIM_OPTIONS }] },
  ]


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
    let active = true
    setRankedData([])
    getRanked(rankMetric, rankBy, Number(topN), filters, DISCOUNT_RATE).then(rows => { if (active) setRankedData(rows) }).catch(() => { if (active) setRankedData([]) })
    return () => { active = false }
  }, [rankMetric, rankBy, topN, filters])

  useEffect(() => {
    let active = true
    setCreamData([])
    getCreaming(DISCOUNT_RATE, filters, creamGroupBy).then(rows => { if (active) setCreamData(rows) }).catch(() => { if (active) setCreamData([]) })
    return () => { active = false }
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

  const hasTableFilters = FILTERABLE_COLS.some(c => tableFilters[c].size > 0)
  const filteredCases = entityRows.filter(r => {
    if (entitySearch && !r['Case Name']?.toLowerCase().includes(entitySearch.toLowerCase())) return false
    for (const col of FILTERABLE_COLS) {
      if (tableFilters[col].size > 0 && !tableFilters[col].has(r[col])) return false
    }
    return true
  })
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
      <div className="results-heading">
        <div><h2 style={{ marginBottom: '0.15rem' }}>Portfolio Viewer</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
          Review portfolio shape, quality and key contributors across the selected portfolio.
        </p></div>
        <button className="saved-scenarios__trigger" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={15} /> View settings</button>
      </div>
      {settingsOpen && <PortfolioViewSettings settings={viewSettings} sections={settingsSections} onClose={() => setSettingsOpen(false)} onApply={draft => { setViewSettings(draft); setChartSelection(null); setSettingsOpen(false) }} />}

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
        {[1, 2, 3].map(i => <FlexChartPanel key={i} metric={viewSettings[`metric${i}`]} groupBy={viewSettings[`group${i}`]} filters={filters} />)}
      </div>

      {/* ── Ranked contributors + Creaming curve ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* Ranked contributors */}
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: 15, margin: 0 }}>Ranked Contributors</h3>
            <div className="text-small text-muted" style={{ marginTop: 4 }}>{metricDisplayName(rankMetric)} · Breakdown by {RANK_BY_OPTIONS.find(o => o.value === rankBy)?.label} · {TOP_N_OPTIONS.find(o => o.value === topN)?.label}{rankMetric === NPV_METRIC && ' · Fixed 2026 base; period 1.'}</div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 420 }}>
            {rankedData.map(row => {
              const pct = Math.abs(row.Total) / maxRankedTotal * 100
              const isActive = chartSelection?.dimension === rankBy && chartSelection?.value === row.Label
              return (
                <div
                  key={row.Label}
                  onClick={() => selectChart(rankBy, row.Label)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, minHeight: 26, cursor: 'pointer', borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent', paddingLeft: isActive ? 4 : 4 }}
                >
                  <div style={{ width: 140, flexShrink: 0, fontSize: 11, color: '#494733', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? 700 : 400 }}>
                    {row.Label}
                  </div>
                  <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 3, height: 26, minWidth: 0 }}>
                    <div style={{ width: `${pct}%`, background: isActive ? 'var(--color-accent)' : BP_GREEN, height: '100%', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ width: 120, flexShrink: 0, fontSize: 10, color: '#494733', whiteSpace: 'nowrap' }}>
                    {Number(row.Total).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({row.Pct}%)
                  </div>
                </div>
              )
            })}
          </div>
          <ChartDataDetails rows={rankedData} columns={[{ key: 'Label', label: 'Contributor' }, { key: 'Total', label: metricDisplayName(rankMetric), numeric: true }, { key: 'Pct', label: 'Share (%)', numeric: true }]} />
        </div>

        {/* Creaming curve */}
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem' }}>
          <div style={{ marginBottom: '0.4rem' }}>
            <h3 style={{ fontSize: 15, margin: 0 }}>Creaming Curve</h3>
            <div className="text-small text-muted" style={{ marginTop: 4 }}>Breakdown by {CREAM_DIM_OPTIONS.find(o => o.value === creamGroupBy)?.label} · Discount rate: {DISCOUNT_RATE}%</div>
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
          <ChartDataDetails rows={creamData} columns={[{ key: 'Label', label: 'Contributor' }, { key: 'PI', label: 'PI (x)', numeric: true }, { key: 'Cum Capex', label: 'Cumulative Capex ($m)', numeric: true }, { key: 'Cum NPV', label: 'Cumulative NPV ($m)', numeric: true }]} />
        </div>
      </div>

      {/* ── Case Summary ── */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Case Summary</span>
            {entityStatus === 'ready' && <span style={{ color: 'var(--color-text-muted)', fontSize: 13, marginLeft: 8 }}>{filteredCases.length}{hasTableFilters || entitySearch ? ` of ${entityRows.length}` : ''} cases</span>}
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
              onClick={() => setTableFilters(Object.fromEntries(FILTERABLE_COLS.map(c => [c, new Set()])))}
              disabled={!hasTableFilters}
              style={{
                padding: '0.45rem 1.1rem', background: '#fff',
                color: hasTableFilters ? 'var(--color-accent-dark)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)', borderRadius: 4,
                fontSize: 13, fontWeight: 600,
                cursor: hasTableFilters ? 'pointer' : 'default',
              }}
            >
              Reset filters
            </button>
            {(() => {
              const highlightedCases = chartSelection ? filteredCases.filter(r => isChartHighlighted(r)) : filteredCases
              const hasHighlight = !!chartSelection
              const label = hasHighlight ? 'Select highlighted' : 'Select all'
              const active = hasHighlight && highlightedCases.length > 0
              return (
                <button
                  type="button"
                  onClick={() => {
                    const ids = new Set(highlightedCases.map(r => r.ID))
                    setShortlistIds(prev => new Set([...prev, ...ids]))
                  }}
                  disabled={highlightedCases.length === 0}
                  style={{
                    padding: '0.45rem 1.1rem',
                    background: active ? 'var(--color-accent-dark)' : '#fff',
                    color: active ? '#fff' : highlightedCases.length > 0 ? 'var(--color-accent-dark)' : 'var(--color-text-muted)',
                    border: active ? 'none' : '1px solid var(--color-border)', borderRadius: 4,
                    fontSize: 13, fontWeight: 600,
                    cursor: highlightedCases.length > 0 ? 'pointer' : 'default',
                  }}
                >
                  {label}
                </button>
              )
            })()}
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
                <th scope="col" aria-label="Shortlist" style={{ padding: '7px 8px', textAlign: 'center' }}>
                  {(() => {
                    const filteredIds = filteredCases.map(r => r.ID)
                    const checkedCount = filteredIds.filter(id => shortlistIds.has(id)).length
                    const allChecked = filteredIds.length > 0 && checkedCount === filteredIds.length
                    const someChecked = checkedCount > 0 && !allChecked
                    return (
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked }}
                        aria-label={allChecked ? 'Deselect all highlighted' : 'Select all highlighted'}
                        title={allChecked ? 'Deselect all highlighted' : 'Select all highlighted'}
                        onChange={() => {
                          if (allChecked) {
                            setShortlistIds(prev => { const next = new Set(prev); filteredIds.forEach(id => next.delete(id)); return next })
                          } else {
                            setShortlistIds(prev => new Set([...prev, ...filteredIds]))
                          }
                        }}
                        style={{ accentColor: 'var(--color-accent-dark)', cursor: 'pointer' }}
                      />
                    )
                  })()}
                </th>
                {CASE_SUMMARY_COLUMNS.map(({ key, label, numeric }) => {
                  const direction = tableSort?.key === key ? tableSort.direction : undefined
                  const nextDirection = direction === 'ascending' ? 'descending' : 'ascending'
                  const isFilterable = FILTERABLE_COLS.includes(key)
                  const filterActive = isFilterable && tableFilters[key].size > 0
                  return (
                    <th key={key} scope="col" aria-sort={direction} style={{ padding: '7px 8px', textAlign: numeric ? 'right' : 'left', fontWeight: 600, color: filterActive ? 'var(--color-accent-dark)' : 'var(--color-text-muted)', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: numeric ? 'flex-end' : 'flex-start', gap: 2 }}>
                        <button
                          type="button"
                          onClick={() => toggleTableSort(key)}
                          aria-label={`${label}: sort ${nextDirection}`}
                          title={`${label}: sort ${nextDirection}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: 0, border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textAlign: 'inherit', cursor: 'pointer', minWidth: 0 }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                          <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 9 }}>{direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}</span>
                        </button>
                        {isFilterable && (
                          <ColumnFilterDropdown
                            colKey={key}
                            allRows={entityRows}
                            active={tableFilters[key]}
                            onCommit={selection => setTableFilters(prev => ({ ...prev, [key]: selection }))}
                          />
                        )}
                      </div>
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
                    <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row['Plan Type']}</td>
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, ComposedChart, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'
import { getResultsAnalysis } from '../api/client'
import { analysisRequest, createAnalysisLoader } from '../pages/resultsRequests'
import { waterfallPositions, KPI_TITLES } from '../pages/resultsHelpers'
import { compareTableValues } from '../utils/tableSort.js'
import { metricDisplayName } from '../pages/referenceMeasures'
import theme from '../theme'

const seriesColor = i => theme.chartPalette[i % theme.chartPalette.length]

export const number = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })
function useAnalysis(payload) {
  const request = useMemo(() => analysisRequest(payload), [payload])
  const key = useMemo(() => JSON.stringify(request), [request])
  const loader = useRef(null)
  if (!loader.current) loader.current = createAnalysisLoader(getResultsAnalysis)
  const [state, setState] = useState({})
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setState({ key, loading: true })
    loader.current(key, JSON.parse(key)).then(data => { if (active) setState({ key, data }) })
      .catch(error => { if (active) setState({ key, error: error.message }) })
    return () => { active = false }
  }, [key, retry])
  return { ...(state.key === key ? state : { loading: true }), retry: () => setRetry(n => n + 1) }
}
function Status({ state }) {
  return state.error ? <p role="alert">{state.error} <button onClick={state.retry}>Retry</button></p> : <p role="status">Updating analysis…</p>
}
export function ResultsKpis({ payload }) {
  const state = useAnalysis(payload)
  if (!state.data) return <Status state={state} />
  return <div className="results-kpis">{state.data.map((item, i) => <article className="results-kpi" key={item.metric}>
    <h3>{KPI_TITLES[i]}</h3><div className="results-kpi__value">{number(item.scenario)} <span>{item.unit}</span></div>
    <div className="results-kpi__variance">{item.delta > 0 ? '+' : ''}{number(item.delta)} {item.unit} · {item.delta_pct == null ? 'Percentage n/a' : `${item.delta_pct > 0 ? '+' : ''}${number(item.delta_pct)}%`}<small>Variance to Reference</small></div>
    <p>Reference: <strong>{number(item.baseline)} {item.unit}</strong></p>
  </article>)}</div>
}
export function ResultsPlot({ payload, mode, onMode, primaryName, comparisonName, breakdown }) {
  const state = useAnalysis(payload)
  const rows = state.data ? (mode === 'variance' ? waterfallPositions(state.data.rows) : state.data.rows) : []
  const seriesKeys = mode === 'column' ? (state.data?.series ?? []) : []
  const unit = state.data?.unit
  const modeLabels = { profile: 'Profile', variance: 'Variance', column: 'Column' }
  return <section className="results-panel">
    <header className="results-panel__header"><div><h3>{metricDisplayName(payload.metric)}</h3><small>{mode === 'variance' ? `Variance by ${breakdown}` : mode === 'column' ? `By ${breakdown} · scenario` : 'Annual profile'}{unit ? ` · ${unit}` : ''}</small></div>
      <div className="results-toggle" role="group" aria-label={`${metricDisplayName(payload.metric)} chart view`}>
        {['profile', 'variance', 'column'].map(view => <button key={view} aria-pressed={mode === view} onClick={() => onMode(view)}>{modeLabels[view]}</button>)}
      </div>
    </header>
    {!state.data ? <Status state={state} /> : <>
      <div className="results-chart-scroll"><div style={{ height: 300, minWidth: mode === 'variance' ? Math.max(360, rows.length * 85) : 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'profile' ? <LineChart data={rows} margin={{ top: 15, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis tickFormatter={number} width={70} tick={{ fontSize: 11 }} /><Tooltip formatter={(value, name) => [`${number(value)} ${unit}`, name]} /><Legend />
            <Line type="linear" dataKey="reference" name="Reference" stroke="#777b70" dot={false} strokeDasharray="4 3" />
            <Line type="linear" dataKey="primary" name={primaryName} stroke="#006b3c" strokeWidth={3} dot={false} />
            {comparisonName && <Line type="linear" dataKey="comparison" name={comparisonName} stroke="#96723b" strokeWidth={2} strokeDasharray="8 3" dot={false} />}
          </LineChart> : mode === 'column' ? <ComposedChart data={rows} margin={{ top: 15, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis tickFormatter={number} width={70} tick={{ fontSize: 11 }} /><Tooltip formatter={(value, name) => [`${number(value)} ${unit}`, name]} /><Legend wrapperStyle={{ fontSize: 11 }} />
            {seriesKeys.map((sk, i) => <Bar key={sk} dataKey={sk} name={sk} stackId="scenario" fill={seriesColor(i)} isAnimationActive={false} />)}
            <Line type="linear" dataKey="reference" name="Reference" stroke="#777b70" dot={false} strokeDasharray="4 3" strokeWidth={2} />
          </ComposedChart> : <BarChart data={rows} margin={{ top: 15, right: 20, bottom: 45, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} /><YAxis tickFormatter={number} width={70} tick={{ fontSize: 11 }} /><ReferenceLine y={0} stroke="#777" />
            <Tooltip content={({ active, payload: items }) => active && items?.length ? <div className="results-tooltip"><strong>{items[0].payload.label}</strong><p>{number(items[0].payload.value)} {unit}</p></div> : null} />
            <Bar dataKey="range" isAnimationActive={false}>{rows.map((row, i) => <Cell key={i} fill={row.type === 'absolute' ? '#006b3c' : row.value >= 0 ? '#63859b' : '#ae885a'} />)}</Bar>
          </BarChart>}
        </ResponsiveContainer>
      </div></div>
      <details className="results-data"><summary>View chart data</summary><div className="results-table-scroll"><table><thead><tr>
        {mode === 'profile' ? <><th>Year</th><th>Reference</th><th>{primaryName}</th>{comparisonName && <th>{comparisonName}</th>}</>
          : mode === 'column' ? <><th>Year</th><th>Reference</th>{seriesKeys.map(sk => <th key={sk}>{sk}</th>)}</>
          : <><th>Step</th><th>Value ({unit})</th><th>From</th><th>To</th></>}
      </tr></thead><tbody>
        {rows.map((r, i) => <tr key={i}>
          {mode === 'profile' ? <><td>{r.year}</td><td>{number(r.reference)}</td><td>{number(r.primary)}</td>{comparisonName && <td>{number(r.comparison)}</td>}</>
            : mode === 'column' ? <><td>{r.year}</td><td>{number(r.reference)}</td>{seriesKeys.map(sk => <td key={sk}>{number(r[sk])}</td>)}</>
            : <><td>{r.label}</td><td>{number(r.value)}</td><td>{number(r.start)}</td><td>{number(r.end)}</td></>}
        </tr>)}
      </tbody></table></div></details>
    </>}
  </section>
}
export function ResultsChanges({ payload, changes, basis }) {
  const state = useAnalysis(payload)
  const [sort, setSort] = useState(null)
  const [search, setSearch] = useState('')
  const impacts = new Map((state.data?.rows ?? []).map(row => [row.id, row.delta]))
  const rows = changes.filter(row => (row.name ?? '').toLowerCase().includes(search.trim().toLowerCase())).map(row => ({ ...row, impact: impacts.get(row.id) ?? 0 }))
  if (sort) rows.sort((a, b) => compareTableValues(a[sort.key], b[sort.key], sort.key === 'impact', sort.direction))
  const columns = [{ key: 'name', label: 'Case' }, { key: 'change', label: 'Change' },
    { key: 'detail', label: 'Detail' }, { key: 'impact', label: `Impact vs Reference (${state.data?.unit ?? ''})` }]

  return <section className="results-panel">
    <header className="results-table-tools">
      <h3>Changes driving this scenario</h3>
      <div className="results-table-actions">
        <button type="button" aria-label="Reset changed cases sorting" disabled={sort === null} onClick={() => setSort(null)}>Reset sorting</button>
        <input type="search" aria-label="Search changed cases" placeholder="Search cases…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
    </header>
    <p className="text-small text-muted">Impact vs Reference: {basis}</p>
    <p className="text-small text-muted">{rows.length} of {changes.length} cases shown.</p>
    {!state.data ? <Status state={state} /> : changes.length === 0 ? <p>No changed cases in the selected scope.</p> : rows.length === 0 ? <p>No cases match your search.</p> : <div className="results-table-scroll"><table><thead><tr>{columns.map(column => {
      const direction = sort?.key === column.key ? sort.direction : undefined
      const nextDirection = direction === 'ascending' ? 'descending' : 'ascending'
      return <th key={column.key} scope="col" aria-sort={direction}>
        <button type="button" className="results-sort" aria-label={`${column.label}: sort ${nextDirection}`}
          onClick={() => setSort({ key: column.key, direction: nextDirection })}>
          {column.label} <span aria-hidden="true">{direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}</span>
        </button>
      </th>
    })}</tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong><small className="results-case-id">ID {row.id}</small></td><td>{row.change}</td><td>{row.detail}</td><td>{number(row.impact)}</td></tr>)}
    </tbody></table></div>}
  </section>
}

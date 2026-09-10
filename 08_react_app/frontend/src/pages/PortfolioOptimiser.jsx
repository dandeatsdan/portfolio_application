import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react'
import { SidePanelContext, ScenarioResultContext } from '../App'
import { WorkingScenarioContext } from '../hooks/WorkingScenarioContext'
import { isDirty } from '../hooks/scenarioDefinition'
import { usePortfolio } from '../hooks/usePortfolio'
import { solveOptimisation } from '../api/client'
import OptimiserCaseControls from '../components/OptimiserCaseControls'
import RecommendationConfirmation from '../components/RecommendationConfirmation'
import { YEARS, DEFAULT_OPTIMISER, newConstraint, constraintUnit, optimiserRequest, recommendationDefinition, sortRecommendedCases } from './optimiserHelpers'
import '../components/ScenarioResults.css'
import '../components/PortfolioOptimiser.css'

const number = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
const STATUSES = { optimal: 'Optimal selection', infeasible: 'No feasible portfolio within the permitted limits', time_limit: 'Time limit reached — outcome unresolved', solver_error: 'Solver could not complete', unbounded: 'Unexpected unbounded model' }
const Year = ({ label, value, onChange }) => <label>{label}<select value={value} onChange={e => onChange(Number(e.target.value))}>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></label>

export default function PortfolioOptimiser() {
  const { cases, loading, error: portfolioError } = usePortfolio()
  const { setSidePanel } = useContext(SidePanelContext)
  const { working, dispatch } = useContext(WorkingScenarioContext)
  const { setScenarioResult, setLastRunError } = useContext(ScenarioResultContext)
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_OPTIMISER, constraints: [] }))
  const [controlsOpen, setControlsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(null)
  const generation = useRef(0)
  const runLock = useRef(false)
  const resultRef = useRef(null)
  useEffect(() => { setSidePanel(null); return () => { generation.current++ } }, [setSidePanel])
  useEffect(() => { if (outcome) resultRef.current?.focus() }, [outcome])
  function change(update) { setDraft(d => ({ ...d, ...update })); setOutcome(null); setError(null) }
  function editConstraint(id, update) { change({ constraints: draft.constraints.map(c => c.id === id ? { ...c, ...update } : c) }) }
  async function run() {
    if (runLock.current) return
    let request
    try { request = optimiserRequest(draft) } catch (err) { setError(err.message); return }
    const token = ++generation.current
    runLock.current = true; setRunning(true); setError(null); setOutcome(null)
    try {
      const result = await solveOptimisation(request)
      if (generation.current === token) { setOutcome({ result, request }); setSort(null) }
    } catch (err) { if (generation.current === token) setError(err.message) }
    finally { runLock.current = false; if (generation.current === token) setRunning(false) }
  }
  function review() {
    setReviewOpen(false)
    try {
      dispatch({ type: 'recommendation', definition: recommendationDefinition(outcome.result, outcome.request) })
      setScenarioResult(null); setLastRunError(null); navigate('/build')
    } catch (err) { setError(err.message) }
  }
  if (loading) return <p role="status">Loading portfolio…</p>
  if (portfolioError) return <p role="alert">{portfolioError}</p>
  const result = outcome?.result
  const rows = sortRecommendedCases((result?.cases ?? []).filter(c => `${c.name} ${c.id}`.toLowerCase().includes(search.trim().toLowerCase())), sort)
  const columns = [{ key: 'name', label: 'Case' }, { key: 'selected', label: 'Recommendation' }, { key: 'npv', label: 'NPV8 ($m)' }, { key: 'capex', label: 'Cash Capex ($m)' }, { key: 'production', label: 'Production (mmboe)' }]
  return <div className="portfolio-optimiser">
    <div className="results-heading"><div><h2>Portfolio Optimiser</h2><p>Choose the portfolio that maximises value within your limits.</p><p className="text-small text-muted">All {cases.length} reference cases are candidates and may run together. Decisions are include or exclude.</p></div>
      <button className="saved-scenarios__trigger" disabled={running} aria-haspopup="dialog" onClick={() => setControlsOpen(true)}><SlidersHorizontal size={15} /> Case controls</button></div>
    <form onSubmit={e => { e.preventDefault(); run() }}>
      <fieldset disabled={running} className="optimiser-fields">
        <section className="results-panel"><h3><span className="optimiser-step">1</span> Choose objective</h3>
          <div className="optimiser-objective"><div><strong>Maximise post-tax NPV</strong><p className="text-small text-muted">8% discount rate.</p></div>
            <Year label="From" value={draft.year_from} onChange={year_from => change({ year_from })} /><Year label="To" value={draft.year_to} onChange={year_to => change({ year_to })} /></div>
        </section>
        <section className="results-panel"><header className="results-panel__header"><h3><span className="optimiser-step">2</span> Set constraints</h3>
          <button type="button" className="saved-scenarios__trigger" disabled={draft.constraints.length >= 30} onClick={() => change({ constraints: [...draft.constraints, newConstraint(crypto.randomUUID())] })}><Plus size={15} /> Add constraint</button></header>
          {draft.constraints.length === 0 && <p className="text-small text-muted">No financial or production limits yet. Add constraints, or find the highest-NPV selection using only your case controls.</p>}
          {draft.constraints.map((c, i) => <div className="optimiser-constraint" key={c.id}>
            <label>Metric<select aria-label={`Constraint ${i + 1} metric`} value={c.metric} onChange={e => editConstraint(c.id, { metric: e.target.value, operator: e.target.value === 'capex' ? 'max' : 'min', target: '' })}><option value="capex">Cash Capex</option><option value="production">Production</option></select></label>
            <label>Basis<select value={c.basis} onChange={e => editConstraint(c.id, { basis: e.target.value, target: '' })}><option value="total">Total across period</option><option value="each_year">In every year</option></select></label>
            <Year label="From" value={c.year_from} onChange={year_from => editConstraint(c.id, { year_from })} /><Year label="To" value={c.year_to} onChange={year_to => editConstraint(c.id, { year_to })} />
            <label>Rule<select value={c.operator} onChange={e => editConstraint(c.id, { operator: e.target.value })}><option value="max">Maximum</option><option value="min">Minimum</option></select></label>
            <label>Target ({constraintUnit(c)})<input type="number" min="0" max="1000000000000" step="any" required value={c.target} onChange={e => editConstraint(c.id, { target: e.target.value })} /></label>
            <label>Flexibility<select value={Number(c.flexibility_pct) > 0 ? 'flexible' : 'strict'} onChange={e => editConstraint(c.id, { flexibility_pct: e.target.value === 'strict' ? 0 : 15 })}><option value="strict">Strict</option><option value="flexible">Allow adjustment</option></select></label>
            {Number(c.flexibility_pct) > 0 && <label>Maximum adjustment (%)<input type="number" required min="1" max="15" step="1" value={c.flexibility_pct} onChange={e => editConstraint(c.id, { flexibility_pct: e.target.value })} /></label>}
            <button type="button" className="saved-scenarios__trigger optimiser-remove" aria-label={`Remove constraint ${i + 1}`} title="Remove constraint" onClick={() => change({ constraints: draft.constraints.filter(row => row.id !== c.id) })}><Trash2 size={17} /></button>
          </div>)}
          <p className="text-small text-muted">Strict limits never move. If the original limits are infeasible, flexible limits widen in 1% steps from their original targets, up to each permitted maximum. The first feasible step is used.</p>
        </section>
        <section className="results-panel"><div className="results-panel__header"><div><h3><span className="optimiser-step">3</span> Run optimisation</h3>
          <p className="text-small text-muted">{draft.constraints.length} constraints · {draft.mandatory_case_ids.length} required cases · {draft.excluded_case_ids.length} excluded cases</p></div>
          <button type="submit" className="saved-scenarios__trigger optimiser-primary">{running ? 'Optimising…' : 'Run optimisation'}</button></div>
          {running && <p role="status">Finding a portfolio that meets your limits…</p>}
          {error && <p role="alert">{error}</p>}
        </section>
      </fieldset>
    </form>
    {result && <section className="results-panel" ref={resultRef} tabIndex={-1} aria-labelledby="optimiser-result-title"><div className="results-panel__header"><div><h3 id="optimiser-result-title"><span className="optimiser-step">4</span> Review recommendation</h3>
      <p role="status">{STATUSES[result.status]}{result.status === 'optimal' && (result.relaxation_pct ? ` · with flexibility at step ${result.relaxation_pct}%` : ' · original limits satisfied')}</p></div>
      {result.reconciled && <button className="saved-scenarios__trigger optimiser-primary" aria-haspopup="dialog" onClick={() => setReviewOpen(true)}>Build scenario from recommendation</button>}</div>
      {result.status === 'infeasible' && <p>Review the limits and required cases, or explicitly allow more flexibility. No recommendation has been applied.</p>}
      {result.status === 'time_limit' && <p>No optimal recommendation was established. The time limit does not mean your constraints are impossible.</p>}
      {result.status === 'optimal' && result.selected_case_ids.length === 0 && <p>No cases are recommended. Require a case or add a production minimum to build a scenario.</p>}
      {result.status === 'optimal' && <>
        <p className="text-small text-muted">Metrics for {outcome.request.year_from}–{outcome.request.year_to}. Reference NPV: ${number(result.reference_npv)}m.</p>
        <div className="results-kpis">{[['Post-tax NPV', result.objective_value, '$m'], ['Cash Capex', result.capex, '$m'], ['Production', result.production, 'mmboe'], ['Selected cases', result.selected_case_ids.length, `of ${result.cases.length}`]].map(([label, value, unit]) => <article className="results-kpi" key={label}><h3>{label}</h3><div className="results-kpi__value">{number(value)} <span>{unit}</span></div></article>)}</div>
        <h3>Constraint checks</h3>
        {!result.constraint_checks.length ? <p className="text-small text-muted">No financial or production constraints were specified.</p> : <div className="results-table-scroll"><table><thead><tr><th>Constraint</th><th>Period</th><th>Original target</th><th>Adjusted limit</th><th>Actual</th><th>Actual breach</th><th>Headroom to adjusted limit</th></tr></thead><tbody>
          {result.constraint_checks.map((c, i) => <tr key={i}><td>{c.metric === 'capex' ? 'Cash Capex' : 'Production'} · {c.operator === 'max' ? 'Maximum' : 'Minimum'} ({c.unit})</td><td>{c.year_from}–{c.year_to}</td><td>{number(c.target)}</td><td>{number(c.adjusted_target)} {c.allowed_pct > 0 && `(${c.allowed_pct}% allowed)`}</td><td>{number(c.actual)}</td><td>{c.original_satisfied ? 'Original limit met' : `${number(c.breach_pct)}%`}</td><td>{number(c.headroom)}</td></tr>)}
        </tbody></table></div>}
        <header className="results-table-tools"><h3>Recommended cases</h3><div className="results-table-actions"><button disabled={!sort} onClick={() => setSort(null)}>Reset sorting</button><input type="search" aria-label="Search recommended cases" placeholder="Search cases…" value={search} onChange={e => setSearch(e.target.value)} /></div></header>
        <p className="text-small text-muted">{rows.length} of {result.cases.length} cases shown. Recommended cases appear first. Sorting applies within each group.</p>
        <div className="results-table-scroll"><table><thead><tr>{columns.map(c => { const direction = sort?.key === c.key ? sort.direction : undefined; return <th key={c.key} scope="col" aria-sort={direction}><button className="results-sort" onClick={() => setSort({ key: c.key, direction: direction === 'ascending' ? 'descending' : 'ascending' })}>{c.label} <span aria-hidden="true">{direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}</span></button></th> })}</tr></thead><tbody>
          {rows.map(c => <tr key={c.id} className={c.selected ? 'optimiser-case--recommended' : 'optimiser-case--unselected'}><td>{c.name}<small className="results-case-id">ID {c.id}</small></td><td>{c.selected ? 'Recommended' : 'Not selected'}</td><td>{number(c.npv)}</td><td>{number(c.capex)}</td><td>{number(c.production)}</td></tr>)}
          {!rows.length && <tr><td colSpan={5}>No cases match your search.</td></tr>}
        </tbody></table></div>
      </>}
      <details className="results-data"><summary>View optimisation attempts</summary><ul>{result.attempts.map((a, i) => <li key={i}>{a.relaxation_pct}% adjustment: {STATUSES[a.status]}</li>)}</ul><p>{number(result.solve_time_ms / 1000)} seconds including verification.</p></details>
    </section>}
    {reviewOpen && result && <RecommendationConfirmation result={result} replacesUnsaved={isDirty(working)} onCancel={() => setReviewOpen(false)} onConfirm={review} />}
    {controlsOpen && <OptimiserCaseControls cases={cases} settings={draft} onClose={() => setControlsOpen(false)} onApply={controls => { change(controls); setControlsOpen(false) }} />}
  </div>
}

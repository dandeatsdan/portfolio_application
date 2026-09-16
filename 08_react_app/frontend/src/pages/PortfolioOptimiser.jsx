import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react'
import { SidePanelContext, ScenarioResultContext } from '../App'
import { WorkingScenarioContext } from '../hooks/WorkingScenarioContext'
import { isDirty } from '../hooks/scenarioDefinition'
import { usePortfolio } from '../hooks/usePortfolio'
import { solveOptimisation, getReferenceMeasure } from '../api/client'
import OptimiserPortfolioControls from '../components/OptimiserPortfolioControls'
import RecommendationConfirmation from '../components/RecommendationConfirmation'
import {
  YEARS, OBJECTIVES, DEFAULT_OPTIMISER, newConstraint, constraintUnit,
  optimiserRequest, recommendationDefinition, sortRecommendedCases,
  referenceMix, excludeRegionShares, excludedRegionRules, changeControlRules, effectiveCaseRule,
  clearPortfolioControls, hasMixTargets, runGateBlocked, timingLabel, constraintPeriodColumns, caseConstraintValues,
} from './optimiserHelpers'
import '../components/ScenarioResults.css'
import '../components/PortfolioOptimiser.css'

const fmt = value => value == null ? '—' : (Number(value) === 0 ? 0 : Number(value)).toLocaleString(undefined, { maximumFractionDigits: 2 })
const STATUSES = {
  optimal:    'Optimal selection',
  infeasible: 'No feasible portfolio within the permitted limits',
  time_limit: 'Time limit reached — outcome unresolved',
  solver_error: 'Solver could not complete',
  unbounded:  'Unexpected unbounded model',
}

function Year({ label, value, onChange }) {
  return (
    <label>{label}
      <select value={value} onChange={e => onChange(Number(e.target.value))}>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  )
}

export default function PortfolioOptimiser() {
  const { cases, loading, error: portfolioError } = usePortfolio()
  const { setSidePanel } = useContext(SidePanelContext)
  const { working, dispatch } = useContext(WorkingScenarioContext)
  const { setScenarioResult, setLastRunError } = useContext(ScenarioResultContext)
  const navigate = useNavigate()

  const [draft, setDraft] = useState(() => ({ ...DEFAULT_OPTIMISER, constraints: [] }))
  const [reference, setReference] = useState(null)
  const [referenceError, setReferenceError] = useState(null)
  const [referenceRetry, setReferenceRetry] = useState(0)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(null)
  const [showConstraintValues, setShowConstraintValues] = useState(false)
  const generation = useRef(0)
  const runLock = useRef(false)
  const resultRef = useRef(null)

  useEffect(() => { setSidePanel(null); return () => { generation.current++ } }, [setSidePanel])
  useEffect(() => { if (outcome) resultRef.current?.focus() }, [outcome])

  const periodKey = `${draft.year_from}-${draft.year_to}`
  const referenceReady = reference?.periodKey === periodKey
  useEffect(() => {
    if (!cases.length || draft.year_from > draft.year_to) return
    let active = true
    setReference(null)
    setReferenceError(null)
    getReferenceMeasure('Total Production (mboed)', { from: draft.year_from, to: draft.year_to })
      .then(rows => {
        if (!active) return
        const shares = referenceMix(cases, rows)
        setReference({ periodKey, shares })
        setDraft(d => ({ ...d,
          group_entity_mix: { ...d.group_entity_mix, sliders: shares.group_entity },
          region_mix: { ...d.region_mix, sliders: excludeRegionShares(shares.region, excludedRegionRules(d, cases)) },
        }))
      })
      .catch(err => { if (active) setReferenceError(err.message) })
    return () => { active = false }
  }, [cases, draft.year_from, draft.year_to, periodKey, referenceRetry])

  function change(update) {
    generation.current++
    setDraft(d => ({ ...d, ...update })); setOutcome(null); setError(null)
  }
  function editConstraint(id, update) { change({ constraints: draft.constraints.map(c => c.id === id ? { ...c, ...update } : c) }) }
  function changeControls(update) {
    change(changeControlRules(draft, cases, update, reference?.shares.region))
  }

  async function run() {
    if (runLock.current || (hasMixTargets(draft) && !referenceReady)) return
    let request
    try { request = optimiserRequest(draft) }
    catch (err) { setError(err.message); return }
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
  const caseMetadata = new Map(cases.map(c => [c.id, c]))
  const rows = sortRecommendedCases(
    (result?.cases ?? []).map(c => {
      const metadata = caseMetadata.get(c.id)
      return { ...c, ...caseConstraintValues(c), timing_label: timingLabel(c), region: metadata?.region ?? '', country: metadata?.country ?? '', plan_type: metadata?.plan_type ?? '' }
    }).filter(c => `${c.name} ${c.id}`.toLowerCase().includes(search.trim().toLowerCase())),
    sort
  )
  const periodColumns = showConstraintValues ? constraintPeriodColumns(result?.constraint_checks, outcome?.request.constraints) : []
  const columns = [
    { key: 'id', label: 'ID', numeric: true, width: '4%' },
    { key: 'name', label: 'Case Name', width: '15%' },
    { key: 'region', label: 'Region', width: '10%' },
    { key: 'country', label: 'Country', width: '10%' },
    { key: 'plan_type', label: 'Plan Type', width: '8%' },
    { key: 'selected', label: 'Recommendation', width: '12%' },
    { key: 'year_shift', label: 'Timing', width: '10%' },
    { key: 'objective_contribution', label: `${result?.objective_label ?? 'Objective'} (${result?.objective_unit ?? '$m'})`, numeric: true, width: '11%' },
    { key: 'capex', label: 'Cash Capex ($m)', numeric: true, width: '10%' },
    { key: 'production', label: 'Production (mmboe)', numeric: true, width: '10%' },
    ...periodColumns,
  ]
  const blocked = runGateBlocked(draft) || (hasMixTargets(draft) && !referenceReady) || draft.year_from > draft.year_to
  const controlStates = cases.map(c => effectiveCaseRule(draft, c))
  const requiredCount = controlStates.filter(s => s === 'mandatory').length
  const excludedCount = controlStates.filter(s => s === 'excluded').length
  const mixLabels = [draft.group_entity_mix.enabled && 'Oil / Gas', draft.region_mix.enabled && 'Regional'].filter(Boolean)
  const controlsSummary = `${mixLabels.length ? `${mixLabels.join(' and ')} mix targets applied` : 'No mix targets'} · ${requiredCount} ${requiredCount === 1 ? 'case' : 'cases'} required · ${excludedCount} excluded${draft.timing.enabled ? ` · Delay up to ${draft.timing.max_delay_years} years / accelerate up to ${draft.timing.max_acceleration_years} years` : ''}`

  return (
    <div className="portfolio-optimiser">

      {/* Header */}
      <div className="results-heading">
        <div>
          <h2>Portfolio Optimiser</h2>
          <p>Choose what to maximise and find a portfolio that meets your limits.</p>
          <p className="text-small text-muted">All {cases.length} cases are candidates. Optional advanced controls let you set mix, case selections and timing choices.</p>
          <p className="text-small text-muted">Metrics and years with no profile rows contribute zero.</p>
        </div>
      </div>

      <div className="optimiser-controls-summary">
        <div><strong>Advanced controls <span className="text-muted">· Optional</span></strong>
          <p className="text-small text-muted" aria-live="polite">{controlsSummary}</p></div>
        <button type="button" className="saved-scenarios__trigger" aria-haspopup="dialog"
          disabled={running} onClick={() => setControlsOpen(true)}>
          <SlidersHorizontal size={16} /> Advanced controls
        </button>
      </div>

      <form onSubmit={e => { e.preventDefault(); run() }}>
        <fieldset disabled={running} className="optimiser-fields">

          {/* Step 1: Objective */}
          <section className="results-panel">
            <h3><span className="optimiser-step">1</span> Objective</h3>
            <p className="text-small text-muted">Choose what to maximise, then select the years to optimise.</p>
            <div className="optimiser-mode-selector" aria-label="Optimisation objective">
              {OBJECTIVES.map(o => <button key={o.key} type="button" className="optimiser-mode-card"
                aria-pressed={draft.objective === o.key} onClick={() => change({ objective: o.key })}>
                <strong>{o.label}</strong><small>{o.description}</small>
              </button>)}
            </div>
            <div className="optimiser-objective">
              <Year label="From" value={draft.year_from} onChange={year_from => change({ year_from })} />
              <Year label="To"   value={draft.year_to}   onChange={year_to   => change({ year_to })} />
            </div>
          </section>

          {/* Step 2: Constraints */}
          <section className="results-panel">
            <header className="results-panel__header">
              <h3><span className="optimiser-step">2</span> Constraints</h3>
              <button type="button" className="saved-scenarios__trigger"
                disabled={draft.constraints.length >= 30}
                onClick={() => change({ constraints: [...draft.constraints, newConstraint(crypto.randomUUID())] })}>
                <Plus size={15} /> Add constraint
              </button>
            </header>
            {draft.constraints.length === 0 && (
              <p className="text-small text-muted">No limits yet. Add a constraint or optimise using your current settings.</p>
            )}
            {draft.constraints.map((c, i) => (
              <div className="optimiser-constraint" key={c.id}>
                <label>Metric
                  <select value={c.metric} onChange={e => editConstraint(c.id, { metric: e.target.value, operator: e.target.value === 'capex' ? 'max' : 'min', target: '' })}>
                    <option value="capex">Cash Capex</option>
                    <option value="production">Production</option>
                  </select>
                </label>
                <label>Basis
                  <select value={c.basis} onChange={e => editConstraint(c.id, { basis: e.target.value, target: '' })}>
                    <option value="total">Total across period</option>
                    <option value="each_year">In every year</option>
                  </select>
                </label>
                <Year label="From" value={c.year_from} onChange={year_from => editConstraint(c.id, { year_from })} />
                <Year label="To"   value={c.year_to}   onChange={year_to   => editConstraint(c.id, { year_to })} />
                <label>Rule
                  <select value={c.operator} onChange={e => editConstraint(c.id, { operator: e.target.value })}>
                    <option value="max">Maximum</option>
                    <option value="min">Minimum</option>
                  </select>
                </label>
                <label>Target ({constraintUnit(c)})
                  <input type="number" min="0" max="1000000000000" step="any" required value={c.target}
                    onChange={e => editConstraint(c.id, { target: e.target.value })} />
                </label>
                <label>Flexibility
                  <select value={Number(c.flexibility_pct) > 0 ? 'flexible' : 'strict'}
                    onChange={e => editConstraint(c.id, { flexibility_pct: e.target.value === 'strict' ? 0 : 5 })}>
                    <option value="strict">Strict</option>
                    <option value="flexible">Allow adjustment</option>
                  </select>
                </label>
                {Number(c.flexibility_pct) > 0 && (
                  <label>Max adjustment (%)
                    <input type="number" required min="1" max="15" step="1" value={c.flexibility_pct}
                      onChange={e => editConstraint(c.id, { flexibility_pct: e.target.value })} />
                  </label>
                )}
                <button type="button" className="saved-scenarios__trigger optimiser-remove"
                  aria-label={`Remove constraint ${i + 1}`} title="Remove constraint"
                  onClick={() => change({ constraints: draft.constraints.filter(r => r.id !== c.id) })}>
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            {draft.constraints.length > 0 && (
              <p className="text-small text-muted">Strict limits never move. Flexible limits widen in 1% steps up to the permitted maximum.</p>
            )}
          </section>

          {/* Run */}
          <section className="results-panel">
            <div className="results-panel__header">
              <div>
                <h3><span className="optimiser-step">3</span> Run optimisation</h3>
                <p className="text-small text-muted">
                  {draft.constraints.length} constraints
                  {` · ${controlsSummary}`}
                </p>
              </div>
              <button type="submit" className="saved-scenarios__trigger optimiser-primary"
                disabled={blocked || running}>
                {running ? 'Optimising…' : 'Run optimisation'}
              </button>
            </div>
            {blocked && !running && (
              <p role="alert" className="text-small" style={{ color: '#c0392b' }}>
                Check the year range and advanced controls. Mix targets must total 100%; timing limits must be whole years from 0 to 14.
              </p>
            )}
            {running && <p role="status">Finding a portfolio that meets your limits…</p>}
            {error && <p role="alert" style={{ color: '#c0392b' }}>{error}</p>}
          </section>

        </fieldset>
      </form>

      {/* Result */}
      {result && (
        <section className="results-panel" ref={resultRef} tabIndex={-1} aria-labelledby="optimiser-result-title">
          <div className="results-panel__header">
            <div>
              <h3 id="optimiser-result-title"><span className="optimiser-step">Result</span> Recommendation</h3>
              <p role="status">
                {STATUSES[result.status]}
                {result.status === 'optimal' && (result.relaxation_pct
                  ? ` · with flexibility at step ${result.relaxation_pct}%`
                  : ' · original limits satisfied')}
              </p>
            </div>
            {result.reconciled && (
              <button className="saved-scenarios__trigger optimiser-primary" aria-haspopup="dialog"
                onClick={() => setReviewOpen(true)}>
                Build scenario from recommendation
              </button>
            )}
          </div>

          {result.status === 'infeasible' && (
            <p>Review the limits and required cases, or allow more flexibility. No recommendation has been applied.</p>
          )}
          {result.status === 'time_limit' && (
            <p>No optimal recommendation was established within the time limit.</p>
          )}
          {result.timing_options_omitted > 0 && <p className="text-small text-muted">
            {result.timing_options_omitted} timing options were unavailable because they would move nonzero values outside 2026–2040 or leave no profile rows.
          </p>}

          {result.status === 'optimal' && (
            <>
              {/* Executive KPI tiles — always visible */}
              <p className="text-small text-muted">
                Metrics for {outcome.request.year_from}–{outcome.request.year_to}.{' '}
                Reference {result.objective_label}: {fmt(result.reference_objective_value)} {result.objective_unit}.
              </p>
              <div className="results-kpis">
                {[
                  [result.objective_label, result.objective_value, result.objective_unit],
                  ['Cash Capex', result.capex, '$m'],
                  ...(result.objective === 'production' ? [] : [['Production', result.production, 'mmboe']]),
                  ['Selected cases', result.selected_case_ids.length, `of ${result.cases.length}`],
                ].map(([label, value, unit]) => (
                  <article className="results-kpi" key={label}>
                    <h3>{label}</h3>
                    <div className="results-kpi__value">{fmt(value)} <span>{unit}</span></div>
                  </article>
                ))}
              </div>

              {result.mix_checks?.length > 0 && <div className="results-table-scroll">
                <h3>Production mix achieved</h3>
                <table>
                  <thead><tr><th>Mix</th><th>Category</th><th>Target</th><th>Allowed range</th><th>Achieved</th></tr></thead>
                  <tbody>{result.mix_checks.map(c => <tr key={`${c.dimension}-${c.value}`}>
                    <td>{c.dimension === 'region' ? 'Region' : 'Oil / Gas'}</td><td>{c.value}</td>
                    <td>{fmt(c.target_share_pct)}%</td><td>{fmt(c.min_share_pct)}–{fmt(c.max_share_pct)}%</td><td>{fmt(c.actual_share_pct)}%</td>
                  </tr>)}</tbody>
                </table>
              </div>}

              {/* Recommended cases table — always visible */}
              <header className="results-table-tools">
                <h3>Recommended cases</h3>
                <div className="results-table-actions">
                  <button disabled={!sort} onClick={() => setSort(null)}>Reset sorting</button>
                  <input type="search" aria-label="Search cases" placeholder="Search cases…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </header>
              {result.selected_case_ids.length === 0 && (
                <p>No cases recommended. Add a production minimum or require a case to build a scenario.</p>
              )}
              {result.constraint_checks.length > 0 && <label className="optimiser-check-label">
                <input type="checkbox" checked={showConstraintValues}
                  onChange={event => { setShowConstraintValues(event.target.checked); setSort(null) }} />
                Show constraint-period values
              </label>}
              <p className="text-small text-muted">{rows.length} of {result.cases.length} cases shown. Recommended cases appear first.
                {' '}Main metric columns cover {outcome.request.year_from}–{outcome.request.year_to}.
                {' '}Values for recommended cases include their timing changes; values for unselected cases show their reference profiles.</p>
              {showConstraintValues && result.constraint_checks.length > 0 && <p className="text-small text-muted">
                C1, C2, etc. follow the constraint order above. Annual limits have one column per year; totals use the specified period.
                Only recommended cases contribute to the portfolio constraint checks. Cases outside a constraint’s scope contribute zero.
              </p>}
              <div className="results-table-scroll">
                <table className="optimiser-cases-table" aria-label="Recommended cases" style={{ minWidth: 1150 + periodColumns.length * 160 }}>
                  <colgroup>{columns.map(c => <col key={c.key} style={{ width: periodColumns.length && !c.constraint ? parseFloat(c.width) * 11.5 : c.width }} />)}</colgroup>
                  <thead>
                    <tr>
                      {columns.map(c => {
                        const direction = sort?.key === c.key ? sort.direction : undefined
                        return (
                          <th key={c.key} scope="col" aria-sort={direction} className={c.numeric ? 'optimiser-cell--numeric' : undefined}>
                            <button type="button" className="results-sort"
                              aria-label={`${c.label}: sort ${direction === 'ascending' ? 'descending' : 'ascending'}`}
                              onClick={() => setSort({ key: c.key, direction: direction === 'ascending' ? 'descending' : 'ascending' })}>
                              {c.label} <span aria-hidden="true">{direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}</span>
                            </button>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(c => (
                      <tr key={c.id} className={c.selected ? 'optimiser-case--recommended' : 'optimiser-case--unselected'}>
                        <td className="optimiser-cell--numeric optimiser-cell--id">{c.id}</td>
                        <td className="optimiser-cell--name">{c.name}</td>
                        <td>{c.region || '—'}</td>
                        <td>{c.country || '—'}</td>
                        <td>{c.plan_type || '—'}</td>
                        <td>{c.selected ? 'Recommended' : 'Not selected'}</td>
                        <td>{c.timing_label}</td>
                        <td className="optimiser-cell--numeric">{fmt(c.objective_contribution)}</td>
                        <td className="optimiser-cell--numeric">{fmt(c.capex)}</td>
                        <td className="optimiser-cell--numeric">{fmt(c.production)}</td>
                        {periodColumns.map(column => <td className="optimiser-cell--numeric" key={column.key}>{fmt(c[column.key])}</td>)}
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={columns.length}>No cases match your search.</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Analyst detail — collapsed by default */}
              <details className="optimiser-analyst-section">
                <summary>Constraint checks</summary>
                {!result.constraint_checks.length
                  ? <p className="text-small text-muted">No financial or production constraints were specified.</p>
                  : (
                    <div className="results-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Constraint</th><th>Period</th><th>Original target</th>
                            <th>Adjusted limit</th><th>Actual</th><th>Breach</th><th>Headroom</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.constraint_checks.map((c, i) => (
                            <tr key={i}>
                              <td>{c.metric === 'capex' ? 'Cash Capex' : 'Production'} · {c.operator === 'max' ? 'Maximum' : 'Minimum'} ({c.unit})</td>
                              <td>{c.year_from}–{c.year_to}</td>
                              <td>{fmt(c.target)}</td>
                              <td>{fmt(c.adjusted_target)}{c.allowed_pct > 0 && ` (${c.allowed_pct}% allowed)`}</td>
                              <td>{fmt(c.actual)}</td>
                              <td>{c.original_satisfied ? 'Met' : `${fmt(c.breach_pct)}%`}</td>
                              <td>{fmt(c.headroom)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </details>
            </>
          )}

          <details className="optimiser-analyst-section">
            <summary>Optimisation attempts</summary>
            <ul>{result.attempts.map((a, i) => <li key={i}>{a.relaxation_pct}% adjustment: {STATUSES[a.status]}</li>)}</ul>
            <p>{fmt(result.solve_time_ms / 1000)} seconds including verification.</p>
          </details>
        </section>
      )}

      {controlsOpen && <OptimiserPortfolioControls cases={cases} draft={draft}
        reference={reference} referenceReady={referenceReady} referenceError={referenceError}
        onRetry={() => setReferenceRetry(n => n + 1)} onChange={change} onChangeControls={changeControls}
        onClear={() => change(clearPortfolioControls(referenceReady ? reference.shares : undefined))}
        onClose={() => setControlsOpen(false)} />}

      {reviewOpen && result && (
        <RecommendationConfirmation
          result={result}
          replacesUnsaved={isDirty(working)}
          onCancel={() => setReviewOpen(false)}
          onConfirm={review}
        />
      )}
    </div>
  )
}

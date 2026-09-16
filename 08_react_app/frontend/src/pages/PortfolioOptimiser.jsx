import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { SidePanelContext, ScenarioResultContext } from '../App'
import { WorkingScenarioContext } from '../hooks/WorkingScenarioContext'
import { isDirty } from '../hooks/scenarioDefinition'
import { usePortfolio } from '../hooks/usePortfolio'
import { solveOptimisation, getReferenceMeasure } from '../api/client'
import OptimiserControls from '../components/OptimiserControls'
import RecommendationConfirmation from '../components/RecommendationConfirmation'
import {
  YEARS, OBJECTIVES, DEFAULT_OPTIMISER, newConstraint, constraintUnit,
  optimiserRequest, recommendationDefinition, sortRecommendedCases,
  referenceMix, changeMixShare, excludeRegionShares, excludedRegionRules, changeControlRules, effectiveCaseRule,
  mixTotal, runGateBlocked,
} from './optimiserHelpers'
import '../components/ScenarioResults.css'
import '../components/PortfolioOptimiser.css'

const fmt = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
const STATUSES = {
  optimal:    'Optimal selection',
  infeasible: 'No feasible portfolio within the permitted limits',
  time_limit: 'Time limit reached — outcome unresolved',
  solver_error: 'Solver could not complete',
  unbounded:  'Unexpected unbounded model',
}

const MODES = [
  { key: 'full', label: 'Standard', desc: 'Choose an objective and set constraints and targets to optimise your portfolio.' },
  { key: 'mix', label: 'Advanced', desc: 'All Standard options, plus portfolio mix targets and controls by region, country and case.' },
]

function Year({ label, value, onChange }) {
  return (
    <label>{label}
      <select value={value} onChange={e => onChange(Number(e.target.value))}>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  )
}

function MixSection({ title, section, reference, onChange, onReset, excluded = [] }) {
  const total = mixTotal(section.sliders)
  return (
    <div className="optimiser-mix-section">
      <div className="optimiser-mix-heading">
        <label className="optimiser-check-label">
          <input type="checkbox" checked={section.enabled}
            onChange={e => onChange({ ...section, enabled: e.target.checked })} />
          {title}
        </label>
        {section.enabled && <button type="button" className="saved-scenarios__trigger" onClick={onReset}>Reset to reference mix</button>}
      </div>
      {section.enabled && <>
        <label className="optimiser-tolerance">Allowed difference (± percentage points)
          <input type="number" min="0" max="100" step="0.1" required value={section.tolerance}
            onChange={e => onChange({ ...section, tolerance: e.target.value })} />
        </label>
        {Object.entries(section.sliders).map(([value, pct]) => (
          <div key={value} className="optimiser-mix-row">
            <span className="optimiser-mix-label">{value}
              <small className="results-case-id">Reference: {fmt(reference?.[value])}%{excluded.includes(value) ? ' · Excluded' : ''}</small>
            </span>
            <input type="range" min="0" max="100" step="1" value={pct}
              aria-label={`${title}: ${value} target share`} disabled={excluded.includes(value)}
              onChange={e => onChange({ ...section, sliders: changeMixShare(section.sliders, value, e.target.value, excluded) })} />
            <span className="optimiser-mix-value">{fmt(pct)}%</span>
          </div>
        ))}
        <p className="optimiser-mix-total">Total: {fmt(total)}%</p>
      </>}
    </div>
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
    if (runLock.current || (draft.mode === 'mix' && !referenceReady)) return
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
  const rows = sortRecommendedCases(
    (result?.cases ?? []).filter(c => `${c.name} ${c.id}`.toLowerCase().includes(search.trim().toLowerCase())),
    sort
  )
  const columns = [
    { key: 'name', label: 'Case' }, { key: 'selected', label: 'Recommendation' },
    { key: 'objective_contribution', label: `${result?.objective_label ?? 'Objective'} (${result?.objective_unit ?? '$m'})` }, { key: 'capex', label: 'Cash Capex ($m)' },
    { key: 'production', label: 'Production (mmboe)' },
  ]
  const showMix = draft.mode === 'mix'
  const blocked = runGateBlocked(draft) || (showMix && !referenceReady) || draft.year_from > draft.year_to
  const regionExclusions = excludedRegionRules(draft, cases)
  const excludedRegions = Object.keys(regionExclusions)
  const controlStates = showMix ? cases.map(c => effectiveCaseRule(draft, c)) : []

  return (
    <div className="portfolio-optimiser">

      {/* Header */}
      <div className="results-heading">
        <div>
          <h2>Portfolio Optimiser</h2>
          <p>Choose what to maximise and find a portfolio that meets your limits.</p>
          <p className="text-small text-muted">All {cases.length} reference cases are candidates. Decisions are include or exclude at reference profiles.</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="optimiser-mode-selector">
        {MODES.map(m => (
          <button key={m.key} type="button" className="optimiser-mode-card"
            aria-pressed={draft.mode === m.key} disabled={running} onClick={() => change({ mode: m.key })}>
            <strong>{m.label}</strong>
            <small>{m.desc}</small>
          </button>
        ))}
      </div>
      <p className="text-small text-muted">Switching modes keeps your settings. Mix targets and region, country and case controls apply only in Advanced.</p>

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

          {/* Constraints follow the objective in both modes. */}
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

          {showMix && (
            <section className="results-panel">
              <h3><span className="optimiser-step">3</span> Portfolio mix</h3>
              <p className="text-small text-muted">
                Targets are shares of selected production for {draft.year_from}–{draft.year_to}.
                Adjusting one share redistributes the others to keep 100%. Whole cases are selected,
                so the default allowance is ±5 percentage points. Changing the period resets targets to its reference mix.
              </p>
              {referenceError ? <div role="alert"><p>{referenceError}</p><button type="button" onClick={() => setReferenceRetry(n => n + 1)}>Retry reference mix</button></div>
                : !referenceReady ? <p role="status">Loading reference production mix…</p> : <>
                <MixSection title="Oil / Gas mix" section={draft.group_entity_mix}
                  reference={reference.shares.group_entity}
                  onChange={section => change({ group_entity_mix: section })}
                  onReset={() => change({ group_entity_mix: { ...draft.group_entity_mix, sliders: reference.shares.group_entity } })} />
                <MixSection title="Regional mix" section={draft.region_mix} reference={reference.shares.region}
                  excluded={excludedRegions} onChange={section => change({ region_mix: section })}
                  onReset={() => change({ region_mix: { ...draft.region_mix, sliders: excludeRegionShares(reference.shares.region, regionExclusions) } })} />
                <p className="text-small text-muted">Excluding every case in a region redistributes its regional target to the others. Oil / Gas targets stay as set and may need adjusting.</p>
              </>}
            </section>
          )}

          {showMix && <section className="results-panel">
            <h3><span className="optimiser-step">4</span> Controls</h3>
            <p className="text-small text-muted">Choose by region, then refine by country and case. A country overrides its region; a case overrides both.
              Inherit follows the parent rule. Optimiser chooses removes that restriction. Existing more-specific choices remain in effect when a parent changes.</p>
            <OptimiserControls cases={cases} draft={draft} onChange={changeControls} />
          </section>}

          {/* Run */}
          <section className="results-panel">
            <div className="results-panel__header">
              <div>
                <h3><span className="optimiser-step">{showMix ? 5 : 3}</span> Run optimisation</h3>
                <p className="text-small text-muted">
                  {draft.constraints.length} constraints
                  {showMix && ` · ${controlStates.filter(s => s === 'mandatory').length} cases required · ${controlStates.filter(s => s === 'excluded').length} cases excluded`}
                </p>
              </div>
              <button type="submit" className="saved-scenarios__trigger optimiser-primary"
                disabled={blocked || running}>
                {running ? 'Optimising…' : 'Run optimisation'}
              </button>
            </div>
            {blocked && !running && (
              <p role="alert" className="text-small" style={{ color: '#c0392b' }}>
                Check the year range and mix settings. Advanced also needs loaded reference data and targets totalling 100%.
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
              <p className="text-small text-muted">{rows.length} of {result.cases.length} cases shown. Recommended cases appear first.</p>
              <div className="results-table-scroll">
                <table>
                  <thead>
                    <tr>
                      {columns.map(c => {
                        const direction = sort?.key === c.key ? sort.direction : undefined
                        return (
                          <th key={c.key} scope="col" aria-sort={direction}>
                            <button className="results-sort"
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
                        <td>{c.name}<small className="results-case-id">ID {c.id}</small></td>
                        <td>{c.selected ? 'Recommended' : 'Not selected'}</td>
                        <td>{fmt(c.objective_contribution)}</td>
                        <td>{fmt(c.capex)}</td>
                        <td>{fmt(c.production)}</td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={5}>No cases match your search.</td></tr>}
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

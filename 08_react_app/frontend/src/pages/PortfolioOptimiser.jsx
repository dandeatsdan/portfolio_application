import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { SidePanelContext, ScenarioResultContext } from '../App'
import { WorkingScenarioContext } from '../hooks/WorkingScenarioContext'
import { isDirty } from '../hooks/scenarioDefinition'
import { usePortfolio } from '../hooks/usePortfolio'
import { solveOptimisation, getReferenceMeasure } from '../api/client'
import OptimiserCaseControls from '../components/OptimiserCaseControls'
import RecommendationConfirmation from '../components/RecommendationConfirmation'
import SwitchModeConfirmation from '../components/SwitchModeConfirmation'
import {
  YEARS, DEFAULT_OPTIMISER, newConstraint, constraintUnit,
  optimiserRequest, recommendationDefinition, sortRecommendedCases,
  buildReferenceTotals, initSliders, prePopulateBalancedMix,
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
  { key: 'full',     label: 'Full Control',  desc: 'Solver has complete freedom. Find the unconstrained value ceiling.' },
  { key: 'guided',   label: 'Guided',        desc: 'Set portfolio mix targets and financial limits. Solver works within your bounds.' },
  { key: 'balanced', label: 'Balanced',      desc: 'Start from today\'s portfolio proportions and adjust the allocation.' },
]

const OBJECTIVES = [
  { key: 'post_tax_fcf',    label: 'Free Cash Flow',    desc: 'Maximise post-tax free cash flow (undiscounted sum).' },
  { key: 'underlying_rcop', label: 'Underlying RCOP',   desc: 'Maximise post-tax RCOP (undiscounted sum).' },
  { key: 'production',      label: 'Production',        desc: 'Maximise total production (mmboe).' },
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

function MixSection({ title, section, dimField, cases, referenceTotals, onChange, onReset }) {
  const dimTotals = referenceTotals?.[section.metric]?.[dimField] || {}
  const grandTotal = Object.values(dimTotals).reduce((a, b) => a + b, 0)
  const total = mixTotal(section.sliders)
  const totalOk = Math.round(total) === 100

  return (
    <div className="optimiser-mix-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
          <input type="checkbox" checked={section.enabled}
            onChange={e => onChange({ ...section, enabled: e.target.checked })} />
          {title}
        </label>
        {section.enabled && (
          <label style={{ fontSize: 13, marginLeft: 'auto' }}>
            Metric&nbsp;
            <select value={section.metric}
              onChange={e => onChange({ ...section, metric: e.target.value })}>
              <option value="production">Production</option>
              <option value="capex">Capex</option>
            </select>
          </label>
        )}
      </div>
      {section.enabled && (
        <>
          {onReset && (
            <button type="button" className="saved-scenarios__trigger" style={{ marginBottom: 8 }} onClick={onReset}>
              Reset to today's levels
            </button>
          )}
          {Object.entries(section.sliders).map(([dim, pct]) => {
            const refPct = grandTotal > 0 ? ((dimTotals[dim] || 0) / grandTotal) * 100 : 0
            return (
              <div key={dim} className="optimiser-mix-row">
                <span className="optimiser-mix-label">{dim || 'Unknown'}</span>
                <div className="optimiser-mix-slider">
                  <div className="optimiser-mix-reference-bar" style={{ width: `${refPct}%` }} title={`Reference: ${refPct.toFixed(1)}%`} />
                  <input type="range" min="0" max="100" step="1" value={pct}
                    onChange={e => onChange({ ...section, sliders: { ...section.sliders, [dim]: Number(e.target.value) } })} />
                </div>
                <span className="optimiser-mix-value">{Math.round(Number(pct))}%</span>
              </div>
            )
          })}
          <div className={`optimiser-mix-total optimiser-mix-total--${totalOk ? 'ok' : 'error'}`}>
            Total: {Math.round(total)}%
            {!totalOk && <span className="optimiser-mix-warning"> — allocations must sum to 100% before running</span>}
          </div>
        </>
      )}
    </div>
  )
}

function TierLocks({ title, locks, cases, dimField, onChange }) {
  const dimValues = [...new Set(cases.map(c => c[dimField]).filter(Boolean))].sort()
  return (
    <div className="optimiser-tier">
      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{title}</p>
      {dimValues.map(val => (
        <div key={val} className="optimiser-tier-row">
          <span>{val}</span>
          <select value={locks[val] || 'optional'}
            onChange={e => onChange({ ...locks, [val]: e.target.value })}>
            <option value="optional">Optimiser chooses</option>
            <option value="mandatory">All included</option>
            <option value="excluded">All excluded</option>
          </select>
        </div>
      ))}
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
  const [referenceTotals, setReferenceTotals] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState(null)
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

  // Fetch reference totals once cases are loaded
  useEffect(() => {
    if (!cases.length) return
    Promise.all([
      getReferenceMeasure('Total Production (mboed)', { from: 2026, to: 2040 }),
      getReferenceMeasure('Cash Capex', { from: 2026, to: 2040 }),
    ]).then(([prod, capex]) => {
      setReferenceTotals(buildReferenceTotals(cases, prod, capex))
    }).catch(() => {})
  }, [cases])

  // Initialise sliders when cases first load
  useEffect(() => {
    if (!cases.length) return
    setDraft(d => ({
      ...d,
      group_entity_mix: { ...d.group_entity_mix, sliders: initSliders(cases, 'group_entity') },
      region_mix:       { ...d.region_mix,       sliders: initSliders(cases, 'region') },
    }))
  }, [cases])

  function change(update) { setDraft(d => ({ ...d, ...update })); setOutcome(null); setError(null) }
  function editConstraint(id, update) { change({ constraints: draft.constraints.map(c => c.id === id ? { ...c, ...update } : c) }) }

  function applyModeSwitch(newMode) {
    const reset = {
      ...DEFAULT_OPTIMISER,
      year_from: draft.year_from,
      year_to: draft.year_to,
      objective: draft.objective,
      constraints: [],
      mode: newMode,
      group_entity_mix: { enabled: false, metric: 'production', sliders: initSliders(cases, 'group_entity') },
      region_mix:       { enabled: false, metric: 'production', sliders: initSliders(cases, 'region') },
    }
    if (newMode === 'balanced' && referenceTotals) {
      const pre = prePopulateBalancedMix(cases, referenceTotals)
      Object.assign(reset, pre)
    }
    setDraft(reset); setOutcome(null); setError(null)
  }

  function switchMode(newMode) {
    if (newMode === draft.mode) return
    const touched = draft.constraints.length ||
      Object.values(draft.group_entity_locks).some(v => v !== 'optional') ||
      Object.values(draft.region_locks).some(v => v !== 'optional') ||
      draft.group_entity_mix.enabled || draft.region_mix.enabled
    if (touched) { setPendingMode(newMode); return }
    applyModeSwitch(newMode)
  }

  async function run() {
    if (runLock.current) return
    let request
    try { request = optimiserRequest(draft, cases, referenceTotals) }
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
  const objLabel = outcome?.request?.objective
  const objColLabel = objLabel === 'production' ? 'Production (mmboe)' : objLabel === 'underlying_rcop' ? 'RCOP ($m)' : 'FCF ($m)'
  const columns = [
    { key: 'name', label: 'Case' }, { key: 'selected', label: 'Recommendation' },
    { key: 'npv', label: objColLabel }, { key: 'capex', label: 'Cash Capex ($m)' },
    { key: 'production', label: 'Production (mmboe)' },
  ]
  const blocked = runGateBlocked(draft)
  const showMix = draft.mode === 'guided' || draft.mode === 'balanced'

  return (
    <div className="portfolio-optimiser">

      {/* Header */}
      <div className="results-heading">
        <div>
          <h2>Portfolio Optimiser</h2>
          <p>Find the portfolio selection that maximises value within your limits.</p>
          <p className="text-small text-muted">All {cases.length} reference cases are candidates. Decisions are include or exclude at reference profiles.</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="optimiser-mode-selector">
        {MODES.map(m => (
          <button key={m.key} type="button" className="optimiser-mode-card"
            aria-pressed={draft.mode === m.key} onClick={() => switchMode(m.key)}>
            <strong>{m.label}</strong>
            <small>{m.desc}</small>
          </button>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); run() }}>
        <fieldset disabled={running} className="optimiser-fields">

          {/* Step 1: Objective */}
          <section className="results-panel">
            <h3><span className="optimiser-step">1</span> Objective</h3>
            <div className="optimiser-mode-selector" style={{ marginBottom: 16 }}>
              {OBJECTIVES.map(o => (
                <button key={o.key} type="button" className="optimiser-mode-card"
                  aria-pressed={draft.objective === o.key}
                  onClick={() => change({ objective: o.key })}>
                  <strong>{o.label}</strong>
                  <small>{o.desc}</small>
                </button>
              ))}
            </div>
            <div className="optimiser-objective">
              <Year label="From" value={draft.year_from} onChange={year_from => change({ year_from })} />
              <Year label="To"   value={draft.year_to}   onChange={year_to   => change({ year_to })} />
            </div>
          </section>

          {/* Step 2: Portfolio mix — Guided and Balanced modes only */}
          {showMix && (
            <section className="results-panel">
              <h3><span className="optimiser-step">2</span> Portfolio mix</h3>
              <p className="text-small text-muted">
                Set minimum production allocations by dimension. The grey bar shows today's reference proportion.
                Enabled mix sections must sum to 100% before you can run.
              </p>
              <MixSection
                title="Oil / Gas mix (Group Entity)"
                section={draft.group_entity_mix}
                dimField="group_entity"
                cases={cases}
                referenceTotals={referenceTotals}
                onChange={s => change({ group_entity_mix: s })}
                onReset={draft.mode === 'balanced' && referenceTotals ? () => {
                  const pre = prePopulateBalancedMix(cases, referenceTotals)
                  change({ group_entity_mix: pre.group_entity_mix })
                } : undefined}
              />
              <MixSection
                title="Regional mix"
                section={draft.region_mix}
                dimField="region"
                cases={cases}
                referenceTotals={referenceTotals}
                onChange={s => change({ region_mix: s })}
                onReset={draft.mode === 'balanced' && referenceTotals ? () => {
                  const pre = prePopulateBalancedMix(cases, referenceTotals)
                  change({ region_mix: pre.region_mix })
                } : undefined}
              />
            </section>
          )}

          {/* Step 3 (or 2 in Full Control): Portfolio limits */}
          <section className="results-panel">
            <header className="results-panel__header">
              <h3><span className="optimiser-step">{showMix ? 3 : 2}</span> Portfolio limits</h3>
              <button type="button" className="saved-scenarios__trigger"
                disabled={draft.constraints.length >= 30}
                onClick={() => change({ constraints: [...draft.constraints, newConstraint(crypto.randomUUID())] })}>
                <Plus size={15} /> Add constraint
              </button>
            </header>
            {draft.constraints.length === 0 && (
              <p className="text-small text-muted">No limits yet. Add constraints, or run with only your mix targets and case controls.</p>
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
                    onChange={e => editConstraint(c.id, { flexibility_pct: e.target.value === 'strict' ? 0 : 15 })}>
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

          {/* Case controls */}
          <section className="results-panel">
            <h3><span className="optimiser-step">{showMix ? 4 : 3}</span> Case controls</h3>
            <p className="text-small text-muted">Lock entire regions or groups, then override individual cases if needed.</p>

            <TierLocks title="Group Entity locks" locks={draft.group_entity_locks} cases={cases}
              dimField="group_entity" onChange={locks => change({ group_entity_locks: locks })} />

            <TierLocks title="Region locks" locks={draft.region_locks} cases={cases}
              dimField="region" onChange={locks => change({ region_locks: locks })} />

            <details className="optimiser-analyst-section">
              <summary>Individual case overrides</summary>
              <OptimiserCaseControls
                cases={cases}
                mandatoryIds={draft.mandatory_case_ids}
                excludedIds={draft.excluded_case_ids}
                onChange={({ mandatory_case_ids, excluded_case_ids }) =>
                  change({ mandatory_case_ids, excluded_case_ids })}
              />
            </details>
          </section>

          {/* Run */}
          <section className="results-panel">
            <div className="results-panel__header">
              <div>
                <h3><span className="optimiser-step">{showMix ? 5 : 4}</span> Run optimisation</h3>
                <p className="text-small text-muted">
                  {draft.constraints.length} constraints ·{' '}
                  {draft.mandatory_case_ids.length} individual required ·{' '}
                  {draft.excluded_case_ids.length} individual excluded
                </p>
              </div>
              <button type="submit" className="saved-scenarios__trigger optimiser-primary"
                disabled={blocked || running}>
                {running ? 'Optimising…' : 'Run optimisation'}
              </button>
            </div>
            {blocked && !running && (
              <p role="alert" className="text-small" style={{ color: '#c0392b' }}>
                Portfolio mix allocations must each sum to 100% before running.
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
                Reference {OBJECTIVES.find(o => o.key === outcome.request.objective)?.label ?? 'value'}:{' '}
                {outcome.request.objective === 'production' ? fmt(result.reference_npv) + ' mmboe' : '$' + fmt(result.reference_npv) + 'm'}.
              </p>
              <div className="results-kpis">
                {[
                  [OBJECTIVES.find(o => o.key === outcome.request.objective)?.label ?? 'Objective', result.objective_value,
                    outcome.request.objective === 'production' ? 'mmboe' : '$m'],
                  ['Cash Capex', result.capex, '$m'],
                  ['Production', result.production, 'mmboe'],
                  ['Selected cases', result.selected_case_ids.length, `of ${result.cases.length}`],
                ].map(([label, value, unit]) => (
                  <article className="results-kpi" key={label}>
                    <h3>{label}</h3>
                    <div className="results-kpi__value">{fmt(value)} <span>{unit}</span></div>
                  </article>
                ))}
              </div>

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
                        <td>{fmt(c.npv)}</td>
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

      {pendingMode && (
        <SwitchModeConfirmation
          newModeLabel={MODES.find(m => m.key === pendingMode)?.label}
          onCancel={() => setPendingMode(null)}
          onConfirm={() => { applyModeSwitch(pendingMode); setPendingMode(null) }}
        />
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

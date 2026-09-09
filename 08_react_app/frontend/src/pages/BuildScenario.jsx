import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleHelp, Pencil } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { useScenario, OPERATION_LABELS } from '../hooks/useScenario'
import { getTotals } from '../api/client'
import { SelectionContext, ScenarioResultContext } from '../App'
import { SCENARIO_CASE_COLUMNS, SHORTLIST_CASE_COLUMNS, sortScenarioCases } from './scenarioCaseSort'
import OperationsGuide from '../components/OperationsGuide'

const YEAR_OPTIONS = ['Total 5Y', 'Average 5Y', '2026', '2027', '2028', '2029', '2030']
const YEAR_COL_MAP = { 'Total 5Y': 'total_5y', 'Average 5Y': 'average_5y', '2026': 'y2026', '2027': 'y2027', '2028': 'y2028', '2029': 'y2029', '2030': 'y2030' }

function fmt(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function SortableCaseHeader({ column: { key, label, numeric }, sort, onSort }) {
  const direction = sort?.key === key ? sort.direction : undefined
  const nextDirection = direction === 'ascending' ? 'descending' : 'ascending'
  return (
    <th scope="col" aria-sort={direction} style={{ padding: '8px 10px', textAlign: numeric ? 'right' : 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      <button
        type="button"
        onClick={() => onSort(key)}
        aria-label={`${label}: sort ${nextDirection}`}
        title={`${label}: sort ${nextDirection}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: numeric ? 'flex-end' : 'flex-start', gap: 3, width: '100%', padding: 0, border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}
      >
        {label}
        <span aria-hidden="true" style={{ fontSize: 9 }}>{direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}</span>
      </button>
    </th>
  )
}

export default function BuildScenario() {
  const navigate = useNavigate()
  const { cases, metrics, loading, error } = usePortfolio()
  const { selectedIds, setSelectedIds } = useContext(SelectionContext)
  const { setScenarioResult, setLastRunError } = useContext(ScenarioResultContext)

  const scenario = useScenario(cases, selectedIds)

  const [totals,        setTotals]        = useState([])
  const [screenMetric,  setScreenMetric]  = useState('')
  const [screenYear,    setScreenYear]    = useState('2026')
  const [availableSearch, setAvailableSearch] = useState('')
  const [availableOpen, setAvailableOpen] = useState(false)
  const [availableSort, setAvailableSort] = useState(null)
  const [shortlistSort, setShortlistSort] = useState(null)
  const [operationsGuideOpen, setOperationsGuideOpen] = useState(false)

  // Shortlist membership is separate from whether a shortlisted case is included in a run.
  const workingCases = cases.filter(c => selectedIds.has(c.id))
  const availableCases = cases.filter(c => !selectedIds.has(c.id))
  const visibleAvailableCases = availableCases.filter(c =>
    (c.case_name ?? '').toLowerCase().includes(availableSearch.trim().toLowerCase())
  )

  function addToShortlist(id) {
    scenario.resetCase(id)
    setSelectedIds(prev => new Set([...prev, id]))
  }

  function removeFromShortlist(id) {
    scenario.resetCase(id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  useEffect(() => {
    if (workingCases.length > 0) scenario.initCases(workingCases, [...selectedIds])
  }, [cases, selectedIds]) // eslint-disable-line

  useEffect(() => {
    getTotals().then(setTotals).catch(() => setTotals([]))
  }, [])

  useEffect(() => {
    if (metrics.length && !screenMetric) setScreenMetric(metrics[0])
  }, [metrics]) // eslint-disable-line

  function getRef(caseStr) {
    if (!screenMetric || !screenYear || !totals.length) return null
    const col = YEAR_COL_MAP[screenYear]
    const row = totals.find(r => r.case === caseStr && r.metric === screenMetric)
    return row ? row[col] : null
  }

  const sortedAvailableCases = sortScenarioCases(
    visibleAvailableCases.map(c => ({ ...c, reference: getRef(c.case) })),
    availableSort,
  )
  const sortedShortlistedCases = sortScenarioCases(
    workingCases.map(c => ({ ...c, reference: getRef(c.case) })),
    shortlistSort,
  )

  function toggleAvailableSort(key) {
    setAvailableSort(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }))
  }

  function toggleShortlistSort(key) {
    setShortlistSort(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }))
  }

  const ops = Object.fromEntries(
    workingCases.map(c => [c.id, scenario.caseConfig[c.id] ?? { include: true, operation: 'No Change', params: [0,0,0,0,0] }])
  )

  const { includedCount, modifiedCount } = scenario

  async function handleRun() {
    await scenario.run()
  }

  useEffect(() => {
    if (scenario.result?.valid) {
      setLastRunError(null)
      setScenarioResult(scenario.result)
      navigate('/results')
    }
  }, [scenario.result]) // eslint-disable-line

  useEffect(() => {
    if (scenario.runError) setLastRunError(scenario.runError)
  }, [scenario.runError, setLastRunError])

  if (loading) return <p>Loading…</p>
  if (error)   return <p style={{ color: 'var(--color-negative)' }}>Error: {error}</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ flex: '1 1 320px' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Build a Scenario</h2>
          <p className="text-small text-muted" style={{ margin: 0 }}>
            All cases are included using their reference profiles by default. Shortlist cases to review them or choose whether to include or exclude them.
            Included shortlisted cases can also be adjusted using operations such as delay or farm-down.
            Removing a case from the shortlist restores its reference profile and automatically includes it in the scenario.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={scenario.running || includedCount === 0}
          style={{
            padding: '0.7rem 1.6rem',
            background: scenario.running || includedCount === 0 ? 'var(--color-border)' : 'var(--color-accent-dark)',
            color: '#fff', border: 'none', borderRadius: 4,
            fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
            cursor: scenario.running || includedCount === 0 ? 'default' : 'pointer',
          }}
        >
          {scenario.running ? 'Running…' : `▶ Run Scenario (${includedCount} included)`}
        </button>
      </div>

      {scenario.runError && (
        <div role="alert" style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid var(--color-negative)', borderRadius: 4, color: 'var(--color-negative)', marginBottom: '1rem', fontSize: 13 }}>
          {scenario.runError}
        </div>
      )}
      {scenario.runError && <p role="status">The previous successful result, if any, is still available on Scenario Results.</p>}
      {scenario.diagnostics.length > 0 && (
        <ul role="alert">{scenario.diagnostics.map((d, i) =>
          <li key={i}>{d.Case ? `${d.Case}: ` : ''}{d.message ?? d.Message}</li>
        )}</ul>
      )}

      {/* Scenario metadata */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <label style={{ flex: '0 1 260px', minWidth: 0, maxWidth: '100%', fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-muted)' }}>Scenario Name</span>
          <span style={{ display: 'block', position: 'relative' }}>
            <input value={scenario.name} onChange={e => scenario.setName(e.target.value)}
              style={{ width: '100%', padding: '6px 32px 6px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13 }} />
            <Pencil size={14} aria-hidden="true" focusable="false"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          </span>
        </label>
        <label style={{ flex: '0 1 480px', minWidth: 0, maxWidth: '100%', fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-muted)' }}>Description</span>
          <span style={{ display: 'block', position: 'relative' }}>
            <input value={scenario.description} onChange={e => scenario.setDescription(e.target.value)}
              placeholder="Describe the assumptions being tested…"
              style={{ width: '100%', padding: '6px 32px 6px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13 }} />
            <Pencil size={14} aria-hidden="true" focusable="false"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          </span>
        </label>
      </div>

      {/* Reference screening selector */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>Reference screening</span>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          Metric
          <select value={screenMetric} onChange={e => setScreenMetric(e.target.value)} style={{ fontSize: 13, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 4 }}>
            {metrics.map(m => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          Period
          <select value={screenYear} onChange={e => setScreenYear(e.target.value)} style={{ fontSize: 13, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 4 }}>
            {YEAR_OPTIONS.map(y => <option key={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {/* Case configuration table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.35rem' }}>
        <h3 style={{ margin: 0 }}>Shortlisted cases ({workingCases.length})</h3>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-controls="operations-guide"
            onClick={() => setOperationsGuideOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: '#fff', color: 'var(--color-accent-dark)', fontSize: 12 }}
          >
            <CircleHelp size={14} aria-hidden="true" />
            Operations guide
          </button>
          <button
            type="button"
            aria-label="Reset shortlisted cases sorting"
            disabled={shortlistSort === null}
            onClick={() => setShortlistSort(null)}
            style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: '#fff', color: shortlistSort ? 'var(--color-accent-dark)' : 'var(--color-text-muted)', cursor: shortlistSort ? 'pointer' : 'default', fontSize: 12 }}
          >
            Reset sorting
          </button>
        </div>
      </div>
      <p role="status" className="text-small text-muted" style={{ marginBottom: '0.5rem' }}>
        Portfolio: {includedCount} included · {cases.length - includedCount} excluded · {modifiedCount} modified
      </p>
      <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
        <table aria-label="Shortlisted cases" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border-strong)' }}>
              {SHORTLIST_CASE_COLUMNS.map(column => (
                <SortableCaseHeader key={column.key} column={column} sort={shortlistSort} onSort={toggleShortlistSort} />
              ))}
              {['In scenario', 'Operation', 'Input 1', 'Input 2', 'Input 3', 'Shortlist'].map(h => (
                <th key={h} scope="col" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workingCases.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <span role="status">No cases shortlisted. All cases will use their reference profiles. Expand Available cases below to shortlist cases for adjustment, exclusion, or review.</span>
                </td>
              </tr>
            )}
            {sortedShortlistedCases.map(c => {
              const cs = ops[c.id] ?? { include: true, operation: 'No Change', params: [0,0,0,0,0] }
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', background: cs.include ? 'transparent' : 'var(--color-surface)' }}>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{c.id}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.case_name}</td>
                  <td style={{ padding: '7px 10px' }}>{c.region}</td>
                  <td style={{ padding: '7px 10px' }}>{c.plan_type}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.reference)}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 12 }}>
                      <input type="checkbox" checked={cs.include}
                        aria-label={`Include ${c.case_name} in scenario`}
                        onChange={e => scenario.setCaseField(c.id, 'include', e.target.checked)}
                        style={{ accentColor: 'var(--color-accent-dark)' }}
                      />
                      {cs.include ? 'Included' : 'Excluded'}
                    </label>
                  </td>
                  <td style={{ padding: '7px 6px' }}>
                    <select value={cs.operation}
                      onChange={e => scenario.setCaseField(c.id, 'operation', e.target.value)}
                      disabled={!cs.include}
                      style={{ fontSize: 12, padding: '3px 5px', border: '1px solid var(--color-border)', borderRadius: 4, width: 170 }}
                    >
                      {OPERATION_LABELS.map(op => <option key={op}>{op}</option>)}
                    </select>
                  </td>
                  {[0, 1, 2].map(idx => (
                    <td key={idx} style={{ padding: '7px 4px' }}>
                      <input type="number" step="any"
                        value={cs.params[idx] ?? 0}
                        onChange={e => scenario.setParam(c.id, idx, parseFloat(e.target.value) || 0)}
                        disabled={!cs.include || cs.operation === 'No Change'}
                        style={{ width: 72, padding: '3px 5px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, textAlign: 'right' }}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '7px 10px' }}>
                    <button
                      type="button"
                      onClick={() => removeFromShortlist(c.id)}
                      disabled={scenario.running}
                      aria-label={`Remove ${c.case_name} from shortlist`}
                      style={{ padding: '4px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-accent-dark)', fontSize: 12 }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Available cases — adding/removing uses the shortlist shared with Portfolio Viewer. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0.5rem 0', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Available cases ({availableCases.length})</h3>
        <button
          type="button"
          aria-expanded={availableOpen}
          aria-controls="available-cases-content"
          onClick={() => setAvailableOpen(prev => !prev)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '4px 8px', border: 'none', background: 'transparent', color: 'var(--color-accent-dark)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          {availableOpen ? 'Hide cases' : 'Show cases'}
          <span aria-hidden="true">{availableOpen ? '▴' : '▾'}</span>
        </button>
      </div>
      <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
        These cases are automatically included using their reference profiles. Add them to the shortlist to adjust assumptions, exclude them, or review them.
      </p>
      <div id="available-cases-content" hidden={!availableOpen}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <span className="text-small text-muted">{visibleAvailableCases.length} of {availableCases.length} available cases shown.</span>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              aria-label="Reset available cases sorting"
              disabled={availableSort === null}
              onClick={() => setAvailableSort(null)}
              style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: '#fff', color: availableSort ? 'var(--color-accent-dark)' : 'var(--color-text-muted)', cursor: availableSort ? 'pointer' : 'default', fontSize: 12 }}
            >
              Reset sorting
            </button>
            <input
              type="search"
              aria-label="Search available cases"
              placeholder="Search available cases…"
              value={availableSearch}
              onChange={e => setAvailableSearch(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, width: 220, maxWidth: '100%' }}
            />
          </div>
        </div>
        <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
          <table aria-label="Available cases" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border-strong)' }}>
                {SCENARIO_CASE_COLUMNS.map(column => (
                  <SortableCaseHeader key={column.key} column={column} sort={availableSort} onSort={toggleAvailableSort} />
                ))}
                <th scope="col" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Shortlist</th>
              </tr>
            </thead>
            <tbody>
              {visibleAvailableCases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <span role="status">{availableCases.length === 0 ? 'All cases are shortlisted.' : 'No available cases match your search.'}</span>
                  </td>
                </tr>
              )}
              {sortedAvailableCases.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{c.id}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.case_name}</td>
                  <td style={{ padding: '7px 10px' }}>{c.region}</td>
                  <td style={{ padding: '7px 10px' }}>{c.country}</td>
                  <td style={{ padding: '7px 10px' }}>{c.plan_type}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.reference)}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <button
                      type="button"
                      onClick={() => addToShortlist(c.id)}
                      disabled={scenario.running}
                      aria-label={`Add ${c.case_name} to shortlist`}
                      style={{ padding: '4px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-accent-dark)', fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      Add to shortlist
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rationale */}
      <label style={{ display: 'block', marginBottom: '1.25rem', fontSize: 13 }}>
        <span style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-muted)' }}>Scenario Rationale</span>
        <textarea value={scenario.rationale} onChange={e => scenario.setRationale(e.target.value)}
          placeholder="Describe the business reasoning behind these scenario choices…"
          rows={3}
          style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13, fontFamily: 'var(--font-family)', resize: 'vertical' }}
        />
      </label>

      <OperationsGuide open={operationsGuideOpen} onClose={() => setOperationsGuideOpen(false)} />
    </div>
  )
}

import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../hooks/usePortfolio'
import { useScenario, OPERATION_LABELS } from '../hooks/useScenario'
import { getTotals } from '../api/client'
import JourneyStrip from '../components/JourneyStrip'
import { SelectionContext, ScenarioResultContext } from '../App'

const YEAR_OPTIONS = ['Total 5Y', 'Average 5Y', '2026', '2027', '2028', '2029', '2030']
const YEAR_COL_MAP = { 'Total 5Y': 'total_5y', 'Average 5Y': 'average_5y', '2026': 'y2026', '2027': 'y2027', '2028': 'y2028', '2029': 'y2029', '2030': 'y2030' }

function fmt(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export default function BuildScenario() {
  const navigate = useNavigate()
  const { cases, metrics, loading, error } = usePortfolio()
  const { selectedIds } = useContext(SelectionContext)
  const { setScenarioResult, setLastRunError } = useContext(ScenarioResultContext)

  const scenario = useScenario(cases)

  const [totals,        setTotals]        = useState([])
  const [screenMetric,  setScreenMetric]  = useState('')
  const [screenYear,    setScreenYear]    = useState('2026')

  // Filter to selected cases (or all if nothing selected)
  const workingCases = selectedIds.size > 0 ? cases.filter(c => selectedIds.has(c.id)) : cases

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

  const ops = Object.fromEntries(
    workingCases.map(c => [c.id, scenario.caseConfig[c.id] ?? { include: true, operation: 'No Change', params: [0,0,0,0,0] }])
  )

  const includedCount = workingCases.filter(c => ops[c.id]?.include !== false).length

  async function handleRun() {
    await scenario.run(workingCases)
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
      <JourneyStrip current="build" />
      <h2 style={{ marginBottom: '0.25rem' }}>Build a Scenario</h2>
      <p className="text-small text-muted" style={{ marginBottom: '1.25rem' }}>
        {selectedIds.size > 0
          ? `Showing ${workingCases.length} case(s) shortlisted from Portfolio Viewer.`
          : 'No Portfolio Viewer selection — showing all cases.'}
      </p>

      {/* Scenario metadata */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 200px', fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-muted)' }}>Scenario Name</span>
          <input value={scenario.name} onChange={e => scenario.setName(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13 }} />
        </label>
        <label style={{ flex: '2 1 320px', fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-muted)' }}>Description</span>
          <input value={scenario.description} onChange={e => scenario.setDescription(e.target.value)}
            placeholder="Describe the assumptions being tested…"
            style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13 }} />
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

      {/* Readiness summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: '① Case inclusion',      value: `${includedCount} / ${workingCases.length}` },
          { label: '② Operations set',      value: workingCases.filter(c => ops[c.id]?.operation !== 'No Change' && ops[c.id]?.include !== false).length + ' / ' + includedCount },
          { label: '③ Scenario readiness',  value: '—' },
        ].map(tile => (
          <div key={tile.label} style={{ flex: '1 1 140px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{tile.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{tile.value}</div>
          </div>
        ))}
      </div>

      {/* Case configuration table */}
      <h3 style={{ marginBottom: '0.5rem' }}>Case Configuration</h3>
      <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
        Set Include, Operation, and input parameters for each case. Reference column shows {screenMetric || '—'} {screenYear}.
      </p>

      <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border-strong)' }}>
              {['Include', 'ID', 'Case Name', 'Region', 'Plan Type', 'Reference', 'Operation', 'Input 1', 'Input 2', 'Input 3'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workingCases.map(c => {
              const cs = ops[c.id] ?? { include: true, operation: 'No Change', params: [0,0,0,0,0] }
              const ref = getRef(c.case)
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', background: cs.include ? 'transparent' : 'var(--color-surface)' }}>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    <input type="checkbox" checked={cs.include}
                      onChange={e => scenario.setCaseField(c.id, 'include', e.target.checked)}
                    />
                  </td>
                  <td style={{ padding: '7px 10px', color: 'var(--color-text-muted)' }}>{c.id}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.case_name}</td>
                  <td style={{ padding: '7px 10px' }}>{c.region}</td>
                  <td style={{ padding: '7px 10px' }}>{c.plan_type}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(ref)}</td>
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
                </tr>
              )
            })}
          </tbody>
        </table>
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

      {/* Error */}
      {scenario.runError && (
        <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid var(--color-negative)', borderRadius: 4, color: 'var(--color-negative)', marginBottom: '1rem', fontSize: 13 }}>
          {scenario.runError}
        </div>
      )}
      {scenario.runError && <p role="status">The previous successful result, if any, is still available on Scenario Results.</p>}
      {scenario.diagnostics.length > 0 && (
        <ul role="alert">{scenario.diagnostics.map((d, i) =>
          <li key={i}>{d.Case ? `${d.Case}: ` : ''}{d.message ?? d.Message}</li>
        )}</ul>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={scenario.running || includedCount === 0}
        style={{
          padding:     '0.6rem 1.6rem',
          background:  scenario.running || includedCount === 0 ? 'var(--color-border)' : 'var(--color-accent-dark)',
          color:       '#fff',
          border:      'none',
          borderRadius:4,
          fontSize:    15,
          fontWeight:  600,
          cursor:      scenario.running || includedCount === 0 ? 'default' : 'pointer',
        }}
      >
        {scenario.running ? 'Running…' : '▶ Run Scenario'}
      </button>
    </div>
  )
}

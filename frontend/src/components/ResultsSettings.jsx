import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { listSavedScenarios } from '../api/client'
import { copySettings, settingsError, BREAKDOWNS } from '../pages/resultsHelpers'
import { REFERENCE_PERIODS, NPV_METRIC, metricDisplayName } from '../pages/referenceMeasures'
import './OperationsGuide.css'
import './ScenarioResults.css'

export default function ResultsSettings({ settings, currentName, currentId, metrics, onClose, onApply }) {
  const [draft, setDraft] = useState(() => copySettings(settings))
  const [saved, setSaved] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retry, setRetry] = useState(0)
  const [validation, setValidation] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement, overflow = document.body.style.overflow
    dialog.showModal(); document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [])
  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    listSavedScenarios().then(data => { if (active) { setSaved(data.scenarios); if (data.errors.length) setError(data.errors.join(' ')) } })
      .catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  const options = [{ value: 'current', label: `${currentName} (latest run)` }, ...saved.filter(s => s.scenario_id !== currentId).map(s => ({ value: s.scenario_id, label: `${s.name} · ${new Date(s.updated_at).toLocaleString()}` }))]
  const select = (label, value, choices, change) => <label className="results-settings__field">{label}<select value={value} onChange={e => { change(e.target.value); setValidation(null) }}>{choices.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}</select></label>
  const metricChoices = metrics.filter(m => m !== NPV_METRIC).map(m => ({ value: m, label: metricDisplayName(m) }))
  const years = Array.from({ length: 15 }, (_, i) => ({ value: 2026 + i, label: 2026 + i }))
  return <dialog ref={ref} className="operations-guide" aria-labelledby="results-settings-title" onCancel={e => { e.preventDefault(); onClose() }}
    onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <header className="operations-guide__header"><div><h2 id="results-settings-title">Results settings</h2><p>Choose the scenarios and analysis to display.</p></div><button className="operations-guide__close" onClick={onClose} aria-label="Close results settings"><X size={20} /></button></header>
    <form className="results-settings__form" onSubmit={e => { e.preventDefault(); const issue = settingsError(draft); if (issue) { setValidation(issue); return } onApply(copySettings(draft)) }}>
      <div className="operations-guide__content">
        <h3>Scenario comparison</h3>
        {loading && <p role="status">Loading saved scenarios…</p>}
        {error && <p role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
        {select('Primary scenario', draft.primary, options, primary => setDraft(s => ({ ...s, primary, comparison: s.comparison === primary ? '' : s.comparison })))}
        {select('Comparison scenario', draft.comparison, [{ value: '', label: 'None' }, ...options.map(o => ({ ...o, disabled: o.value === draft.primary }))], comparison => setDraft(s => ({ ...s, comparison })))}
        <p className="text-small text-muted">Saved scenarios are rerun when you apply settings. Your working scenario is preserved.</p>
        <h3>Analysis period</h3><div className="results-settings__pair">
          {select('From', draft.yearFrom, years, value => setDraft(s => ({ ...s, yearFrom: Number(value) })))}
          {select('To', draft.yearTo, years, value => setDraft(s => ({ ...s, yearTo: Number(value) })))}
        </div>
        {['plot1', 'plot2', 'plot3'].map((key, index) => <section key={key}><h3>Plot {index + 1}</h3>
          {select('Metric', draft[key].metric, metricChoices, metric => setDraft(s => ({ ...s, [key]: { ...s[key], metric } })))}
          {select('Variance breakdown', draft[key].breakdown, Object.entries(BREAKDOWNS).map(([value, label]) => ({ value, label })), breakdown => setDraft(s => ({ ...s, [key]: { ...s[key], breakdown } })))}
        </section>)}
        <h3>Scenario changes</h3>
        {select('Impact metric', draft.changes.metric, [...metricChoices, { value: NPV_METRIC, label: 'Post-tax NPV' }], metric => setDraft(s => ({ ...s, changes: { ...s.changes, metric, period: metric === NPV_METRIC && s.changes.period === 'average' ? 'full' : s.changes.period } })))}
        {select('Impact period', draft.changes.period, REFERENCE_PERIODS.map(p => ({ ...p, disabled: draft.changes.metric === NPV_METRIC && p.average })), period => setDraft(s => ({ ...s, changes: { ...s.changes, period } })))}
        {validation && <p role="alert">{validation}</p>}
      </div>
      <footer className="operations-guide__footer results-settings__actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit">Apply settings</button></footer>
    </form>
  </dialog>
}

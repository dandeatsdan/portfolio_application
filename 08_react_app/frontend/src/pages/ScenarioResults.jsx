import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { getSavedScenario, runScenario } from '../api/client'
import { ScenarioResultContext, SidePanelContext, FiltersContext } from '../App'
import { usePortfolio } from '../hooks/usePortfolio'
import FilterRail from '../components/FilterRail'
import ResultsSettings from '../components/ResultsSettings'
import { ResultsKpis, ResultsPlot, ResultsChanges } from '../components/ResultsAnalysis'
import { filterScenarioCases } from './scenarioCaseFilters'
import { DEFAULT_RESULTS_SETTINGS, copySettings, runSavedDefinition, changeRows, BREAKDOWNS } from './resultsHelpers'
import { REFERENCE_PERIODS, filteredReferencePeriod, metricDisplayName } from './referenceMeasures'
import '../components/ScenarioResults.css'

export default function ScenarioResults() {
  const { scenarioResult, setScenarioResult, lastRunError, setLastRunError } = useContext(ScenarioResultContext)
  const { filters, setFilters } = useContext(FiltersContext)
  const { setSidePanel } = useContext(SidePanelContext)
  const { cases, metrics, loading, error: portfolioError } = usePortfolio()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState({ settings: copySettings(DEFAULT_RESULTS_SETTINGS), primary: scenarioResult, comparison: null })
  const [modes, setModes] = useState(['profile', 'profile'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [comparisonError, setComparisonError] = useState(null)
  const generation = useRef(0)
  useEffect(() => {
    generation.current++
    setView(v => ({ ...v, settings: { ...v.settings, primary: 'current', comparison: '' }, primary: scenarioResult, comparison: null }))
    setBusy(false); setError(null); setComparisonError(null)
    return () => { generation.current++ }
  }, [scenarioResult])
  useEffect(() => {
    setSidePanel(<FilterRail filters={filters} onChange={setFilters} />)
    return () => setSidePanel(null)
  }, [filters, setFilters, setSidePanel])

  function clearResults() {
    generation.current++
    setSettingsOpen(false)
    setBusy(false)
    setError(null)
    setComparisonError(null)
    setView(v => ({ ...v, primary: null, comparison: null }))
    setLastRunError(null)
    setScenarioResult(null)
  }

  async function apply(settings) {
    setSettingsOpen(false)
    const token = ++generation.current
    setBusy(true); setError(null); setComparisonError(null)
    const resolve = id => id === 'current' ? Promise.resolve(scenarioResult) : runSavedDefinition(id, cases, { get: getSavedScenario, run: runScenario })
    try {
      const primary = await resolve(settings.primary)
      let comparison = null, issue = null
      if (settings.comparison) {
        try { comparison = await resolve(settings.comparison) } catch (err) { issue = err.message }
      }
      if (token !== generation.current) return
      setView({ settings, primary, comparison }); setComparisonError(issue)
      setFilters(previous => ({ ...previous, yearFrom: settings.yearFrom, yearTo: settings.yearTo }))
    } catch (err) { if (token === generation.current) setError(err.message) }
    finally { if (token === generation.current) setBusy(false) }
  }
  const { primary, comparison } = view
  const settings = useMemo(() => ({ ...view.settings, yearFrom: filters.yearFrom, yearTo: filters.yearTo }),
    [view.settings, filters.yearFrom, filters.yearTo])
  const ids = useMemo(() => filterScenarioCases(cases, filters).map(c => c.id), [cases, filters])
  const base = useMemo(() => ({ baseline: primary?.baseline ?? [], scenario: primary?.results ?? [], case_ids: ids,
    year_from: settings.yearFrom, year_to: settings.yearTo, discount_rate: primary?.valuation?.discount_rate ?? 8 }), [primary, ids, settings.yearFrom, settings.yearTo])
  const kpiPayload = useMemo(() => ({ ...base, kind: 'kpis' }), [base])
  const plot1Payload = useMemo(() => ({ ...base, kind: modes[0] === 'profile' ? 'profile' : 'waterfall',
    metric: settings.plot1.metric, group_by: settings.plot1.breakdown,
    comparison: modes[0] === 'profile' ? comparison?.results ?? null : null }), [base, modes[0], settings.plot1, comparison])
  const plot2Payload = useMemo(() => ({ ...base, kind: modes[1] === 'profile' ? 'profile' : 'waterfall',
    metric: settings.plot2.metric, group_by: settings.plot2.breakdown,
    comparison: modes[1] === 'profile' ? comparison?.results ?? null : null }), [base, modes[1], settings.plot2, comparison])
  const plotPayloads = [plot1Payload, plot2Payload]
  const period = useMemo(() => filteredReferencePeriod(REFERENCE_PERIODS.find(p => p.value === settings.changes.period), settings.yearFrom, settings.yearTo), [settings.changes.period, settings.yearFrom, settings.yearTo])
  const impactPayload = useMemo(() => ({ ...base, kind: 'impact', metric: settings.changes.metric, year_from: period.empty ? settings.yearFrom : period.from, year_to: period.empty ? settings.yearTo : period.to, case_ids: period.empty ? [] : ids, average: period.average ?? false }), [base, settings.changes, period, ids, settings.yearFrom, settings.yearTo])
  const changes = useMemo(() => changeRows(primary?.instructions ?? [], cases).filter(row => ids.includes(row.id)), [primary, cases, ids])
  if (!scenarioResult) return <><h2>Scenario Results</h2><p>No results yet. Save and run a scenario to compare it with Reference.</p><button onClick={() => navigate('/build')}>Build a Scenario</button></>
  if (loading) return <p role="status">Loading Results…</p>
  if (portfolioError) return <p role="alert">{portfolioError}</p>
  return <div className="scenario-results">

    <header className="results-heading"><div><h2>Scenario Results</h2><p>Primary: <strong>{primary?.scenario_name}</strong>{comparison && <> · Comparison: <strong>{comparison.scenario_name}</strong></>}</p>
      <p className="text-small text-muted">Reference is the fixed baseline · {settings.yearFrom}–{settings.yearTo} · {ids.length} of {cases.length} cases in the selected scope</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="saved-scenarios__trigger" onClick={clearResults}>Clear results</button>
        <button type="button" className="saved-scenarios__trigger" disabled={busy} aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={15} /> Results settings</button>
      </div>
    </header>
    {lastRunError && <p role="alert">The latest editor run failed. These are previous successful results. {lastRunError}</p>}
    {busy && <p role="status">Running selected saved scenarios. The previous analysis remains below until ready.</p>}
    {error && <p role="alert">Settings were not applied: {error} <button onClick={() => setSettingsOpen(true)}>Review settings</button></p>}
    {comparisonError && <p role="alert">Comparison unavailable: {comparisonError} <button onClick={() => apply(settings)}>Retry comparison</button></p>}
    {primary && <>
      <ResultsKpis payload={kpiPayload} />
      <div className="results-plots">{plotPayloads.map((payload, i) => <ResultsPlot key={i} payload={payload} mode={modes[i]} onMode={mode => setModes(previous => previous.map((m, index) => index === i ? mode : m))}
        primaryName={primary.scenario_name} comparisonName={comparison?.scenario_name} breakdown={BREAKDOWNS[settings[i === 0 ? 'plot1' : 'plot2'].breakdown]} />)}</div>
      <ResultsChanges payload={impactPayload} changes={changes} basis={`${metricDisplayName(settings.changes.metric)} · ${period.label}`} />
    </>}
    {settingsOpen && <ResultsSettings settings={settings} currentName={scenarioResult.scenario_name} currentId={scenarioResult.savedScenarioId} metrics={metrics} onClose={() => setSettingsOpen(false)} onApply={apply} />}
  </div>
}

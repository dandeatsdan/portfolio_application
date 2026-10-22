import { useState, useEffect, useContext, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleHelp, Pencil, SlidersHorizontal } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { useScenario } from '../hooks/useScenario'
import Select from '../components/Select'
import { useReferenceMeasures } from '../hooks/useReferenceMeasures'
import { DEFAULT_REFERENCES, REFERENCE_KEYS, REFERENCE_PERIODS, filteredReferencePeriod, referenceLabel, metricDisplayName } from './referenceMeasures'
import { SelectionContext, ScenarioResultContext, SidePanelContext, FiltersContext } from '../App'
import FilterRail from '../components/FilterRail'
import { filterScenarioCases } from './scenarioCaseFilters'
import { SCENARIO_CASE_COLUMNS, sortScenarioCases } from './scenarioCaseSort'
import RunConfirmation from '../components/RunConfirmation'
import ClearScenarioConfirmation from '../components/ClearScenarioConfirmation'
import OperationsGuide from '../components/OperationsGuide'
import CaseConfiguration from '../components/CaseConfiguration'
import SavedScenarios from '../components/SavedScenarios'
import ReferenceConfig from '../components/ReferenceConfig'
import { WorkingScenarioContext } from '../hooks/WorkingScenarioContext'
import { isDirty, persistScenario, saveBeforeRun } from '../hooks/scenarioDefinition'
import { getSavedScenario, createSavedScenario, updateSavedScenario } from '../api/client'
import { configurationSummary } from '../components/caseConfigUtils'

function fmt(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function SortableCaseHeader({ column: { key, label, title: colTitle, numeric }, sort, onSort }) {
  const direction = sort?.key === key ? sort.direction : undefined
  const nextDirection = direction === 'ascending' ? 'descending' : 'ascending'
  const tooltip = colTitle ?? label
  return (
    <th scope="col" aria-sort={direction} title={tooltip} style={{ padding: '8px 10px', textAlign: numeric ? 'right' : 'left', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      <button
        type="button"
        onClick={() => onSort(key)}
        aria-label={`${tooltip}: sort ${nextDirection}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: numeric ? 'flex-end' : 'flex-start', gap: 3, width: '100%', padding: 0, border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', whiteSpace: 'nowrap' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <span aria-hidden="true" style={{ fontSize: 9, flexShrink: 0 }}>{direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : '↕'}</span>
      </button>
    </th>
  )
}

export default function BuildScenario() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedId = searchParams.get('scenario')
  const { working, dispatch } = useContext(WorkingScenarioContext)
  const dirty = isDirty(working)
  const latestWorking = useRef(working)
  latestWorking.current = working
  const [pendingOpen, setPendingOpen] = useState(null)
  const [opening, setOpening] = useState(false)
  const [storageError, setStorageError] = useState(null)
  const [loadErrors, setLoadErrors] = useState([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const mounted = useRef(true)
  const [reload, setReload] = useState(0)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const { cases, metrics, loading, error } = usePortfolio()
  const { selectedIds, setSelectedIds } = useContext(SelectionContext)
  const { setScenarioResult, setLastRunError } = useContext(ScenarioResultContext)
  const { setSidePanel } = useContext(SidePanelContext)
  const { filters, setFilters } = useContext(FiltersContext)

  useEffect(() => {
    setSidePanel(<FilterRail filters={filters} onChange={setFilters} />)
    return () => setSidePanel(null)
  }, [filters, cases, setSidePanel, setFilters])

  const scenario = useScenario(cases, selectedIds)

  useEffect(() => {
    if (!requestedId || (requestedId === working.savedId && reload === 0)) {
      setOpening(false)
      setPendingOpen(null)
      return
    }
    let active = true
    setOpening(true)
    setStorageError(null)
    setPendingOpen(null)
    getSavedScenario(requestedId).then(saved => {
      if (active) setPendingOpen(saved)
    }).catch(err => { if (active) setStorageError(err.message) })
      .finally(() => { if (active) setOpening(false) })
    return () => { active = false }
  }, [requestedId, reload]) // Loading is explicit; editing the working copy must never trigger a reload.

  function acceptOpen(saved) {
    dispatch({ type: 'load', saved })
    setLoadErrors(saved.validation_errors ?? [])
    setPendingOpen(null)
    setScenarioResult(null)
    setLastRunError(null)
    setReload(0)
  }
  useEffect(() => {
    if (pendingOpen && !dirty) acceptOpen(pendingOpen)
  }, [pendingOpen, dirty]) // eslint-disable-line

  async function save() {
    if (saveLock.current) return false
    const snapshot = working
    saveLock.current = true
    setSaving(true)
    setStorageError(null)
    try {
      const action = await persistScenario(snapshot, { create: createSavedScenario, update: updateSavedScenario })
      dispatch(action)
      if (mounted.current && latestWorking.current.epoch === snapshot.epoch) {
        setLoadErrors([])
        navigate(`/build?scenario=${action.saved.scenario_id}`, { replace: true })
        return action.saved.scenario_id
      }
      return false
    } catch (err) {
      if (mounted.current) {
        setStorageError(err.message)
        setLoadErrors(err.diagnostics ?? [])
      }
      return false
    } finally {
      saveLock.current = false
      if (mounted.current) setSaving(false)
    }
  }
  function newScenario() {
    setClearOpen(true)
  }
  function clearScenario() {
    setClearOpen(false)
    dispatch({ type: 'new' })
    setScenarioResult(null)
    setLastRunError(null)
    setStorageError(null)
    setLoadErrors([])
    navigate('/build', { replace: true })
  }
  const missingIds = working.selectedIds.filter(id => !cases.some(c => c.id === id))


  const [references, setReferences] = useState(DEFAULT_REFERENCES)
  const displayedReferences = useMemo(() => references.map(ref => ({ ...ref,
    timeframe: filteredReferencePeriod(REFERENCE_PERIODS.find(p => p.value === ref.period), filters.yearFrom, filters.yearTo),
  })), [references, filters.yearFrom, filters.yearTo])
  const referenceData = useReferenceMeasures(displayedReferences)
  const referenceColumns = displayedReferences.map((ref, index) => ({ key: REFERENCE_KEYS[index], label: metricDisplayName(ref.metric), title: referenceLabel(ref), numeric: true }))
  const columns = SCENARIO_CASE_COLUMNS.filter(column => !REFERENCE_KEYS.includes(column.key)).concat(referenceColumns)
  const shortlistColumns = columns
  const metricOptions = [...new Set([...DEFAULT_REFERENCES.map(ref => ref.metric), ...metrics])]
    .map(metric => ({ value: metric, label: metricDisplayName(metric) }))
  function withReferences(row) {
    return { ...row, ...Object.fromEntries(REFERENCE_KEYS.map((key, index) => [key, referenceData.values?.[index].get(row.id) ?? null])) }
  }
  const [availableSearch, setAvailableSearch] = useState('')
  const [availableOpen, setAvailableOpen] = useState(false)
  const [availableSort, setAvailableSort] = useState(null)
  const [shortlistSort, setShortlistSort] = useState(null)
  const [operationsGuideOpen, setOperationsGuideOpen] = useState(false)
  const [referenceConfigOpen, setReferenceConfigOpen] = useState(false)
  const [editingCaseId, setEditingCaseId] = useState(null)
  const [confirmRunOpen, setConfirmRunOpen] = useState(false)

  // Shortlist membership is separate from whether a shortlisted case is included in a run.
  const workingCases = cases.filter(c => selectedIds.has(c.id))
  const editingCase = workingCases.find(c => c.id === editingCaseId)
  const availableCases = cases.filter(c => !selectedIds.has(c.id))
  const visibleWorkingCases = filterScenarioCases(workingCases, filters)
  const visibleAvailableCases = filterScenarioCases(availableCases, filters).filter(c =>
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

  const sortedAvailableCases = sortScenarioCases(
    visibleAvailableCases.map(withReferences),
    availableSort,
  )
  const sortedShortlistedCases = sortScenarioCases(
    visibleWorkingCases.map(withReferences),
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
    setConfirmRunOpen(false)
    await saveBeforeRun(save, scenario.run)
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

  if (opening || pendingOpen) return <section>
    {opening ? <p role="status">Opening saved scenario…</p> : <>
      <h2>Open {pendingOpen.name}?</h2>
      <p>Your working scenario has unsaved changes. Opening this saved scenario will replace them.</p>
      <button onClick={() => acceptOpen(pendingOpen)}>Discard changes and open</button>{' '}
      <button onClick={() => { setPendingOpen(null); navigate(working.savedId ? `/build?scenario=${working.savedId}` : '/build', { replace: true }) }}>Keep working scenario</button>
    </>}
  </section>
  if (loading) return <p>Loading…</p>
  if (error)   return <p style={{ color: 'var(--color-negative)' }}>Error: {error}</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ flex: '1 1 320px' }}>
          <h2 style={{ marginBottom: '0.15rem' }}>Build a Scenario</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            Shortlist cases to adjust assumptions or exclude them, then run a scenario to assess the portfolio impact.
            All cases start included using their reference profiles; removing a case from the shortlist restores this default.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" className="saved-scenarios__trigger" onClick={() => save()} disabled={saving || scenario.running}>Save</button>
          <button type="button" className="saved-scenarios__trigger" aria-haspopup="dialog" disabled={saving || scenario.running} onClick={() => setSavedOpen(true)}>Saved scenarios</button>
        <button type="button" className="saved-scenarios__trigger" disabled={saving || scenario.running} aria-haspopup="dialog" onClick={newScenario}>Clear scenario</button>
        <button type="button" className="saved-scenarios__trigger"
          onClick={() => setConfirmRunOpen(true)} aria-haspopup="dialog"
          disabled={scenario.running || saving || includedCount === 0 || missingIds.length > 0}
          style={{ background: 'var(--color-accent-dark)', color: '#fff' }}>
          {saving ? 'Saving…' : scenario.running ? 'Running…' : 'Save and run'}
        </button>
        </div>
      </div>

      {storageError && <div role="alert"><p>{storageError}</p>
        {requestedId && requestedId !== working.savedId && <button onClick={() => setReload(value => value + 1)}>Retry opening</button>}
      </div>}
      {loadErrors.length > 0 && <div role="alert"><p>Review these configuration issues before saving or running:</p>
        <ul>{loadErrors.map((item, i) => <li key={i}>Case {item.ID}: {item.message}</li>)}</ul>
      </div>}
      {missingIds.length > 0 && <div role="alert"><p>These saved cases are no longer in the portfolio. Remove them before running:</p>
        {missingIds.map(id => <button key={id} onClick={() => removeFromShortlist(id)}>Remove unavailable case {id}</button>)}
      </div>}
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
        <label style={{ flex: '1 1 100%', minWidth: 0, fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-muted)' }}>Scenario Rationale</span>
          <textarea value={scenario.rationale} onChange={e => scenario.setRationale(e.target.value)}
            placeholder="Describe the business reasoning behind these scenario choices…"
            rows={3}
            style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13, fontFamily: 'var(--font-family)', resize: 'vertical' }}
          />
        </label>
      </div>

      {/* Case configuration table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.35rem' }}>
        <h3 style={{ margin: 0 }}>Shortlisted cases ({visibleWorkingCases.length} of {workingCases.length})</h3>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setReferenceConfigOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: '#fff', color: 'var(--color-accent-dark)', fontSize: 12 }}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            Edit metrics
          </button>
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
      <ReferenceConfig
        open={referenceConfigOpen}
        references={references}
        metricOptions={metricOptions}
        onApply={setReferences}
        onClose={() => setReferenceConfigOpen(false)}
      />
      <p role="status" className="text-small text-muted" style={{ marginBottom: '0.5rem' }}>
        Portfolio: {includedCount} included · {cases.length - includedCount} excluded · {modifiedCount} modified. Filters only change visible rows; hidden cases keep their scenario settings.
      </p>
      <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
        <table aria-label="Shortlisted cases" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '3%' }} />   {/* ID */}
            <col style={{ width: '14%' }} />  {/* Case Name */}
            <col style={{ width: '9%' }} />   {/* Region */}
            <col style={{ width: '9%' }} />   {/* Country */}
            <col style={{ width: '8%' }} />   {/* Plan Type */}
            <col style={{ width: '8%' }} />   {/* Ref 1 */}
            <col style={{ width: '8%' }} />   {/* Ref 2 */}
            <col style={{ width: '8%' }} />   {/* Ref 3 */}
            <col style={{ width: '18%' }} />  {/* Scenario Config */}
            <col style={{ width: '8%' }} />   {/* Configure */}
            <col style={{ width: '7%' }} />   {/* Remove */}
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border-strong)' }}>
              {shortlistColumns.map(column => (
                <SortableCaseHeader key={column.key} column={column} sort={shortlistSort} onSort={toggleShortlistSort} />
              ))}
              {['Scenario configuration', 'Configure', 'Shortlist'].map(h => (
                <th key={h} scope="col" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleWorkingCases.length === 0 && (
              <tr>
                <td colSpan={shortlistColumns.length + 3} style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <span role="status">{workingCases.length ? 'No shortlisted cases match the filters. Clear filters to see the full shortlist.' : 'No cases shortlisted. All cases will use their reference profiles. Expand Available cases below to shortlist cases for adjustment, exclusion, or review.'}</span>
                </td>
              </tr>
            )}
            {sortedShortlistedCases.map(c => {
              const cs = ops[c.id] ?? { include: true, operation: 'No Change', params: [0,0,0,0,0] }
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', background: c.id === editingCaseId ? '#edf5e8' : cs.include ? 'transparent' : 'var(--color-surface)', boxShadow: c.id === editingCaseId ? 'inset 3px 0 var(--color-accent-dark)' : undefined }}>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{c.id}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 500 }}>{c.case_name}</td>
                  <td style={{ padding: '7px 10px' }}>{c.region}</td>
                  <td style={{ padding: '7px 10px' }}>{c.country}</td>
                  <td style={{ padding: '7px 10px' }}>{c.plan_type}</td>
                  {REFERENCE_KEYS.map(key => <td key={key} style={{ padding: '7px 10px', textAlign: 'right' }}>{referenceData.loading ? '…' : fmt(c[key])}</td>)}
                  <td style={{ padding: '7px 10px' }}>
                    {configurationSummary(cs)}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <button type="button" aria-label={`Configure ${c.case_name}`} aria-haspopup="dialog"
                      onClick={() => setEditingCaseId(c.id)} disabled={scenario.running}
                      style={{ padding: '4px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-accent-dark)', fontSize: 12 }}>
                      Configure
                    </button>
                  </td>
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
        <h3 style={{ margin: 0 }}>Available cases ({visibleAvailableCases.length} of {availableCases.length})</h3>
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
          <table aria-label="Available cases" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '3%' }} />   {/* ID */}
              <col style={{ width: '14%' }} />  {/* Case Name */}
              <col style={{ width: '9%' }} />   {/* Region */}
              <col style={{ width: '9%' }} />   {/* Country */}
              <col style={{ width: '8%' }} />   {/* Plan Type */}
              <col style={{ width: '8%' }} />   {/* Ref 1 */}
              <col style={{ width: '8%' }} />   {/* Ref 2 */}
              <col style={{ width: '8%' }} />   {/* Ref 3 = 67% total, 33% to action */}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border-strong)' }}>
                {columns.map(column => (
                  <SortableCaseHeader key={column.key} column={column} sort={availableSort} onSort={toggleAvailableSort} />
                ))}
                <th scope="col" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Shortlist</th>
              </tr>
            </thead>
            <tbody>
              {visibleAvailableCases.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <span role="status">{availableCases.length === 0 ? 'All cases are shortlisted.' : 'No available cases match your search or filters.'}</span>
                  </td>
                </tr>
              )}
              {sortedAvailableCases.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{c.id}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 500 }}>{c.case_name}</td>
                  <td style={{ padding: '7px 10px' }}>{c.region}</td>
                  <td style={{ padding: '7px 10px' }}>{c.country}</td>
                  <td style={{ padding: '7px 10px' }}>{c.plan_type}</td>
                  {REFERENCE_KEYS.map(key => <td key={key} style={{ padding: '7px 10px', textAlign: 'right' }}>{referenceData.loading ? '…' : fmt(c[key])}</td>)}
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

      {savedOpen && <SavedScenarios onClose={() => setSavedOpen(false)} onNew={() => { setSavedOpen(false); newScenario() }} onOpen={id => {
        setSavedOpen(false)
        navigate(`/build?scenario=${id}`)
        setReload(value => value + 1)
      }} />}
      {clearOpen && <ClearScenarioConfirmation name={scenario.name} dirty={dirty} onCancel={() => setClearOpen(false)} onConfirm={clearScenario} />}
      {confirmRunOpen && <RunConfirmation name={scenario.name} cases={cases} selectedIds={selectedIds}
        caseConfig={scenario.caseConfig} onCancel={() => setConfirmRunOpen(false)} onConfirm={handleRun} />}
      {editingCase && <CaseConfiguration key={editingCase.id} caseRow={editingCase} config={ops[editingCase.id]}
        onCancel={() => setEditingCaseId(null)}
        onApply={config => { scenario.applyCaseConfig(editingCase.id, config); setEditingCaseId(null) }} />}
      <OperationsGuide open={operationsGuideOpen} onClose={() => setOperationsGuideOpen(false)} />
    </div>
  )
}

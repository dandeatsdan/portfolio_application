import { useContext, useEffect, useRef, useState } from 'react'
import { ArrowRight, FolderOpen, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WorkingScenarioContext } from '../hooks/WorkingScenarioContext'
import { deleteSavedScenario, listSavedScenarios } from '../api/client'
import './OperationsGuide.css'
import './SavedScenarios.css'

export default function SavedScenarios({ onClose, onOpen, onNew }) {
  const dialogRef = useRef(null)
  const workingContext = useContext(WorkingScenarioContext)
  const navigate = useNavigate()
  const location = useLocation()
  const deleteLock = useRef(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  async function remove(item) {
    if (deleteLock.current || !window.confirm(`Delete saved scenario "${item.name}"? This cannot be undone. Your working copy will be kept.`)) return
    deleteLock.current = true
    setDeleting(item.scenario_id)
    setDeleteError(null)
    try {
      await deleteSavedScenario(item.scenario_id)
      setSaved(data => ({ ...data, scenarios: data.scenarios.filter(s => s.scenario_id !== item.scenario_id) }))
      workingContext?.dispatch({ type: 'deleted', id: item.scenario_id })
      const params = new URLSearchParams(location.search)
      if (location.pathname === '/build' && params.get('scenario') === item.scenario_id) {
        params.delete('scenario')
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })
      }
      dialogRef.current?.querySelector('.operations-guide__close')?.focus()
    } catch (err) { setDeleteError(`Unable to delete ${item.name}: ${err.message}`) }
    finally { deleteLock.current = false; setDeleting(null) }
  }
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    let active = true
    setError(null)
    setSaved(null)
    listSavedScenarios().then(data => { if (active) setSaved(data) })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [retry])

  function trapFocus(event) {
    if (event.key !== 'Tab') return
    const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
      .filter(button => button.getClientRects().length)
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return <dialog ref={dialogRef} className="operations-guide saved-scenarios" aria-labelledby="saved-scenarios-title"
    aria-describedby="saved-scenarios-intro" onKeyDown={trapFocus}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}>
    <header className="operations-guide__header">
      <div><h2 id="saved-scenarios-title">Saved scenarios</h2>
        <p id="saved-scenarios-intro">Choose a scenario to continue editing.</p></div>
      <button type="button" className="operations-guide__close" onClick={onClose} aria-label="Close saved scenarios"><X size={20} aria-hidden="true" /></button>
    </header>
    <div className="operations-guide__content">
      {!saved && !error && <p role="status">Loading saved scenarios…</p>}
      {error && <div role="alert"><p>{error}</p><button className="saved-scenarios__action" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
      {deleteError && <p role="alert">{deleteError}</p>}
      {deleting && <p role="status">Deleting saved scenario…</p>}
      {saved?.errors.map((message, index) => <p key={index} role="alert">{message}</p>)}
      {saved?.scenarios.length === 0 && <div className="saved-scenarios__empty">
        <FolderOpen size={32} aria-hidden="true" /><h3>No saved scenarios yet</h3>
        <p>Build a scenario, then choose Save to find it here next time.</p>
      </div>}
      {saved?.scenarios.length > 0 && <>
        <p className="saved-scenarios__count">{saved.scenarios.length} saved {saved.scenarios.length === 1 ? 'scenario' : 'scenarios'}</p>
        <ul className="saved-scenarios__list">{saved.scenarios.map(item => <li key={item.scenario_id} className="saved-scenarios__row">
          <button type="button" className="saved-scenarios__item" disabled={deleting !== null} aria-label={`Open ${item.name}`} onClick={() => onOpen(item.scenario_id)}>
            <FolderOpen size={20} aria-hidden="true" />
            <span className="saved-scenarios__details"><strong>{item.name}</strong>
              <span>Modified <time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleString()}</time></span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="saved-scenarios__delete" disabled={deleting !== null} title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`} onClick={() => remove(item)}><Trash2 size={18} aria-hidden="true" /></button>
        </li>)}</ul>
      </>}
    </div>
    <footer className="operations-guide__footer">{onNew && <button type="button" className="saved-scenarios__action" style={{ marginBottom: 10 }} onClick={onNew}>New scenario</button>}<p>Opening restores the configuration. Run it again for current results.</p></footer>
  </dialog>
}

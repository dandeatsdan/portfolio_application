import { useEffect, useRef } from 'react'
import './RunConfirmation.css'
import { timingLabel } from '../pages/optimiserHelpers'

export default function RecommendationConfirmation({ result, replacesUnsaved, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const submitted = useRef(false)
  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    cancelRef.current.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  const shifted = result.cases.filter(c => c.selected && c.year_shift)
  const shiftedIds = new Set(shifted.map(c => c.id))
  const groups = [
    { title: 'Included unchanged — Available cases', ids: result.selected_case_ids.filter(id => !shiftedIds.has(id)),
      description: 'These recommended cases stay included using their reference profiles. You’ll find them under Available cases in the scenario builder.' },
    ...(shifted.length ? [{ title: 'Timing changes — Shortlisted cases', ids: shifted.map(c => c.id),
      description: 'These cases stay included and move to Shortlisted cases with their recommended Delay or Accelerate operation. Only the year-shift parameter is set; all cost parameters are zero.' }] : []),
    { title: 'Excluded — Shortlisted cases', ids: result.excluded_case_ids,
      description: 'These cases move to Shortlisted cases with their configuration set to Excluded. This makes each exclusion visible and easy to review or change.' },
  ]
  const names = new Map(result.cases.map(c => [c.id, `${c.name}${shiftedIds.has(c.id) ? ` · ${timingLabel(c)}` : ''}`]))
  return <dialog ref={dialogRef} className="run-confirmation" aria-labelledby="recommendation-confirmation-title"
    aria-describedby="recommendation-confirmation-description" onCancel={event => { event.preventDefault(); onCancel() }}>
    <header>
      <h2 id="recommendation-confirmation-title">Build scenario from recommendation</h2>
      <p id="recommendation-confirmation-description">Your scenario will contain {result.selected_case_ids.length} included cases and {result.excluded_case_ids.length} excluded cases. Here’s where they will appear.</p>
    </header>
    <div className="run-confirmation__content">
      <ul className="run-confirmation__changes">{groups.map(group => <li key={group.title}>
        <h3>{group.ids.length} {group.title}</h3>
        <p>{group.description}</p>
        {group.ids.length > 0 && <details><summary>View cases</summary><ul>{group.ids.map(id => <li key={id}>{names.get(id) ?? 'Case'} <span>(ID {id})</span></li>)}</ul></details>}
      </li>)}</ul>
      <p>You can edit the scenario before choosing Save or Save and run. Your saved scenarios are kept.</p>
      {replacesUnsaved && <p role="alert"><strong>Continuing will replace your current unsaved scenario edits.</strong> Cancel to keep working on them.</p>}
    </div>
    <footer>
      <button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button>
      <button type="button" className="run-confirmation__confirm" onClick={() => {
        if (submitted.current) return
        submitted.current = true
        onConfirm()
      }}>Open scenario builder</button>
    </footer>
  </dialog>
}

import { useEffect, useRef } from 'react'
import { summarizeRun } from './runConfirmation'
import './RunConfirmation.css'

export default function RunConfirmation({ name, cases, selectedIds, caseConfig, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const submitted = useRef(false)
  const summary = summarizeRun(cases, selectedIds, caseConfig)
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
  return <dialog ref={dialogRef} className="run-confirmation" aria-labelledby="run-confirmation-title"
    aria-describedby="run-confirmation-description"
    onCancel={event => { event.preventDefault(); onCancel() }}>
    <header>
      <h2 id="run-confirmation-title">Review and run scenario</h2>
      <p className="run-confirmation__name">{name || 'Unnamed scenario'}</p>
      <p id="run-confirmation-description">Check these settings before running. Cancel to return and make changes.</p>
    </header>
    <div className="run-confirmation__content">
      <p>{summary.referenceCount} using reference profiles · {summary.modifiedCount} modified · {summary.excludedCount} excluded</p>
      {summary.changes.length === 0
        ? <p>All cases will run using their reference profiles.</p>
        : <ul className="run-confirmation__changes">{summary.changes.map(row => <li key={row.id}>
          <h3>{row.name} <span>(ID {row.id})</span></h3>
          <p>{row.included ? `Included · ${row.operation}` : 'Excluded from the scenario'}</p>
          {row.inputs.length > 0 && <dl>{row.inputs.map(input => <div key={input.label}>
            <dt>{input.label}</dt><dd>{input.value}</dd>
          </div>)}</dl>}
        </li>)}</ul>}
    </div>
    <footer>
      <button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button>
      <button type="button" className="run-confirmation__confirm"
        disabled={summary.referenceCount + summary.modifiedCount === 0}
        onClick={() => {
          if (submitted.current) return
          submitted.current = true
          onConfirm()
        }}>Confirm and run</button>
    </footer>
  </dialog>
}

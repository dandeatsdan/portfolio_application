import { useEffect, useRef } from 'react'
import './RunConfirmation.css'

export default function ClearScenarioConfirmation({ name, dirty, onCancel, onConfirm }) {
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
  return <dialog ref={dialogRef} className="run-confirmation" aria-labelledby="clear-scenario-title"
    aria-describedby="clear-scenario-description" onCancel={event => { event.preventDefault(); onCancel() }}>
    <header>
      <h2 id="clear-scenario-title">Clear current scenario?</h2>
      <p className="run-confirmation__name">{name || 'Unnamed scenario'}</p>
      <p id="clear-scenario-description">Start a fresh scenario with all cases included using their reference profiles.</p>
    </header>
    <div className="run-confirmation__content">
      <p>This clears the current name, description, rationale, shortlist, case adjustments and results.</p>
      {dirty && <p><strong>Your unsaved edits will be discarded.</strong></p>}
      <p>Saved scenarios are kept and can be opened again from Saved scenarios.</p>
    </div>
    <footer>
      <button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button>
      <button type="button" className="run-confirmation__confirm" onClick={() => {
        if (submitted.current) return
        submitted.current = true
        onConfirm()
      }}>Clear scenario</button>
    </footer>
  </dialog>
}

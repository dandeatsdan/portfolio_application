import { useEffect, useRef } from 'react'
import './RunConfirmation.css'

export default function DeleteScenarioConfirmation({ name, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const submitted = useRef(false)
  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    // The saved-scenarios pane beneath this dialog already locks page scrolling.
    dialog.showModal()
    cancelRef.current.focus()
    return () => {
      dialog.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  return <dialog ref={dialogRef} className="run-confirmation" aria-labelledby="delete-scenario-title"
    aria-describedby="delete-scenario-description" onCancel={event => { event.preventDefault(); onCancel() }}>
    <header>
      <h2 id="delete-scenario-title">Delete saved scenario?</h2>
      <p className="run-confirmation__name">{name || 'Unnamed scenario'}</p>
      <p id="delete-scenario-description">This permanently removes the saved scenario. Deletion cannot be undone.</p>
    </header>
    <div className="run-confirmation__content">
      <p>Your current working copy will be kept. If it belongs to this saved scenario, you can save it again as a new record.</p>
    </div>
    <footer>
      <button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button>
      <button type="button" className="run-confirmation__confirm" onClick={() => {
        if (submitted.current) return
        submitted.current = true
        onConfirm()
      }}>Delete scenario</button>
    </footer>
  </dialog>
}

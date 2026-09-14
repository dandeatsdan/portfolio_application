import { useEffect, useRef } from 'react'
import './RunConfirmation.css'

export default function SwitchModeConfirmation({ newModeLabel, onCancel, onConfirm }) {
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
  return (
    <dialog ref={dialogRef} className="run-confirmation" aria-labelledby="switch-mode-title"
      aria-describedby="switch-mode-description" onCancel={e => { e.preventDefault(); onCancel() }}>
      <header>
        <h2 id="switch-mode-title">Switch to {newModeLabel}?</h2>
      </header>
      <div className="run-confirmation__content">
        <p id="switch-mode-description">Switching mode will reset your current constraints, mix targets, and case controls.</p>
        <p><strong>Your current settings will be lost.</strong></p>
      </div>
      <footer>
        <button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="run-confirmation__confirm" onClick={() => {
          if (submitted.current) return
          submitted.current = true
          onConfirm()
        }}>Switch mode</button>
      </footer>
    </dialog>
  )
}

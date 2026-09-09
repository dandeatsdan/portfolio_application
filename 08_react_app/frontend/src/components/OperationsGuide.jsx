import { useEffect, useRef } from 'react'
import { ArrowRight, ChevronDown, ExternalLink, X } from 'lucide-react'
import { OPERATION_GUIDE_CATEGORIES } from './operationGuideContent'
import operationsGuideUrl from '../../../../04_user_guides/operations_user_guide.pdf?url'
import './OperationsGuide.css'

export default function OperationsGuide({ open, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'

    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      onClose()
    }
  }

  function handleKeyDown(event) {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), a[href], summary')]
      .filter(control => control.getClientRects().length > 0)
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      id="operations-guide"
      className="operations-guide"
      aria-labelledby="operations-guide-title"
      aria-describedby="operations-guide-intro"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <header className="operations-guide__header">
        <div>
          <h2 id="operations-guide-title">Operations guide</h2>
          <p>12 operations · 4 categories</p>
        </div>
        <button type="button" className="operations-guide__close" aria-label="Close operations guide" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="operations-guide__content">
        <section className="operations-guide__intro" aria-labelledby="operations-guide-definition">
          <h3 id="operations-guide-definition">What is an operation?</h3>
          <p id="operations-guide-intro">
            An operation defines how a case’s reference profile is used in your scenario. It can retain the profile or adjust its timing, scale, production or costs.
            Inputs specify the assumptions to apply.
          </p>
          <div className="operations-guide__flow">
            <span>Reference<br />profile</span>
            <ArrowRight size={16} aria-hidden="true" />
            <span>Operation<br />+ inputs</span>
            <ArrowRight size={16} aria-hidden="true" />
            <span>Scenario<br />profile</span>
          </div>
          <p className="operations-guide__hint">Expand an operation to see what it does, its inputs and an example.</p>
        </section>

        {OPERATION_GUIDE_CATEGORIES.map(category => (
          <section key={category.id} className="operations-guide__category" aria-labelledby={`operations-guide-${category.id}`}>
            <div className="operations-guide__category-heading">
              <h3 id={`operations-guide-${category.id}`}>{category.title}</h3>
              <span>{category.subtitle}</span>
            </div>
            {category.operations.map(operation => (
              <details key={operation.name} className="operations-guide__operation">
                <summary>
                  <span>{operation.name}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <div className="operations-guide__operation-content">
                  <p>{operation.description}</p>
                  {operation.inputs.length > 0 ? (
                    <dl className="operations-guide__inputs">
                      {operation.inputs.map(input => (
                        <div key={input.position}>
                          <dt><span>Input {input.position}</span>{input.label}</dt>
                          <dd>{input.required ? 'Required' : 'Optional'}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : <p className="operations-guide__hint">No inputs required.</p>}
                  <div className="operations-guide__example">
                    <h4>Example</h4>
                    <p>{operation.example}</p>
                  </div>
                  {operation.notes && <p className="operations-guide__notes">{operation.notes}</p>}
                </div>
              </details>
            ))}
          </section>
        ))}
      </div>

      <footer className="operations-guide__footer">
        <a href={operationsGuideUrl} target="_blank" rel="noopener noreferrer">
          Open operations user guide (PDF)
          <ExternalLink size={14} aria-hidden="true" />
          <span className="operations-guide__sr-only"> (opens in a new tab)</span>
        </a>
        <p>Operation library and parameter reference</p>
      </footer>
    </dialog>
  )
}

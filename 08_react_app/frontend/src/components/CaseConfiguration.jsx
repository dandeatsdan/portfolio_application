import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { OPERATION_GUIDE_CATEGORIES } from './operationGuideData'
import { createConfigurationDraft, findOperation, validateConfiguration, configurationToApply } from './caseConfigUtils'
import './OperationsGuide.css'
import './CaseConfiguration.css'

export default function CaseConfiguration({ caseRow, config, onApply, onCancel }) {
  const dialogRef = useRef(null)
  const [draft, setDraft] = useState(() => createConfigurationDraft(config))
  const [errors, setErrors] = useState({})
  const operation = findOperation(draft.operation)

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  function submit(event) {
    event.preventDefault()
    const nextErrors = validateConfiguration(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const key = Object.keys(nextErrors)[0]
      dialogRef.current.querySelector(key === 'operation' ? '#case-operation' : `#case-param-${key}`)?.focus()
      return
    }
    onApply(configurationToApply(draft, config))
  }

  function handleKeyDown(event) {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll('button, input, select, summary, a[href]')]
      .filter(control => !control.matches(':disabled') && control.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <dialog ref={dialogRef} className="operations-guide case-configuration" aria-labelledby="case-configuration-title"
      onCancel={event => { event.preventDefault(); onCancel() }} onKeyDown={handleKeyDown}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel()
      }}>
      <header className="operations-guide__header">
        <div>
          <h2 id="case-configuration-title">Configure case</h2>
          <h3>{caseRow.case_name}</h3>
          <p>ID {caseRow.id} · {caseRow.plan_type || 'Plan type unavailable'}</p>
          <p className="case-configuration__location">Region: {caseRow.region || '—'} · Country: {caseRow.country || '—'}</p>
        </div>
        <button type="button" className="operations-guide__close" aria-label="Cancel case configuration" onClick={onCancel}><X size={20} aria-hidden="true" /></button>
      </header>
      <form className="case-configuration__form" onSubmit={submit} noValidate>
        <div className="operations-guide__content">
          <fieldset className="case-configuration__inclusion">
            <legend>Include this case in the scenario?</legend>
            <label><input type="radio" name="case-inclusion" checked={draft.include} onChange={() => { setDraft(prev => ({ ...prev, include: true })); setErrors({}) }} />Included</label>
            <label><input type="radio" name="case-inclusion" checked={!draft.include} onChange={() => { setDraft(prev => ({ ...prev, include: false })); setErrors({}) }} />Excluded</label>
          </fieldset>
          {!draft.include && <p className="case-configuration__notice">This case will remain shortlisted but will not contribute to the scenario. Its last applied operation settings will be retained.</p>}
          <fieldset className="case-configuration__operation" disabled={!draft.include}>
            <label htmlFor="case-operation">Operation</label>
            <select id="case-operation" value={draft.operation} onChange={event => {
              setDraft(prev => ({ ...prev, operation: event.target.value, params: ['', '', '', '', ''] }))
              setErrors({})
            }}>
              {OPERATION_GUIDE_CATEGORIES.map(category => <optgroup key={category.id} label={category.title}>
                {category.operations.map(item => <option key={item.name}>{item.name}</option>)}
              </optgroup>)}
            </select>
            <p>{operation?.description}</p>
            {operation?.inputs.map(input => {
              const index = input.position - 1
              return <div className="case-configuration__input" key={`${operation.name}-${index}`}>
                <label htmlFor={`case-param-${index}`}>{input.label}<span>{input.required ? 'Required' : 'Optional'}</span></label>
                <input id={`case-param-${index}`} type="number" step="any" required={input.required}
                  value={draft.params[index]} aria-invalid={Boolean(errors[index])} aria-describedby={errors[index] ? `case-error-${index}` : undefined}
                  onChange={event => {
                    const value = event.target.value
                    setDraft(prev => ({ ...prev, params: prev.params.map((param, i) => i === index ? value : param) }))
                    setErrors(prev => { const next = { ...prev }; delete next[index]; return next })
                  }} />
                {errors[index] && <p className="case-configuration__error" id={`case-error-${index}`}>{errors[index]}</p>}
              </div>
            })}
          </fieldset>
          {draft.include && operation && <div className="case-configuration__help">
            {operation.notes && <p>{operation.notes}</p>}
            <details><summary>Example</summary><p>{operation.example}</p></details>
          </div>}
          {Object.keys(errors).length > 0 && <p role="alert" className="case-configuration__error">Check the highlighted inputs before applying changes.</p>}
        </div>
        <footer className="operations-guide__footer case-configuration__footer">
          <p>Changes take effect when you apply them.</p>
          <div>
            <button type="button" className="case-configuration__reset" title="Reset to the included reference profile"
              onClick={() => { setDraft(createConfigurationDraft()); setErrors({}) }}>Reset</button>
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit">Apply changes</button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}

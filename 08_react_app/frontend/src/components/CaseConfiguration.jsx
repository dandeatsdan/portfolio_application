import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { OPERATION_GUIDE_CATEGORIES } from './operationGuideData'
import { createConfigurationDraft, findOperation, validateConfiguration, configurationToApply, parameterRule } from './caseConfigUtils'
import { validateScenario } from '../api/client'
import { buildScenarioInstructions } from '../hooks/scenarioInstructions'
import './OperationsGuide.css'
import './CaseConfiguration.css'

export default function CaseConfiguration({ caseRow, config, onApply, onCancel }) {
  const dialogRef = useRef(null)
  const [draft, setDraft] = useState(() => createConfigurationDraft(config))
  const [errors, setErrors] = useState({})
  const operation = findOperation(draft.operation)
  const [review, setReview] = useState(null)
  const [retry, setRetry] = useState(0)
  const reviewKey = JSON.stringify(draft)
  const checked = review?.key === reviewKey
  const remoteErrors = checked ? review.errors : []
  const localErrors = validateConfiguration(draft)
  const needsReview = draft.include && !Object.keys(localErrors).length

  useEffect(() => {
    if (!needsReview) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        const applied = configurationToApply(draft, config)
        const instructions = buildScenarioInstructions([caseRow], new Set([caseRow.id]), { [caseRow.id]: applied })
        const result = await validateScenario({ instructions })
        if (active) setReview({ key: reviewKey, errors: result.errors, warnings: result.warnings })
      } catch (error) {
        if (active) setReview({ key: reviewKey, errors: [{ message: `Input checks failed: ${error.message}` }], warnings: [], failed: true })
      }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [reviewKey, needsReview, caseRow, config, retry])

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
    if (needsReview && (!checked || remoteErrors.length)) return
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
            {errors.operation && <p role="alert" className="case-configuration__error">{errors.operation}</p>}
            <p>{operation?.description}</p>
            {operation?.inputs.map(input => {
              const index = input.position - 1
              const rule = parameterRule(operation.name, input.position)
              const error = errors[index] || remoteErrors.find(item => item.parameter === input.position)?.message
              return <div className="case-configuration__input" key={`${operation.name}-${index}`}>
                <label htmlFor={`case-param-${index}`}>{input.label}<span>{input.required ? 'Required' : 'Optional'}</span></label>
                <input id={`case-param-${index}`} type="number" step={rule.kind === 'year' || rule.kind === 'shift' ? 1 : 'any'} required={input.required}
                  value={draft.params[index]} aria-invalid={Boolean(error)} aria-describedby={`case-hint-${index}${error ? ` case-error-${index}` : ''}`}
                  onBlur={() => setErrors(validateConfiguration(draft))}
                  onChange={event => {
                    const value = event.target.value
                    const next = { ...draft, params: draft.params.map((param, i) => i === index ? value : param) }
                    setDraft(next)
                    if (Object.keys(errors).length) setErrors(validateConfiguration(next))
                  }} />
                <p id={`case-hint-${index}`}>{rule.hint}{rule.kind === 'fraction' && draft.params[index] !== '' && Number.isFinite(Number(draft.params[index])) ? ` Entered: ${(Number(draft.params[index]) * 100).toLocaleString()}%.` : ''}</p>
                {error && <p className="case-configuration__error" id={`case-error-${index}`}>{error}</p>}
              </div>
            })}
          </fieldset>
          {draft.include && operation && <div className="case-configuration__help">
            {operation.notes && <p>{operation.notes}</p>}
            <details><summary>Example</summary><p>{operation.example}</p></details>
          </div>}
          {needsReview && !checked && <p role="status">Checking case inputs…</p>}
          {checked && draft.include && <>
            {remoteErrors.filter(item => !item.parameter).map((item, i) => <p key={i} role="alert" className="case-configuration__error">{item.message}</p>)}
            {review.failed && <button type="button" onClick={() => { setReview(null); setRetry(value => value + 1) }}>Retry input checks</button>}
            {review.warnings.length > 0 && <div role="status"><strong>Warnings — changes can still be applied</strong><ul>{review.warnings.map((item, i) => <li key={i}>{item.Year ? `${item.Year}: ` : ''}{item.message}</li>)}</ul></div>}
          </>}
          {Object.keys(errors).length > 0 && <p role="alert" className="case-configuration__error">Check the highlighted inputs before applying changes.</p>}
        </div>
        <footer className="operations-guide__footer case-configuration__footer">
          <p>Changes take effect when you apply them.</p>
          <div>
            <button type="button" className="case-configuration__reset" title="Reset to the included reference profile"
              onClick={() => { setDraft(createConfigurationDraft()); setErrors({}) }}>Reset</button>
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={needsReview && (!checked || remoteErrors.length > 0)}>Apply changes</button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}

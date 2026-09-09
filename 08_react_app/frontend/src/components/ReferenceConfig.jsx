import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Select from './Select'
import { REFERENCE_KEYS, REFERENCE_PERIODS, NPV_METRIC, metricDisplayName, updateReference } from '../pages/referenceMeasures'
import './ReferenceConfig.css'

export default function ReferenceConfig({ open, references, metricOptions, onApply, onClose }) {
  const dialogRef = useRef(null)
  const [draft, setDraft] = useState(references)

  // Reset draft to current applied references whenever the dialog opens.
  useEffect(() => {
    if (open) setDraft(references)
  }, [open]) // eslint-disable-line

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const prev = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = prev
    }
  }, [open])

  function changeDraft(index, field, value) {
    setDraft(prev => prev.map((ref, i) => i === index ? updateReference(ref, field, value) : ref))
  }

  function handleApply() {
    onApply(draft)
    onClose()
  }

  function handleBackdropClick(e) {
    if (e.target !== e.currentTarget) return
    const bounds = e.currentTarget.getBoundingClientRect()
    if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
      onClose()
    }
  }

  return (
    <dialog ref={dialogRef} className="reference-config" onClick={handleBackdropClick}>
      <div className="reference-config__header">
        <div>
          <h2>Reference columns</h2>
          <p>Select a metric and period for each reference column. Changes apply when you click Apply.</p>
        </div>
        <button type="button" className="reference-config__close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="reference-config__content">
        {draft.map((ref, index) => (
          <div key={REFERENCE_KEYS[index]} className="reference-config__row">
            <span className="reference-config__label">Column {index + 1}</span>
            <label className="reference-config__field">
              <span>Metric</span>
              <Select aria-label={`Reference metric ${index + 1}`} value={ref.metric} options={metricOptions}
                onChange={value => changeDraft(index, 'metric', value)} style={{ minWidth: 0, width: '100%' }} />
            </label>
            <label className="reference-config__field">
              <span>Period</span>
              <Select aria-label={`Reference period ${index + 1}`} value={ref.period}
                options={REFERENCE_PERIODS.filter(p => ref.metric !== NPV_METRIC || !p.average)}
                onChange={value => changeDraft(index, 'period', value)} />
            </label>
          </div>
        ))}
      </div>

      <div className="reference-config__footer">
        <button type="button" className="reference-config__cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="reference-config__apply" onClick={handleApply}>Apply</button>
      </div>
    </dialog>
  )
}

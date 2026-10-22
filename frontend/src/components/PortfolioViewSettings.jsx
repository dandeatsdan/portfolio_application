import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import './OperationsGuide.css'
import './ScenarioResults.css'

export default function PortfolioViewSettings({ settings, sections, onApply, onClose }) {
  const [draft, setDraft] = useState(() => ({ ...settings }))
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement, overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [])
  return <dialog ref={ref} className="operations-guide" aria-labelledby="portfolio-settings-title"
    onCancel={e => { e.preventDefault(); onClose() }}
    onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <header className="operations-guide__header"><div><h2 id="portfolio-settings-title">View settings</h2><p>Choose the metrics and breakdowns for your portfolio charts.</p></div>
      <button className="operations-guide__close" onClick={onClose} aria-label="Close view settings"><X size={20} /></button></header>
    <form className="results-settings__form" onSubmit={e => { e.preventDefault(); onApply(draft) }}>
      <div className="operations-guide__content">{sections.map(section => <section key={section.title}><h3>{section.title}</h3>
        {section.fields.map(({ key, label, options }) => <label key={key} className="results-settings__field">{label}
          <select value={draft[key]} onChange={e => setDraft(s => ({ ...s, [key]: e.target.value }))}>
            {options.map(option => { const o = typeof option === 'string' ? { value: option, label: option } : option; return <option key={o.value} value={o.value}>{o.label}</option> })}
          </select>
        </label>)}
      </section>)}<p className="text-small text-muted">Set years and portfolio filters in the filter pane.</p></div>
      <footer className="operations-guide__footer results-settings__actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit">Apply settings</button></footer>
    </form>
  </dialog>
}

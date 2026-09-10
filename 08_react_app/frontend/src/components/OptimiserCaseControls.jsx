import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import './OperationsGuide.css'
import './ScenarioResults.css'

export default function OptimiserCaseControls({ cases, settings, onClose, onApply }) {
  const [controls, setControls] = useState(() => Object.fromEntries(cases.map(c => [c.id, settings.mandatory_case_ids.includes(c.id) ? 'mandatory' : settings.excluded_case_ids.includes(c.id) ? 'excluded' : 'optional'])))
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement, overflow = document.body.style.overflow
    dialog.showModal(); document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [])
  const shown = cases.filter(c => `${c.case_name} ${c.id}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <dialog ref={ref} className="operations-guide" aria-labelledby="optimiser-cases-title" onCancel={e => { e.preventDefault(); onClose() }}
    onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <header className="operations-guide__header"><div><h2 id="optimiser-cases-title">Case controls</h2><p>Let the optimiser choose, require inclusion, or exclude a case. These rules always stay strict.</p></div><button className="operations-guide__close" aria-label="Close case controls" onClick={onClose}><X size={20} /></button></header>
    <form className="results-settings__form" onSubmit={e => { e.preventDefault(); onApply({ mandatory_case_ids: cases.filter(c => controls[c.id] === 'mandatory').map(c => c.id), excluded_case_ids: cases.filter(c => controls[c.id] === 'excluded').map(c => c.id) }) }}>
      <div className="operations-guide__content"><label className="results-settings__field">Search cases<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <p className="text-small text-muted">{shown.length} of {cases.length} cases</p>
        {shown.map(c => <label key={c.id} className="results-settings__field">{c.case_name} · ID {c.id}<select value={controls[c.id]} onChange={e => setControls(previous => ({ ...previous, [c.id]: e.target.value }))}>
          <option value="optional">Optimiser chooses</option><option value="mandatory">Must include</option><option value="excluded">Must exclude</option>
        </select></label>)}
      </div>
      <footer className="operations-guide__footer results-settings__actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit">Apply controls</button></footer>
    </form>
  </dialog>
}

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import OptimiserControls from './OptimiserControls'
import { changeMixShare, excludeRegionShares, excludedRegionRules, mixTotal, runGateBlocked, timingBlocked } from '../pages/optimiserHelpers'
import './ReferenceConfig.css'

const fmt = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })

function MixSection({ title, section, reference, onChange, onReset, excluded = [], ready }) {
  const total = mixTotal(section.sliders)
  return (
    <div className="optimiser-mix-section">
      <div className="optimiser-mix-heading">
        <label className="optimiser-check-label">
          <input type="checkbox" checked={section.enabled}
            onChange={e => onChange({ ...section, enabled: e.target.checked })} />
          {title}
        </label>
        {section.enabled && ready && <button type="button" className="saved-scenarios__trigger" onClick={onReset}>Reset to reference mix</button>}
      </div>
      {section.enabled && ready && <>
        <label className="optimiser-tolerance">Allowed difference (± percentage points)
          <input type="number" min="0" max="100" step="0.1" required value={section.tolerance}
            onChange={e => onChange({ ...section, tolerance: e.target.value })} />
        </label>
        {Object.entries(section.sliders).map(([value, pct]) => (
          <div key={value} className="optimiser-mix-row">
            <span className="optimiser-mix-label">{value}
              <small className="results-case-id">Reference: {fmt(reference?.[value])}%{excluded.includes(value) ? ' · Excluded' : ''}</small>
            </span>
            <input type="range" min="0" max="100" step="1" value={pct}
              aria-label={`${title}: ${value} target share`} disabled={excluded.includes(value)}
              onChange={e => onChange({ ...section, sliders: changeMixShare(section.sliders, value, e.target.value, excluded) })} />
            <span className="optimiser-mix-value">{fmt(pct)}%</span>
          </div>
        ))}
        <p className="optimiser-mix-total">Total: {fmt(total)}%</p>
      </>}
    </div>
  )
}

export default function OptimiserPortfolioControls({ cases, draft, reference, referenceReady, referenceError, onRetry, onChange, onChangeControls, onClear, onClose }) {
  const dialogRef = useRef(null)
  const [showCaseSelection, setShowCaseSelection] = useState(false)
  useEffect(() => {
    const dialog = dialogRef.current, opener = document.activeElement, overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  const exclusions = excludedRegionRules(draft, cases)
  return <dialog ref={dialogRef} className="reference-config optimiser-controls-pane" aria-labelledby="portfolio-controls-title"
    aria-describedby="portfolio-controls-description"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }}>
    <header className="reference-config__header">
      <div><h2 id="portfolio-controls-title">Advanced controls</h2>
        <p id="portfolio-controls-description">Optional settings for your next optimisation. Changes apply immediately and stay active when you close this pane.</p></div>
      <button type="button" className="reference-config__close" aria-label="Close advanced controls" onClick={onClose}><X size={20} /></button>
    </header>
    <div className="reference-config__content">
      <section aria-labelledby="timing-title">
        <h3 id="timing-title">Timing</h3>
        <p className="text-small text-muted">Let the optimiser compare unchanged cases with earlier or later profiles.
          Pure year shifts: no penalties, acquisition costs or extra Capex. Tax rates and discounting follow the shifted years.</p>
        <label className="optimiser-check-label">
          <input type="checkbox" checked={draft.timing.enabled}
            onChange={event => onChange({ timing: { ...draft.timing, enabled: event.target.checked } })} />
          Allow timing changes
        </label>
        {draft.timing.enabled && <>
          <div className="optimiser-objective">
            <label>Maximum delay (years)
              <input type="number" min="0" max="14" step="1" value={draft.timing.max_delay_years}
                onChange={e => onChange({ timing: { ...draft.timing, max_delay_years: e.target.value } })} />
            </label>
            <label>Maximum acceleration (years)
              <input type="number" min="0" max="14" step="1" value={draft.timing.max_acceleration_years}
                onChange={e => onChange({ timing: { ...draft.timing, max_acceleration_years: e.target.value } })} />
            </label>
          </div>
          <p className="text-small text-muted">Use 0 to turn off a direction. Each included case gets one option.
            Shifts that move nonzero values outside 2026–2040 are unavailable.</p>
          {timingBlocked(draft) && <p role="alert">Enter whole years from 0 to 14, with at least one direction above zero.</p>}
        </>}
      </section>
      <section aria-labelledby="portfolio-mix-title">
        <h3 id="portfolio-mix-title">Portfolio mix</h3>
        <p className="text-small text-muted">Enable targets for shares of selected production over {draft.year_from}–{draft.year_to}.
          Sliders move in 1% increments and redistribute the other shares to keep 100%. Whole cases are selected, so the initial allowance is ±5 percentage points.
          Changing the objective period resets targets to its reference mix.</p>
        {referenceError ? <div role="alert"><p>{referenceError} Case selections can still be used with mix targets off.</p>
          <button type="button" onClick={onRetry}>Retry reference mix</button></div>
          : !referenceReady && <p role="status">Loading reference production mix…</p>}
        <MixSection title="Oil / Gas mix" section={draft.group_entity_mix} ready={referenceReady}
          reference={reference?.shares.group_entity}
          onChange={section => onChange({ group_entity_mix: section })}
          onReset={() => onChange({ group_entity_mix: { ...draft.group_entity_mix, sliders: reference.shares.group_entity } })} />
        <MixSection title="Regional mix" section={draft.region_mix} ready={referenceReady}
          reference={reference?.shares.region} excluded={Object.keys(exclusions)}
          onChange={section => onChange({ region_mix: section })}
          onReset={() => onChange({ region_mix: { ...draft.region_mix, sliders: excludeRegionShares(reference.shares.region, exclusions) } })} />
        {runGateBlocked({ ...draft, timing: { enabled: false } }) && <p role="alert">Enabled mix targets must total 100%, with an allowed difference between 0 and 100 percentage points.</p>}
        <p className="text-small text-muted">Excluding every case in a region redistributes its regional target to the others. Oil / Gas targets stay as set and may need adjusting.</p>
      </section>
      <section aria-labelledby="case-selection-title">
        <h3 id="case-selection-title">Case selection</h3>
        <p className="text-small text-muted">Choose by region, then refine by country and case. A country overrides its region; a case overrides both.
          Inherit follows the parent rule. Optimiser chooses removes that restriction. Existing more-specific choices remain in effect when a parent changes.</p>
        <label className="optimiser-check-label">
          <input type="checkbox" checked={showCaseSelection} aria-controls="optimiser-case-selection"
            onChange={event => setShowCaseSelection(event.target.checked)} />
          Show case selection
        </label>
        <p className="text-small text-muted">Your selections stay active when this section is hidden.</p>
        <div id="optimiser-case-selection" hidden={!showCaseSelection}>
          <OptimiserControls cases={cases} draft={draft} onChange={onChangeControls} />
        </div>
      </section>
    </div>
    <footer className="reference-config__footer">
      <button type="button" className="reference-config__cancel" onClick={onClear}>Clear advanced controls</button>
      <button type="button" className="reference-config__apply" onClick={onClose}>Done</button>
    </footer>
  </dialog>
}

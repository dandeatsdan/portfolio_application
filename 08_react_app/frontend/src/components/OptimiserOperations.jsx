import Toggle from './Toggle'
import { timingBlocked } from '../pages/optimiserHelpers'

export default function OptimiserOperations({ draft, onChange }) {
  return <section aria-labelledby="allowed-operations-title">
    <h3 id="allowed-operations-title">Allowed operations</h3>
    <p className="text-small text-muted">Each case can use one permitted operation or stay unchanged. Cases kept as per reference cannot change.
      Enabling an operation permits it; it does not require it.</p>
    {['delay', 'acceleration'].map(direction => <div className="optimiser-operation" key={direction}>
      <label className="optimiser-check-label">
        <Toggle checked={draft.timing[`${direction}_enabled`]}
          onChange={e => onChange({ timing: { ...draft.timing, [`${direction}_enabled`]: e.target.checked } })} />
        Allow {direction === 'delay' ? 'Delay' : 'Accelerate'}
      </label>
      {draft.timing[`${direction}_enabled`] && <label>Maximum {direction} (years)
        <input type="number" min="1" max="14" step="1" value={draft.timing[`max_${direction}_years`]}
          onChange={e => onChange({ timing: { ...draft.timing, [`max_${direction}_years`]: e.target.value } })} />
      </label>}
    </div>)}
    {timingBlocked(draft) && <p role="alert">Enter whole years from 1 to 14 for enabled timing operations.</p>}
    <p className="text-small text-muted">Timing compares each whole-year shift up to the limit, with no added costs. Shifts must retain all nonzero values within 2026–2040.</p>
  </section>
}

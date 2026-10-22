import { useState } from 'react'

// Individual case controls. Whole-region rules are strict; conflicts are rejected.
// Used inside a <details> element in PortfolioOptimiser.
// Props:
//   cases         — full case array from getCases()
//   mandatoryIds  — current mandatory_case_ids array
//   excludedIds   — current excluded_case_ids array
//   onChange      — called live with { mandatory_case_ids, excluded_case_ids }
export default function OptimiserCaseControls({ cases, mandatoryIds = [], excludedIds = [], onChange }) {
  const [search, setSearch] = useState('')

  const mandatorySet = new Set(mandatoryIds)
  const excludedSet  = new Set(excludedIds)

  function getState(id) {
    if (mandatorySet.has(id)) return 'mandatory'
    if (excludedSet.has(id))  return 'excluded'
    return 'optional'
  }

  function setState(id, value) {
    const newMandatory = new Set(mandatorySet)
    const newExcluded  = new Set(excludedSet)
    newMandatory.delete(id); newExcluded.delete(id)
    if (value === 'mandatory') newMandatory.add(id)
    if (value === 'excluded')  newExcluded.add(id)
    onChange({ mandatory_case_ids: [...newMandatory], excluded_case_ids: [...newExcluded] })
  }

  const shown = cases.filter(c =>
    `${c.case_name} ${c.id}`.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <div style={{ marginTop: 8 }}>
      <input
        type="search"
        aria-label="Search individual case controls"
        placeholder="Search cases…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 8, width: '100%', maxWidth: 300 }}
      />
      <p className="text-small text-muted" style={{ marginBottom: 6 }}>
        {shown.length} of {cases.length} cases · region rules remain strict
      </p>
      {shown.map(c => (
        <div key={c.id} className="optimiser-tier-row">
          <span>{c.case_name} <small style={{ color: 'var(--color-text-muted)' }}>ID {c.id}</small></span>
          <select aria-label={`Case control for ${c.case_name} (ID ${c.id})`} value={getState(c.id)} onChange={e => setState(c.id, e.target.value)}>
            <option value="optional">Optimiser chooses</option>
            <option value="mandatory">Must include</option>
            <option value="excluded">Must exclude</option>
          </select>
        </div>
      ))}
    </div>
  )
}

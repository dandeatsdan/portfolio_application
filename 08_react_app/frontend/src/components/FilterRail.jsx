/**
 * FilterRail — cascaded filter sections for the left panel.
 * Available options for each dimension update based on all OTHER active filters,
 * matching Power BI slicer cross-filtering behaviour.
 */
import { useState, useEffect } from 'react'
import { getFilterOptions } from '../api/client'

const DIMENSIONS = [
  { key: 'planTypes',     label: 'Plan Type',    optKey: 'plan_types'     },
  { key: 'groupEntities', label: 'Group Entity', optKey: 'group_entities' },
  { key: 'segments',      label: 'Segment',      optKey: 'segments'       },
  { key: 'regions',       label: 'Region',       optKey: 'regions'        },
  { key: 'countries',     label: 'Country',      optKey: 'countries'      },
  { key: 'caseNames',     label: 'Case Name',    optKey: 'case_names'     },
]

function Section({ label, selectedCount, open, onToggle, onClear, children }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onToggle}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.5rem 0', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, color: 'var(--color-text)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}
        >
          <span>{label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {selectedCount > 0 && (
              <span style={{
                background: 'var(--color-accent-dark)', color: '#fff',
                borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px',
              }}>{selectedCount}</span>
            )}
            <span style={{ color: 'var(--color-text-muted)', fontSize: 9 }}>{open ? '▲' : '▼'}</span>
          </span>
        </button>
        {selectedCount > 0 && (
          <button
            onClick={onClear}
            title="Clear selection"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 11, padding: '0 0 0 4px' }}
          >✕</button>
        )}
      </div>
      {open && <div style={{ paddingBottom: '0.5rem' }}>{children}</div>}
    </div>
  )
}

function CheckList({ available, selected, onChange }) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? available.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : available

  const toggle = (v) => {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]
    onChange(next)
  }

  return (
    <div>
      {available.length > 7 && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            width: '100%', fontSize: 11, padding: '3px 6px',
            border: '1px solid var(--color-border)', borderRadius: 4,
            marginBottom: '0.35rem', outline: 'none',
          }}
        />
      )}
      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
        {filtered.map(v => (
          <label key={v} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, padding: '2px 0', cursor: 'pointer',
            color: 'var(--color-text)',
          }}>
            <input
              type="checkbox"
              checked={selected.includes(v)}
              onChange={() => toggle(v)}
              style={{ accentColor: 'var(--color-accent-dark)', cursor: 'pointer' }}
            />
            {v}
          </label>
        ))}
        {filtered.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>No matches</span>
        )}
      </div>
    </div>
  )
}

export default function FilterRail({ filters, onChange, showYearRange = true, periodHint = 'Filter table rows here. Set reference periods in Edit metrics.' }) {
  const [open, setOpen] = useState({ yearRange: true, planTypes: true })
  const [options, setOptions] = useState({
    plan_types: [], group_entities: [], segments: [],
    regions: [], countries: [], case_names: [],
  })

  // Re-fetch cascaded options whenever filters change
  useEffect(() => {
    getFilterOptions(filters)
      .then(setOptions)
      .catch(() => {})
  }, [filters])

  const toggleSection = (key) => setOpen(prev => ({ ...prev, [key]: !prev[key] }))
  const setFilter = (key, value) => onChange({ ...filters, [key]: value })
  const clearFilter = (key) => onChange({ ...filters, [key]: [] })

  const hasAnyDimFilter = DIMENSIONS.some(d => (filters[d.key] || []).length > 0)

  const EMPTY_FILTERS = {
    yearFrom: 2026, yearTo: 2040,
    planTypes: [], groupEntities: [], segments: [],
    regions: [], countries: [], caseNames: [],
  }

  return (
    <div style={{ height: `calc(100vh - var(--header-height))`, overflowY: 'auto', padding: '1rem 0.75rem', fontSize: 12 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
          Filters
        </span>
        {hasAnyDimFilter && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-dark)', fontSize: 11, fontWeight: 600, padding: 0 }}
          >
            ↺ Reset all
          </button>
        )}
      </div>

      {/* Year Range */}
      {showYearRange && <Section label="Year Range" selectedCount={0} open={!!open.yearRange} onToggle={() => toggleSection('yearRange')} onClear={() => {}}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>From</div>
            <input
              type="number" value={filters.yearFrom} min={2026} max={filters.yearTo}
              onChange={e => setFilter('yearFrom', Number(e.target.value))}
              style={{ width: '100%', fontSize: 12, padding: '3px 5px', border: '1px solid var(--color-border)', borderRadius: 4 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>To</div>
            <input
              type="number" value={filters.yearTo} min={filters.yearFrom} max={2040}
              onChange={e => setFilter('yearTo', Number(e.target.value))}
              style={{ width: '100%', fontSize: 12, padding: '3px 5px', border: '1px solid var(--color-border)', borderRadius: 4 }}
            />
          </div>
        </div>
      </Section>}

      {!showYearRange && <p style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{periodHint}</p>}

      {/* Dimension filters — cascaded */}
      {DIMENSIONS.map(({ key, label, optKey }) => {
        const available = options[optKey] || []
        const selected  = filters[key] || []
        return (
          <Section
            key={key}
            label={label}
            selectedCount={selected.length}
            open={!!open[key]}
            onToggle={() => toggleSection(key)}
            onClear={() => clearFilter(key)}
          >
            <CheckList
              available={available}
              selected={selected}
              onChange={v => setFilter(key, v)}
            />
          </Section>
        )
      })}
    </div>
  )
}

/**
 * KPI summary card.
 * Shows a headline value, label, optional sub-label, and optional delta.
 */

function deltaColour(value) {
  if (value === null || value === undefined) return 'var(--color-text-muted)'
  return value >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'
}

export default function KpiCard({ title, value, unit = '', subLabel = '', delta = null, deltaPct = null, help = '' }) {
  return (
    <div
      title={help}
      style={{
        background:    '#fff',
        border:        '1px solid var(--color-border)',
        borderTop:     '2px solid var(--color-accent-dark)',
        borderRadius:  'var(--radius)',
        padding:       '0.9rem 1.1rem',
        flex:          '1 1 0',
        minWidth:      150,
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem', fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1 }}>
        {value !== null && value !== undefined ? value : '—'}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 3, color: 'var(--color-text-muted)' }}>{unit}</span>}
      </div>
      {subLabel && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          {subLabel}
        </div>
      )}
      {delta !== null && (
        <div style={{ fontSize: 12, color: deltaColour(delta), marginTop: '0.3rem', fontWeight: 500 }}>
          {delta >= 0 ? '+' : ''}{typeof delta === 'number' ? delta.toLocaleString(undefined, { maximumFractionDigits: 1 }) : delta}
          {deltaPct !== null && ` (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
        </div>
      )}
    </div>
  )
}

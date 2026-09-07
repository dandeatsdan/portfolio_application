/**
 * Card wrapper for Recharts chart panels.
 * Provides consistent title, border, and background.
 */
export default function ChartPanel({ title, children, style = {} }) {
  return (
    <div style={{
      background:    'var(--color-surface)',
      border:        '1px solid var(--color-border)',
      borderRadius:  'var(--radius)',
      padding:       '1rem 1.2rem',
      ...style,
    }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

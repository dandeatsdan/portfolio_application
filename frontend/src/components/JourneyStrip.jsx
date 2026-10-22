/**
 * Horizontal workflow indicator strip.
 * Highlights the current step and greys out inactive steps.
 */
export default function JourneyStrip({ current }) {
  const steps = [
    { key: 'portfolio', label: '1 · Explore Portfolio' },
    { key: 'build',     label: '2 · Build a Scenario'  },
    { key: 'results',   label: '3 · Review Results'    },
  ]

  const stripStyle = {
    background:    'var(--color-surface)',
    border:        '1px solid var(--color-border)',
    borderRadius:  'var(--radius)',
    padding:       '0.6rem 1.2rem',
    display:       'flex',
    alignItems:    'center',
    gap:           '0.5rem',
    marginBottom:  '1.25rem',
    fontSize:      13,
  }

  return (
    <div style={stripStyle}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '0.08em', marginRight: '0.25rem' }}>
        WORKFLOW
      </span>
      {steps.map((step, i) => (
        <span key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {i > 0 && <span style={{ color: 'var(--color-border)', margin: '0 0.2rem' }}>›</span>}
          <span style={{
            fontWeight: step.key === current ? 600 : 400,
            color:      step.key === current ? 'var(--color-accent-dark)' : 'var(--color-text-muted)',
          }}>
            {step.label}
          </span>
        </span>
      ))}
    </div>
  )
}

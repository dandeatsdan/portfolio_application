import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getHealth } from '../api/client'
import { BarChart2, PencilRuler, TrendingUp, FolderOpen } from 'lucide-react'

import SavedScenarios from '../components/SavedScenarios'

const CARDS = [
  {
    to:    '/portfolio',
    step:  1,
    icon:  BarChart2,
    title: 'Portfolio Viewer',
    desc:  'Review portfolio shape, quality and key contributors, then shortlist entities for a scenario.',
  },
  {
    to:    '/build',
    step:  2,
    icon:  PencilRuler,
    title: 'Build a Scenario',
    desc:  'Create a new scenario or continue editing a saved draft.',
  },
  {
    to:    '/results',
    step:  3,
    icon:  TrendingUp,
    title: 'Scenario Results',
    desc:  'Review the latest successful scenario run and its portfolio impact.',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const [health, setHealth] = useState(null)
  const [savedOpen, setSavedOpen] = useState(false)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ status: 'error' }))
  }, [])

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Explore, build and review portfolio scenarios
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', margin: 0 }}>
          Choose where to begin — review the portfolio, build a scenario<br />or reopen a saved scenario.
        </p>
      </div>

      {/* Destination cards */}
      <div className="home-destinations">
        {CARDS.map(({ to, step, icon: Icon, title, desc }) => (
          <div key={to} className="home-destination">
          <button
            onClick={() => navigate(to)}
            style={{
              flex:          1,
              background:    '#fff',
              border:        '1px solid var(--color-border)',
              borderTop:     '3px solid var(--color-accent-dark)',
              borderRadius:  'var(--radius)',
              padding:       '1.75rem 1.5rem',
              textAlign:     'left',
              cursor:        'pointer',
              display:       'flex',
              flexDirection: 'column',
              gap:           '0.6rem',
              boxShadow:     'var(--shadow)',
              transition:    'box-shadow 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderTopColor = 'var(--color-accent)'
              const svg = e.currentTarget.querySelector('svg')
              if (svg) svg.style.color = 'var(--color-accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'var(--shadow)'
              e.currentTarget.style.borderTopColor = 'var(--color-accent-dark)'
              const svg = e.currentTarget.querySelector('svg')
              if (svg) svg.style.color = 'var(--color-accent-dark)'
            }}
          >
            <Icon size={32} style={{ display: 'block', color: 'var(--color-accent-dark)', transition: 'color 0.15s' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {title}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5, flex: 1 }}>
              {desc}
            </span>
            <span style={{ fontSize: '1.1rem', color: 'var(--color-accent-dark)', marginTop: '0.25rem' }}>→</span>
          </button>
          <div className="home-destination__secondary">
            {to === '/build' && <button type="button" className="saved-scenarios__trigger" aria-haspopup="dialog" onClick={() => setSavedOpen(true)}>
              <FolderOpen size={14} aria-hidden="true" /> Saved scenarios
            </button>}
          </div>
          </div>
        ))}
      </div>

      {savedOpen && <SavedScenarios onClose={() => setSavedOpen(false)} onOpen={id => {
        setSavedOpen(false)
        navigate(`/build?scenario=${id}`)
      }} />}

      {/* Journey steps */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            0,
        background:     '#F7F7F7',
        border:         '1px solid var(--color-border)',
        borderRadius:   'var(--radius)',
        padding:        '1.25rem 2rem',
        marginBottom:   '2rem',
      }}>
        {CARDS.map(({ step, title }, i) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{
                width:        32,
                height:       32,
                borderRadius: '50%',
                background:   'var(--color-accent-dark)',
                color:        '#fff',
                fontWeight:   700,
                fontSize:     '0.9rem',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
              }}>
                {step}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text)' }}>{title}</span>
            </div>
            {i < CARDS.length - 1 && (
              <div style={{
                width:       60,
                height:      2,
                background:  'var(--color-accent-dark)',
                margin:      '0 0.5rem',
                marginBottom: '1.1rem',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Backend status */}
      {health && (
        <div style={{
          padding:      '0.75rem 1rem',
          background:   health.status === 'ok' ? '#f0fdf0' : '#fef2f2',
          border:       `1px solid ${health.status === 'ok' ? 'var(--color-accent-dark)' : 'var(--color-negative)'}`,
          borderRadius: 'var(--radius)',
          fontSize:     13,
          color:        'var(--color-text)',
          textAlign:    'center',
        }}>
          {health.status === 'ok'
            ? `✓ Backend connected — ${health.cases} cases, ${health.profiles?.toLocaleString()} profile rows loaded.`
            : '✗ Backend not reachable. Run: python -m uvicorn backend.main:app --reload --port 8000'}
        </div>
      )}
    </div>
  )
}

/**
 * AppShell — fixed top header (BP Deep Green) + optional left panel (warm grey).
 * Home page: full-width content, no side panel.
 * Inner pages: 260px grey left panel slot (for filters etc.) + scrollable content.
 */
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const headerStyle = {
  position:       'fixed',
  top:            0,
  left:           0,
  right:          0,
  height:         'var(--header-height)',
  background:     'var(--color-header-bg)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  padding:        '0 2rem',
  zIndex:         200,
  boxShadow:      '0 2px 6px rgba(0,0,0,0.25)',
}

const brandStyle = {
  display:    'flex',
  flexDirection: 'column',
  gap:        2,
}

const brandPrimaryStyle = {
  color:         '#CCFF00',   // BP Bright Green
  fontWeight:    700,
  fontSize:      '0.95rem',
  letterSpacing: '0.07em',
  lineHeight:    1,
}

const brandSecondaryStyle = {
  color:         'rgba(255,255,255,0.5)',
  fontSize:      '0.65rem',
  letterSpacing: '0.1em',
  lineHeight:    1.2,
}

const navStyle = {
  display:    'flex',
  alignItems: 'center',
  gap:        '0.25rem',
}

const navLinkBase = {
  padding:        '0.35rem 0.9rem',
  borderRadius:   4,
  color:          'rgba(255,255,255,0.65)',
  fontSize:       '0.85rem',
  fontWeight:     500,
  textDecoration: 'none',
  transition:     'background 0.15s, color 0.15s',
}

const navLinkActive = {
  background: 'rgba(204,255,0,0.12)',
  color:      '#CCFF00',
}

const NAV_ITEMS = [
  { to: '/',          label: 'Home'             },
  { to: '/portfolio', label: 'Portfolio Viewer' },
  { to: '/build',     label: 'Build a Scenario' },
  { to: '/results',   label: 'Scenario Results' },
]

const HOME_PATHS = ['/']

export default function AppShell({ children, sidePanel }) {
  const { pathname } = useLocation()
  const isHome = HOME_PATHS.includes(pathname)
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div style={{ paddingTop: 'var(--header-height)', minHeight: '100vh', background: 'var(--color-canvas)' }}>

      {/* Fixed header */}
      <header style={headerStyle}>
        <div style={brandStyle}>
          <span style={brandPrimaryStyle}>Dan Deaton · Software Development Project</span>
          <span style={brandSecondaryStyle}>UPSTREAM PORTFOLIO SCENARIO MODELLER</span>
        </div>

        <nav style={navStyle}>
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => isActive ? { ...navLinkBase, ...navLinkActive } : navLinkBase}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Body — full width on Home, split on inner pages */}
      {isHome ? (
        <main style={{ padding: '2.5rem 3rem', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
      ) : (
        <div style={{ display: 'flex', minHeight: `calc(100vh - var(--header-height))` }}>

          {/* Left panel — clips cleanly when collapsed */}
          <aside style={{
            width:       sidePanel && panelOpen ? 'var(--sidebar-width)' : 0,
            flexShrink:  0,
            background:  '#F7F7F7',
            borderRight: '1px solid var(--color-border)',
            minHeight:   '100%',
            overflow:    'hidden',
            transition:  'width 0.2s ease',
          }}>
            <div style={{ width: 'var(--sidebar-width)' }}>
              {sidePanel || null}
            </div>
          </aside>

          {/* Zero-width column just for the toggle tab — sits on the border */}
          {sidePanel && (
            <div style={{ width: 0, flexShrink: 0, position: 'relative', zIndex: 10 }}>
              <button
                onClick={() => setPanelOpen(o => !o)}
                title={panelOpen ? 'Collapse filters' : 'Expand filters'}
                style={{
                  position:       'absolute',
                  top:            12,
                  left:           0,
                  width:          16,
                  height:         28,
                  background:     '#F7F7F7',
                  border:         '1px solid var(--color-border)',
                  borderLeft:     'none',
                  borderRadius:   '0 4px 4px 0',
                  cursor:         'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       10,
                  color:          'var(--color-text-muted)',
                  padding:        0,
                  boxShadow:      '2px 0 4px rgba(0,0,0,0.08)',
                }}
              >
                {panelOpen ? '‹' : '›'}
              </button>
            </div>
          )}

          {/* Page content */}
          <main style={{ flex: 1, padding: '2rem 2.5rem', minWidth: 0 }}>
            {children}
          </main>
        </div>
      )}
    </div>
  )
}

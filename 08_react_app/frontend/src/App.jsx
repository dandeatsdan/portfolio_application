/**
 * App root — router, shared context, AppShell.
 *
 * Shared contexts:
 *   SelectionContext   — shortlisted case IDs, edited in Portfolio Viewer and Build a Scenario
 *   SidePanelContext   — lets inner pages inject content into AppShell's left panel
 *   FiltersContext     — global filter state, persisted across all pages
 *   ScenarioResultContext — last scenario run result
 */
import { createContext, useState, useContext, useReducer, useCallback, useMemo, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WorkingScenarioContext } from './hooks/WorkingScenarioContext'
import { scenarioReducer, initialScenario, isDirty } from './hooks/scenarioDefinition'
import AppShell from './components/AppShell'
import Home             from './pages/Home'
import PortfolioViewer  from './pages/PortfolioViewer'
import BuildScenario    from './pages/BuildScenario'
import ScenarioResults  from './pages/ScenarioResults'
import PortfolioOptimiser from './pages/PortfolioOptimiser'

export const DEFAULT_FILTERS = {
  yearFrom: 2026, yearTo: 2040,
  planTypes: [], groupEntities: [], segments: [],
  regions: [], countries: [], caseNames: [],
}

export const SelectionContext      = createContext({ selectedIds: new Set(), setSelectedIds: () => {} })
export const ScenarioResultContext = createContext({ scenarioResult: null, setScenarioResult: () => {}, lastRunError: null, setLastRunError: () => {} })
export const SidePanelContext      = createContext({ sidePanel: null, setSidePanel: () => {} })
export const FiltersContext        = createContext({ filters: DEFAULT_FILTERS, setFilters: () => {} })

export default function App() {
  const [working, dispatch] = useReducer(scenarioReducer, undefined, initialScenario)
  const selectedIds = useMemo(() => new Set(working.selectedIds), [working.selectedIds])
  const setSelectedIds = useCallback(value => dispatch({ type: 'selection', value }), [])
  const dirty = isDirty(working)
  useEffect(() => {
    if (!dirty) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const [scenarioResult, setScenarioResult] = useState(null)
  const [lastRunError, setLastRunError] = useState(null)
  const [sidePanel,      setSidePanel]      = useState(null)
  const [filters,        setFilters]        = useState(DEFAULT_FILTERS)

  return (
    <WorkingScenarioContext.Provider value={{ working, dispatch }}>
    <SelectionContext.Provider value={{ selectedIds, setSelectedIds }}>
      <ScenarioResultContext.Provider value={{ scenarioResult, setScenarioResult, lastRunError, setLastRunError }}>
        <FiltersContext.Provider value={{ filters, setFilters }}>
          <SidePanelContext.Provider value={{ sidePanel, setSidePanel }}>
            <BrowserRouter>
              <AppShellWithPanel>
                <Routes>
                  <Route path="/"          element={<Home />} />
                  <Route path="/portfolio" element={<PortfolioViewer />} />
                  <Route path="/build"     element={<BuildScenario />} />
                  <Route path="/results"   element={<ScenarioResults />} />
                  <Route path="/optimise" element={<PortfolioOptimiser />} />
                </Routes>
              </AppShellWithPanel>
            </BrowserRouter>
          </SidePanelContext.Provider>
        </FiltersContext.Provider>
      </ScenarioResultContext.Provider>
    </SelectionContext.Provider>
    </WorkingScenarioContext.Provider>
  )
}

function AppShellWithPanel({ children }) {
  const { sidePanel } = useContext(SidePanelContext)
  return <AppShell sidePanel={sidePanel}>{children}</AppShell>
}

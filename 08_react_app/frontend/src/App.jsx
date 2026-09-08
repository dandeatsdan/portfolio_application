/**
 * App root — router, shared context, AppShell.
 *
 * Shared contexts:
 *   SelectionContext   — shortlisted case IDs (set in Portfolio Viewer, read in Build a Scenario)
 *   SidePanelContext   — lets inner pages inject content into AppShell's left panel
 *   FiltersContext     — global filter state, persisted across all pages
 *   ScenarioResultContext — last scenario run result
 */
import { createContext, useState, useContext } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'
import Home             from './pages/Home'
import PortfolioViewer  from './pages/PortfolioViewer'
import BuildScenario    from './pages/BuildScenario'
import ScenarioResults  from './pages/ScenarioResults'

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
  const [selectedIds,    setSelectedIds]    = useState(new Set())
  const [scenarioResult, setScenarioResult] = useState(null)
  const [lastRunError, setLastRunError] = useState(null)
  const [sidePanel,      setSidePanel]      = useState(null)
  const [filters,        setFilters]        = useState(DEFAULT_FILTERS)

  return (
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
                </Routes>
              </AppShellWithPanel>
            </BrowserRouter>
          </SidePanelContext.Provider>
        </FiltersContext.Provider>
      </ScenarioResultContext.Provider>
    </SelectionContext.Provider>
  )
}

function AppShellWithPanel({ children }) {
  const { sidePanel } = useContext(SidePanelContext)
  return <AppShell sidePanel={sidePanel}>{children}</AppShell>
}

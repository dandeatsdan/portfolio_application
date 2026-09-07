/**
 * Manages scenario configuration state and the run action.
 *
 * scenarioState: { name, description, rationale, cases: { [id]: {include, operation, params[]} } }
 */
import { useState, useCallback } from 'react'
import { runScenario } from '../api/client'

const OPERATION_MAP = {
  'No Change':           'NoChange',
  'Delay':               'Delay',
  'Accelerate':          'Accelerate',
  'Farm In (Increase)':  'Increase',
  'Farm Down (Dilution)':'Dilution',
  'Truncate Before':     'TruncateBefore',
  'Truncate After':      'TruncateAfter',
  'Production Change %': 'ProdnAdj',
  'OPEX Change %':       'CostAdjOpex',
  'CAPEX Change %':      'CostAdjCapex',
  'CAPEX Change $m':     'CapexAbsolute',
  'OPEX Change $m':      'OpexAbsolute',
}

export const OPERATION_LABELS = Object.keys(OPERATION_MAP)

function defaultCase() {
  return { include: true, operation: 'No Change', params: [0, 0, 0, 0, 0] }
}

export function useScenario(cases) {
  const [name,        setName]        = useState('Scenario 1')
  const [description, setDescription] = useState('')
  const [rationale,   setRationale]   = useState('')
  const [caseConfig,  setCaseConfig]  = useState({})
  const [running,     setRunning]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [runError,    setRunError]    = useState(null)
  const [diagnostics, setDiagnostics] = useState([])

  // Initialise case config entries when cases load
  const initCases = useCallback((caseList, selectedIds) => {
    const ids = selectedIds && selectedIds.length ? selectedIds : caseList.map(c => c.id)
    setCaseConfig(prev => {
      const next = { ...prev }
      ids.forEach(id => {
        if (!next[id]) next[id] = defaultCase()
      })
      return next
    })
  }, [])

  const setCaseField = useCallback((id, field, value) => {
    setCaseConfig(prev => ({
      ...prev,
      [id]: { ...prev[id] ?? defaultCase(), [field]: value },
    }))
  }, [])

  const setParam = useCallback((id, index, value) => {
    setCaseConfig(prev => {
      const cs = prev[id] ?? defaultCase()
      const params = [...cs.params]
      params[index] = value
      return { ...prev, [id]: { ...cs, params } }
    })
  }, [])

  const run = useCallback(async (allCases) => {
    setRunning(true)
    setRunError(null)
    setDiagnostics([])
    try {
      const instructions = allCases
        .filter(c => (caseConfig[c.id] ?? defaultCase()).include)
        .map(c => {
          const cs = caseConfig[c.id] ?? defaultCase()
          return {
            id:        c.id,
            case:      c.case,
            include:   cs.include,
            operation: OPERATION_MAP[cs.operation] ?? 'NoChange',
            param1:    cs.params[0] ?? 0,
            param2:    cs.params[1] ?? 0,
            param3:    cs.params[2] ?? 0,
            param4:    cs.params[3] ?? 0,
            param5:    cs.params[4] ?? 0,
          }
        })
      const data = await runScenario({ scenario_name: name, scenario_description: description, rationale, instructions })
      if (!data.valid) throw new Error('Scenario did not produce a valid result.')
      setResult(data)
    } catch (err) {
      setRunError(err.message)
      setDiagnostics(err.diagnostics ?? [])
    } finally {
      setRunning(false)
    }
  }, [name, description, rationale, caseConfig])

  return {
    name, setName,
    description, setDescription,
    rationale, setRationale,
    caseConfig, initCases, setCaseField, setParam,
    running, run,
    result, runError, diagnostics,
  }
}

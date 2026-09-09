/**
 * Manages scenario configuration state and the run action.
 *
 * scenarioState: { name, description, rationale, cases: { [id]: {include, operation, params[]} } }
 */
import { useState, useCallback } from 'react'
import { runScenario } from '../api/client'
import { buildScenarioInstructions, defaultCase } from './scenarioInstructions'

export { OPERATION_LABELS } from './scenarioInstructions'

export function useScenario(cases, shortlistIds) {
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

  const resetCase = useCallback((id) => {
    setCaseConfig(prev => ({ ...prev, [id]: defaultCase() }))
  }, [])

  const setParam = useCallback((id, index, value) => {
    setCaseConfig(prev => {
      const cs = prev[id] ?? defaultCase()
      const params = [...cs.params]
      params[index] = value
      return { ...prev, [id]: { ...cs, params } }
    })
  }, [])

  const instructions = buildScenarioInstructions(cases, shortlistIds, caseConfig)
  const includedCount = instructions.filter(instruction => instruction.include).length
  const modifiedCount = instructions.filter(instruction => instruction.include && instruction.operation !== 'NoChange').length

  const run = useCallback(async () => {
    if (includedCount === 0) return
    setRunning(true)
    setRunError(null)
    setDiagnostics([])
    try {
      const data = await runScenario({ scenario_name: name, scenario_description: description, rationale, instructions })
      if (!data.valid) throw new Error('Scenario did not produce a valid result.')
      setResult(data)
    } catch (err) {
      setRunError(err.message)
      setDiagnostics(err.diagnostics ?? [])
    } finally {
      setRunning(false)
    }
  }, [name, description, rationale, instructions, includedCount])

  return {
    name, setName,
    description, setDescription,
    rationale, setRationale,
    caseConfig, initCases, setCaseField, setParam, resetCase,
    includedCount, modifiedCount,
    running, run,
    result, runError, diagnostics,
  }
}

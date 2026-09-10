/**
 * Manages scenario configuration state and the run action.
 *
 * scenarioState: { name, description, rationale, cases: { [id]: {include, operation, params[]} } }
 */
import { useState, useCallback, useContext, useEffect } from 'react'
import { WorkingScenarioContext } from './WorkingScenarioContext'
import { runScenario } from '../api/client'
import { buildScenarioInstructions, defaultCase } from './scenarioInstructions'

export { OPERATION_LABELS } from './scenarioInstructions'

export function useScenario(cases, shortlistIds) {
  const { working, dispatch } = useContext(WorkingScenarioContext)
  const { name, description, rationale, caseConfig } = working
  const setName = value => dispatch({ type: 'field', field: 'name', value })
  const setDescription = value => dispatch({ type: 'field', field: 'description', value })
  const setRationale = value => dispatch({ type: 'field', field: 'rationale', value })
  const [running,     setRunning]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [runError,    setRunError]    = useState(null)
  const [diagnostics, setDiagnostics] = useState([])

  useEffect(() => {
    setResult(null)
    setRunError(null)
    setDiagnostics([])
  }, [working.epoch])

  const initCases = useCallback((caseList, selectedIds) => {
    dispatch({ type: 'init', ids: selectedIds ?? caseList.map(c => c.id) })
  }, [dispatch])
  const applyCaseConfig = useCallback((id, config) => {
    dispatch({ type: 'config', id, config: { ...config, params: [...config.params] } })
  }, [dispatch])
  const resetCase = useCallback(id => dispatch({ type: 'config', id, config: defaultCase() }), [dispatch])
  const setCaseField = (id, field, value) => applyCaseConfig(id, { ...(caseConfig[id] ?? defaultCase()), [field]: value })
  const setParam = (id, index, value) => {
    const config = caseConfig[id] ?? defaultCase()
    applyCaseConfig(id, { ...config, params: config.params.map((p, i) => i === index ? value : p) })
  }

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
    caseConfig, initCases, setCaseField, setParam, resetCase, applyCaseConfig,
    includedCount, modifiedCount,
    running, run,
    result, runError, diagnostics,
  }
}

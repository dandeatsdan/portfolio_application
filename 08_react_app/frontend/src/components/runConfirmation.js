import { buildScenarioInstructions } from '../hooks/scenarioInstructions.js'
import { findOperation } from './caseConfiguration.js'

// Use the same complete population and shortlist rules as the run payload.
export function summarizeRun(cases, selectedIds, caseConfig) {
  const instructions = buildScenarioInstructions(cases, selectedIds, caseConfig)
  const caseById = new Map(cases.map(row => [row.id, row]))
  const changes = instructions.filter(row => !row.include || row.operation !== 'NoChange').map(row => {
    const operation = findOperation(caseConfig[row.id]?.operation)
    return {
      id: row.id,
      name: caseById.get(row.id)?.case_name ?? row.case,
      included: row.include,
      operation: row.include ? operation?.name ?? row.operation : 'Excluded',
      // Excluded cases retain settings, but those operations will not run.
      inputs: row.include ? (operation?.inputs ?? []).map(input => ({
        label: input.label,
        value: row[`param${input.position}`],
      })) : [],
    }
  })
  return {
    referenceCount: instructions.filter(row => row.include && row.operation === 'NoChange').length,
    modifiedCount: instructions.filter(row => row.include && row.operation !== 'NoChange').length,
    excludedCount: instructions.filter(row => !row.include).length,
    changes,
  }
}

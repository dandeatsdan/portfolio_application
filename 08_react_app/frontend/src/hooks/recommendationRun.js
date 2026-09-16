import { saveBeforeRun } from './scenarioDefinition.js'
import { buildScenarioInstructions } from './scenarioInstructions.js'

export function scenarioRunPayload(definition, cases) {
  return {
    scenario_name: definition.name, scenario_description: definition.description, rationale: definition.rationale,
    instructions: buildScenarioInstructions(cases, new Set(definition.shortlisted_case_ids), definition.case_configurations),
  }
}

// The caller retains saved on run failure, so a retry cannot create a duplicate.
export async function runRecommendation({ definition, cases, saved, create, run, onSaved, isCurrent }) {
  let result
  const completed = await saveBeforeRun(async () => {
    if (!isCurrent()) return false
    if (!saved) saved = await create(definition)
    onSaved(saved)
    return isCurrent() ? saved.scenario_id : false
  }, async savedId => {
    const data = await run(scenarioRunPayload(definition, cases))
    if (!data.valid) throw new Error('Scenario did not produce a valid result.')
    result = { ...data, savedScenarioId: savedId }
  })
  return completed && isCurrent() ? { saved, result } : null
}

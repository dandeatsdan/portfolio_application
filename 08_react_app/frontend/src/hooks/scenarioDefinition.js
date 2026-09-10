import { defaultCase } from './scenarioInstructions.js'

export function serializeScenario(state) {
  const ids = [...state.selectedIds].sort((a, b) => a - b)
  return {
    schema_version: 1, name: state.name, description: state.description, rationale: state.rationale,
    shortlisted_case_ids: ids,
    case_configurations: Object.fromEntries(ids.map(id => {
      const config = state.caseConfig[id] ?? defaultCase()
      return [id, { ...config, params: [...config.params] }]
    })),
  }
}

export const fingerprint = definition => JSON.stringify(definition)
export function initialScenario() {
  const state = { name: 'Scenario 1', description: '', rationale: '', selectedIds: [], caseConfig: {},
    savedId: null, updatedAt: null, epoch: 0 }
  return { ...state, baseline: fingerprint(serializeScenario(state)) }
}
export const isDirty = state => fingerprint(serializeScenario(state)) !== state.baseline

export function hydrateScenario(saved) {
  const state = {
    name: saved.name, description: saved.description, rationale: saved.rationale,
    selectedIds: [...saved.shortlisted_case_ids],
    caseConfig: Object.fromEntries(Object.entries(saved.case_configurations).map(([id, config]) =>
      [id, { ...config, params: [...config.params] }])),
    savedId: saved.scenario_id, updatedAt: saved.updated_at,
  }
  return { ...state, baseline: fingerprint(serializeScenario(state)) }
}

export function scenarioReducer(state, action) {
  switch (action.type) {
    case 'load': return { ...hydrateScenario(action.saved), epoch: state.epoch + 1 }
    case 'deleted': return state.savedId !== action.id ? state : { ...state, savedId: null, updatedAt: null, baseline: null, epoch: state.epoch + 1 }
    case 'new': return { ...initialScenario(), epoch: state.epoch + 1 }
    case 'field': return { ...state, [action.field]: action.value }
    case 'selection': {
      const selected = typeof action.value === 'function' ? action.value(new Set(state.selectedIds)) : action.value
      const ids = [...selected]
      return { ...state, selectedIds: ids, caseConfig: Object.fromEntries(ids.map(id =>
        [id, state.selectedIds.includes(id) ? (state.caseConfig[id] ?? defaultCase()) : defaultCase()])) }
    }
    case 'config': return { ...state, caseConfig: { ...state.caseConfig, [action.id]: action.config } }
    case 'init': {
      const caseConfig = { ...state.caseConfig }
      action.ids.forEach(id => { if (!caseConfig[id]) caseConfig[id] = defaultCase() })
      return { ...state, caseConfig }
    }
    case 'saved': return action.epoch !== state.epoch ? state : { ...state, savedId: action.saved.scenario_id, updatedAt: action.saved.updated_at,
      baseline: fingerprint(action.definition) }
    default: return state
  }
}

export async function persistScenario(state, client, saveAs = false) {
  const definition = serializeScenario(state)
  const saved = state.savedId && !saveAs
    ? await client.update(state.savedId, { ...definition, expected_updated_at: state.updatedAt })
    : await client.create(definition)
  return { type: 'saved', saved, definition, epoch: state.epoch }
}

// A failed save must never run an unsaved configuration.
export async function saveBeforeRun(save, run) {
  const savedId = await save()
  if (!savedId) return false
  await run(savedId)
  return true
}

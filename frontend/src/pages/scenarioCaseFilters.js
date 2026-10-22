const DIMENSIONS = {
  planTypes: 'plan_type', groupEntities: 'group_entity', segments: 'segment',
  regions: 'region', countries: 'country', caseNames: 'case_name',
}

// Display filtering must never change shortlist membership or run instructions.
export function filterScenarioCases(cases, filters) {
  return cases.filter(row => Object.entries(DIMENSIONS).every(([key, field]) =>
    !filters[key]?.length || filters[key].includes(row[field])))
}

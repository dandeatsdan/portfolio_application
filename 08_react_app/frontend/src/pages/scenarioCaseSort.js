import { compareTableValues } from '../utils/tableSort.js'

export const SCENARIO_CASE_COLUMNS = [
  { key: 'id', label: 'ID', numeric: true },
  { key: 'case_name', label: 'Case Name' },
  { key: 'region', label: 'Region' },
  { key: 'country', label: 'Country' },
  { key: 'plan_type', label: 'Plan Type' },
  { key: 'reference', label: 'Reference 1', numeric: true },
  { key: 'reference2', label: 'Reference 2', numeric: true },
  { key: 'reference3', label: 'Reference 3', numeric: true },
]

export const SHORTLIST_CASE_COLUMNS = SCENARIO_CASE_COLUMNS.filter(column => column.key !== 'country')

// Supply visible rows in source order with the current raw reference value.
// Stable sorting preserves ties and the default order without mutating the rows.
export function sortScenarioCases(rows, sort = null) {
  const column = SCENARIO_CASE_COLUMNS.find(column => column.key === sort?.key)
  if (!column) return [...rows]
  return [...rows].sort((a, b) =>
    compareTableValues(a[column.key], b[column.key], column.numeric, sort.direction))
}

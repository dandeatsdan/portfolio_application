import { compareTableValues } from '../utils/tableSort.js'

export const CASE_SUMMARY_COLUMNS = [
  { key: 'Case Name', label: 'Case Name' },
  { key: 'Plan Type', label: 'Plan Type' },
  { key: 'Group Entity', label: 'Group Entity' },
  { key: 'Segment', label: 'Segment' },
  { key: 'Region', label: 'Region' },
  { key: 'Country', label: 'Country' },
  { key: 'Production', label: 'Production (mmboe)', numeric: true },
  { key: 'Capex', label: 'Capex ($m)', numeric: true },
  { key: 'FCF', label: 'Post-Tax FCF ($m)', numeric: true },
  { key: 'NPV', label: 'Post-Tax NPV ($m)', numeric: true },
]

// The caller supplies visible rows in their original API order. Array.sort is
// stable: equal values (and no column sort) retain that order within each group.
export function sortCaseSummaryRows(rows, shortlistIds, sort = null) {
  const column = CASE_SUMMARY_COLUMNS.find(column => column.key === sort?.key)
  return [...rows].sort((a, b) => {
    const shortlistOrder = Number(shortlistIds.has(b.ID)) - Number(shortlistIds.has(a.ID))
    if (shortlistOrder) return shortlistOrder
    if (!column) return 0

    return compareTableValues(a[column.key], b[column.key], column.numeric, sort.direction)
  })
}

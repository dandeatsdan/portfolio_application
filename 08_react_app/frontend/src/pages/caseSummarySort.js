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

function isMissing(value, numeric = false) {
  return value == null || (typeof value === 'string' && value.trim() === '') ||
    (numeric && !Number.isFinite(value))
}

// The caller supplies visible rows in their original API order. Array.sort is
// stable: equal values (and no column sort) retain that order within each group.
export function sortCaseSummaryRows(rows, shortlistIds, sort = null) {
  const column = CASE_SUMMARY_COLUMNS.find(column => column.key === sort?.key)
  return [...rows].sort((a, b) => {
    const shortlistOrder = Number(shortlistIds.has(b.ID)) - Number(shortlistIds.has(a.ID))
    if (shortlistOrder) return shortlistOrder
    if (!column) return 0

    const aValue = a[column.key]
    const bValue = b[column.key]
    const aMissing = isMissing(aValue, column.numeric)
    const bMissing = isMissing(bValue, column.numeric)
    // Missing values stay last within each shortlist group in both directions.
    if (aMissing || bMissing) return Number(aMissing) - Number(bMissing)

    const order = column.numeric
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
    return sort.direction === 'descending' ? -order : order
  })
}

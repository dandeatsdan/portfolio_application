function isMissing(value, numeric) {
  return value == null || (typeof value === 'string' && value.trim() === '') ||
    (numeric && !Number.isFinite(value))
}

export function compareTableValues(a, b, numeric = false, direction = 'ascending') {
  const aMissing = isMissing(a, numeric)
  const bMissing = isMissing(b, numeric)
  // Missing values stay last in either direction; equal values retain source order.
  if (aMissing || bMissing) return Number(aMissing) - Number(bMissing)

  const order = numeric
    ? a - b
    : String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
  return direction === 'descending' ? -order : order
}

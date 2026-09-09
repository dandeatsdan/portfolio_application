import { useEffect, useState } from 'react'
import { getReferenceMeasure } from '../api/client'
import { REFERENCE_PERIODS } from '../pages/referenceMeasures'

export function useReferenceMeasures(references) {
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setResult(null)
    Promise.all(references.map(ref => getReferenceMeasure(ref.metric,
      REFERENCE_PERIODS.find(period => period.value === ref.period))))
      .then(rows => {
        if (active) setResult({ references, values: rows.map(group => new Map(group.map(row => [row.id, row.value]))) })
      })
      .catch(error => { if (active) setResult({ references, error: error.message }) })
    return () => { active = false }
  }, [references, retry])
  // Never show previous values under newly selected headings, even before the effect runs.
  const current = result?.references === references ? result : null
  return { values: current?.values, loading: !current, error: current?.error, retry: () => setRetry(n => n + 1) }
}

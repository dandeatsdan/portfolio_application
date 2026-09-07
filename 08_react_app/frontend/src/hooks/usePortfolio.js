/**
 * Loads portfolio reference data (cases, metrics, KPIs) on mount.
 * Shared across Portfolio Viewer and Build a Scenario pages.
 */
import { useState, useEffect } from 'react'
import { getCases, getMetrics, getPortfolioKpis } from '../api/client'

export function usePortfolio() {
  const [cases,   setCases]   = useState([])
  const [metrics, setMetrics] = useState([])
  const [kpis,    setKpis]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getCases(), getMetrics(), getPortfolioKpis()])
      .then(([c, m, k]) => {
        setCases(c)
        setMetrics(m)
        setKpis(k)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { cases, metrics, kpis, loading, error }
}

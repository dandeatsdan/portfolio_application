import { useState, useContext, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { getWaterfall, getScenarioValuation } from '../api/client'
import KpiCard from '../components/KpiCard'
import ChartPanel from '../components/ChartPanel'
import JourneyStrip from '../components/JourneyStrip'
import { ScenarioResultContext } from '../App'
import theme from '../theme'

const PALETTE = theme.chartPalette

function fmt(v, dp = 0) {
  if (v == null || isNaN(v)) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: dp })
}

function sumMetricYears(rows, metric, years) {
  return rows
    .filter(r => r.metric === metric && (!years || years.includes(r.year)))
    .reduce((s, r) => s + (r.value ?? 0), 0)
}

export default function ScenarioResults() {
  const { scenarioResult, lastRunError } = useContext(ScenarioResultContext)

  const [wfMetric, setWfMetric]   = useState('Post-Tax Cash Flow')
  const [valuation, setValuation] = useState(null)
  const [valuationError, setValuationError] = useState(null)
  const [wfData,   setWfData]     = useState([])
  const [yearMin,  setYearMin]    = useState(2026)
  const [yearMax,  setYearMax]    = useState(2040)

  const years = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i)

  useEffect(() => {
    if (!scenarioResult) return
    getWaterfall({
      baseline: scenarioResult.baseline,
      scenario: scenarioResult.results,
      metric:   wfMetric,
      years:    years,
    }).then(setWfData).catch(() => setWfData([]))
  }, [scenarioResult, wfMetric, yearMin, yearMax]) // eslint-disable-line

  useEffect(() => {
    if (!scenarioResult) return
    let active = true
    setValuation(null)
    setValuationError(null)
    getScenarioValuation({ baseline: scenarioResult.baseline, scenario: scenarioResult.results,
      year_from: yearMin, year_to: yearMax, discount_rate: scenarioResult.valuation?.discount_rate ?? 8,
    }).then(data => { if (active) setValuation(data) })
      .catch(err => { if (active) setValuationError(err.message) })
    return () => { active = false }
  }, [scenarioResult, yearMin, yearMax])

  if (!scenarioResult) {
    return (
      <div>
        <JourneyStrip current="results" />
        <p>No results yet — run a scenario on <strong>Build a Scenario</strong> first.</p>
      </div>
    )
  }

  const { results, baseline, scenario_name, errors } = scenarioResult

  // KPI deltas
  const bProd  = sumMetricYears(baseline, 'Total Production (mboed)', years) * 0.36525
  const sProd  = sumMetricYears(results,  'Total Production (mboed)', years) * 0.36525
  const bFcf   = sumMetricYears(baseline, 'Post-Tax Cash Flow', years)
  const sFcf   = sumMetricYears(results,  'Post-Tax Cash Flow', years)
  const bGm    = sumMetricYears(baseline, 'Post-Tax RCOP', years)
  const sGm    = sumMetricYears(results,  'Post-Tax RCOP', years)

  // Stacked area data
  function makeStackedData(rows, metric) {
    const byYear = {}
    rows.filter(r => r.metric === metric && years.includes(r.year)).forEach(r => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year }
      byYear[r.year][r.case] = (byYear[r.year][r.case] ?? 0) + r.value
    })
    return Object.values(byYear).sort((a, b) => a.year - b.year)
  }

  const caseNames = [...new Set([...baseline, ...results].map(r => r.case))]
  const bStackProd = makeStackedData(baseline, 'Total Production (mboed)')
  const sStackProd = makeStackedData(results,  'Total Production (mboed)')

  const allMetrics = [...new Set(results.map(r => r.metric))]

  return (
    <div>
      <JourneyStrip current="results" />
      <h2 style={{ marginBottom: '0.25rem' }}>Scenario Results</h2>
      {lastRunError && <p role="alert" style={{ color: 'var(--color-negative)' }}>The latest attempt failed. These are the previous successful run's results. {lastRunError}</p>}
      <p className="text-small text-muted" style={{ marginBottom: '1.25rem' }}>
        Comparing <strong>{scenario_name}</strong> against the full reference portfolio. Financial defaults are post-tax.
      </p>

      {/* Year range filter */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', flexWrap: 'wrap', fontSize: 13 }}>
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Year range</span>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          From <input type="number" value={yearMin} min={2026} max={yearMax} onChange={e => setYearMin(+e.target.value)} style={{ width: 70, padding: '3px 5px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13 }} />
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          To <input type="number" value={yearMax} min={yearMin} max={2040} onChange={e => setYearMax(+e.target.value)} style={{ width: 70, padding: '3px 5px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13 }} />
        </label>
        {errors?.length > 0 && <span style={{ color: 'var(--color-negative)' }}>{errors.length} error(s) in run</span>}
      </div>

      {/* KPI outcome tiles */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <KpiCard title="Cumulative Production — Scenario" value={fmt(sProd)} unit="mmboe" delta={sProd - bProd} deltaPct={bProd ? (sProd - bProd) / bProd * 100 : null} help={`Reference: ${fmt(bProd)}`} />
        <KpiCard title="Post-Tax FCF — Scenario" value={fmt(sFcf)} unit="$m" delta={sFcf - bFcf} deltaPct={bFcf ? (sFcf - bFcf) / bFcf * 100 : null} help={`Reference: ${fmt(bFcf)}`} />
        <KpiCard title="Post-Tax RCOP — Scenario" value={fmt(sGm)} unit="$m" delta={sGm - bGm} deltaPct={bGm ? (sGm - bGm) / bGm * 100 : null} help={`Reference: ${fmt(bGm)}`} />
        <KpiCard title={`Post-Tax NPV @ ${scenarioResult.valuation?.discount_rate ?? 8}%`} value={fmt(valuation?.scenario)} unit="$m" delta={valuation?.delta} help={`Reference: ${fmt(valuation?.baseline)}; fixed 2026 base, period 1.`} />
      </div>
      {valuationError && <p role="alert">NPV unavailable: {valuationError}</p>}
      {scenarioResult.diagnostics?.length > 0 && <details><summary>Calculation warnings ({scenarioResult.diagnostics.length})</summary>
        <ul>{scenarioResult.diagnostics.map((d, i) => <li key={i}>Case {d.ID}, {d.Year}: {d.message ?? d.Message}</li>)}</ul>
      </details>}

      {/* Side-by-side Production charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <ChartPanel title="Reference — Production">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={bStackProd}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {caseNames.map((name, i) => (
                <Area key={name} type="monotone" dataKey={name} stackId="1"
                  stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Scenario — Production">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={sStackProd}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {caseNames.map((name, i) => (
                <Area key={name} type="monotone" dataKey={name} stackId="1"
                  stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.7} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      {/* Waterfall */}
      <ChartPanel title={`Impact Waterfall — ${wfMetric}`} style={{ marginBottom: '1.25rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <select value={wfMetric} onChange={e => setWfMetric(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 4 }}>
            {allMetrics.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        {wfData.length > 0 && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={wfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => fmt(v, 1)} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {wfData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.type === 'absolute' ? PALETTE[0]
                    : entry.value >= 0 ? theme.positive
                    : theme.negative
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartPanel>

      {/* Applied changes */}
      <ChartPanel title="Applied Changes" style={{ marginBottom: '1.25rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {['Case', 'Operation', 'Param1', 'Param2', 'Param3', 'Param4', 'Param5'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid var(--color-border-strong)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(scenarioResult.instructions ?? []).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>{r.case}</td>
                  <td style={{ padding: '6px 10px' }}>{r.operation}</td>
                  {[1, 2, 3, 4, 5].map(i => <td key={i} style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{fmt(r[`param${i}`], 4)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartPanel>
    </div>
  )
}

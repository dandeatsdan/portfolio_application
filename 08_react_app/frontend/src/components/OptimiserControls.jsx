import { CONTROL_LABELS, countryRuleKey, dimensionValue, effectiveCaseRule } from '../pages/optimiserHelpers'

function RuleSelect({ label, value, inherited, onChange, individual = false }) {
  return <label className="optimiser-control-choice">{label}
    <select value={value ?? 'inherit'} onChange={e => onChange(e.target.value)}>
      {inherited && <option value="inherit">Inherit — {CONTROL_LABELS[inherited]}</option>}
      <option value="optional">Optimiser chooses</option>
      <option value="mandatory">{individual ? 'Include' : 'Include all'}</option>
      <option value="excluded">{individual ? 'Exclude' : 'Exclude all'}</option>
    </select>
  </label>
}

function Counts({ cases, draft }) {
  const states = cases.map(c => effectiveCaseRule(draft, c))
  return <small className="text-muted">Effective: {states.filter(s => s === 'mandatory').length} included ·{' '}
    {states.filter(s => s === 'excluded').length} excluded ·{' '}
    {states.filter(s => s === 'optional').length} optimiser chooses</small>
}

export default function OptimiserControls({ cases, draft, onChange }) {
  const regions = [...new Set(cases.map(c => dimensionValue(c.region)))].sort()
  function edit(field, key, rule) {
    const rules = { ...draft[field] }
    if (rule === 'inherit') delete rules[key]
    else rules[key] = rule
    onChange({ [field]: rules })
  }
  return <div className="optimiser-control-tree">
    {regions.map(region => {
      const regionCases = cases.filter(c => dimensionValue(c.region) === region)
      const countries = [...new Set(regionCases.map(c => dimensionValue(c.country)))].sort()
      const regionRule = draft.region_rules[region] ?? 'optional'
      return <div key={region} className="optimiser-control-region">
        <div className="optimiser-control-row">
          <div><strong>{region}</strong><Counts cases={regionCases} draft={draft} /></div>
          <RuleSelect label={`Region: ${region}`} value={regionRule} onChange={rule => edit('region_rules', region, rule)} />
        </div>
        <details>
          <summary>Countries and cases ({countries.length} countries · {regionCases.length} cases)</summary>
          {countries.map(country => {
            const key = countryRuleKey(region, country)
            const countryCases = regionCases.filter(c => dimensionValue(c.country) === country)
            const countryRule = draft.country_rules[key] ?? regionRule
            return <div key={key} className="optimiser-control-country">
              <div className="optimiser-control-row">
                <div><strong>{country}</strong><Counts cases={countryCases} draft={draft} /></div>
                <RuleSelect label={`Country: ${country} (${region})`} value={draft.country_rules[key]} inherited={regionRule}
                  onChange={rule => edit('country_rules', key, rule)} />
              </div>
              <details>
                <summary>Cases ({countryCases.length})</summary>
                {countryCases.map(c => <div className="optimiser-control-row optimiser-control-case" key={c.id}>
                  <div>{c.case_name}<small className="text-muted">ID {c.id} · {CONTROL_LABELS[effectiveCaseRule(draft, c)]}</small></div>
                  <RuleSelect individual label={`Case: ${c.case_name} (ID ${c.id})`} value={draft.case_rules[c.id]} inherited={countryRule}
                    onChange={rule => edit('case_rules', c.id, rule)} />
                </div>)}
              </details>
            </div>
          })}
        </details>
      </div>
    })}
  </div>
}

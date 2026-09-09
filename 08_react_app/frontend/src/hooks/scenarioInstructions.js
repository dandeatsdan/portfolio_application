const OPERATION_MAP = {
  'No Change':           'NoChange',
  'Delay':               'Delay',
  'Accelerate':          'Accelerate',
  'Farm In (Increase)':  'Increase',
  'Farm Down (Dilution)':'Dilution',
  'Truncate Before':     'TruncateBefore',
  'Truncate After':      'TruncateAfter',
  'Production Change %': 'ProdnAdj',
  'OPEX Change %':       'CostAdjOpex',
  'CAPEX Change %':      'CostAdjCapex',
  'CAPEX Change $m':     'CapexAbsolute',
  'OPEX Change $m':      'OpexAbsolute',
}

export const OPERATION_LABELS = Object.keys(OPERATION_MAP)

export function defaultCase() {
  return { include: true, operation: 'No Change', params: [0, 0, 0, 0, 0] }
}

// Every loaded case participates by default. Only shortlisted cases can carry
// overrides; stale settings on available cases must never change the run.
export function buildScenarioInstructions(cases, shortlistIds, caseConfig) {
  return cases.map(c => {
    const config = shortlistIds.has(c.id) ? (caseConfig[c.id] ?? defaultCase()) : defaultCase()
    const operation = OPERATION_MAP[config.operation] ?? 'NoChange'
    const params = operation === 'NoChange' ? [] : config.params
    return {
      id: c.id,
      case: c.case,
      include: config.include,
      operation,
      param1: params[0] ?? 0,
      param2: params[1] ?? 0,
      param3: params[2] ?? 0,
      param4: params[3] ?? 0,
      param5: params[4] ?? 0,
    }
  })
}

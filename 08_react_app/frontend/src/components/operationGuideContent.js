// Help content adapted from application_user_guide.pdf, pages 9–16, and checked
// against 005_operations_library.csv and the shared engine/operations.py.
// The CSV defines parameter positions, requiredness and fractional percentage
// inputs. Unlike the PDF's page 13 wording, both the Excel and shared Python
// implementations record farm-in payments in Cash Capex, not sale proceeds.
// Cost examples below use the application's negative cash-outflow convention.
// This module describes operations; it does not configure or execute them.

export const OPERATION_GUIDE_CATEGORIES = [
  {
    id: 'default',
    title: 'Default',
    subtitle: 'Keep the reference profile',
    operations: [
      {
        name: 'No Change',
        description: 'Keeps an included case at its reference profile without any adjustments.',
        inputs: [],
        example: 'Keep a case on the shortlist for visibility while retaining its reference assumptions.',
      },
    ],
  },
  {
    id: 'timing',
    title: 'Timing',
    subtitle: 'Change when it happens',
    operations: [
      {
        name: 'Delay',
        description: 'Moves the case profile later by a whole number of years. An optional cash-cost penalty can be added in a specified year.',
        inputs: [
          { position: 1, label: 'Years to delay (whole number)', required: true },
          { position: 2, label: 'Delay penalty ($m)', required: false },
          { position: 3, label: 'Penalty year', required: false },
        ],
        example: 'Enter 2 to move a 2028 profile value to 2030. Optionally enter a penalty of 5 ($m) and a penalty year of 2027.',
        notes: 'Use zero or a positive whole number of years. Values shifted beyond 2040 are removed. To apply a penalty, provide both its amount and a year within 2026–2040.',
      },
      {
        name: 'Accelerate',
        description: 'Moves the case profile earlier by a whole number of years. Optional additional funding can be added as Cash Capex in a specified year.',
        inputs: [
          { position: 1, label: 'Years to accelerate (whole number)', required: true },
          { position: 2, label: 'Funding required ($m)', required: false },
          { position: 3, label: 'Funding year', required: false },
        ],
        example: 'Enter 1 to move a 2028 profile value to 2027. Optionally enter funding of 10 ($m) and a funding year of 2026.',
        notes: 'Use zero or a positive whole number of years. Values shifted before 2026 are removed. To apply additional funding, provide both its amount and a year within 2026–2040.',
      },
      {
        name: 'Truncate Before',
        description: 'Removes all profile values before the selected year, retaining that year and everything after it.',
        inputs: [
          { position: 1, label: 'Retain profile from year', required: true },
        ],
        example: 'Enter 2030 to retain the profile from 2030 onwards and remove earlier years.',
      },
      {
        name: 'Truncate After',
        description: 'Removes all profile values after the selected year, retaining that year and everything before it.',
        inputs: [
          { position: 1, label: 'Retain profile until year', required: true },
        ],
        example: 'Enter 2030 to retain the profile up to and including 2030 and remove later years.',
      },
    ],
  },
  {
    id: 'scale',
    title: 'Scale',
    subtitle: 'Change how much of the case is represented',
    operations: [
      {
        name: 'Farm In (Increase)',
        description: 'Increases the case profile in the selected years to represent a larger interest. An optional acquisition payment can be added.',
        inputs: [
          { position: 1, label: 'Increase % (as fraction)', required: true },
          { position: 2, label: 'Effective start year', required: false },
          { position: 3, label: 'Effective end year', required: false },
          { position: 4, label: 'Acquisition payment ($m)', required: false },
          { position: 5, label: 'Payment year', required: false },
        ],
        example: 'Enter 0.10 for a 10% increase: a profile value of 100 becomes 110. An acquisition payment of 20 ($m) in 2028 adds a cash outflow in that year.',
        notes: 'The increase is relative to the existing profile. Use a non-negative fraction. Optional year bounds include both start and end years; omitted bounds (or 0) use the first and last profile years. A payment needs both its amount and a year within 2026–2040.',
      },
      {
        name: 'Farm Down (Dilution)',
        description: 'Reduces the case profile in the selected years to represent a smaller interest. Optional disposal proceeds can be added.',
        inputs: [
          { position: 1, label: 'Dilution % (as fraction)', required: true },
          { position: 2, label: 'Effective start year', required: false },
          { position: 3, label: 'Effective end year', required: false },
          { position: 4, label: 'Disposal proceeds ($m)', required: false },
          { position: 5, label: 'Proceeds year', required: false },
        ],
        example: 'Enter 0.25 for a 25% reduction: a profile value of 100 becomes 75. Disposal proceeds of 20 ($m) in 2028 add a cash inflow in that year.',
        notes: 'Use a fraction from 0 to 1; 1 removes the profile in the selected years. Optional year bounds include both start and end years; omitted bounds (or 0) use the first and last profile years. Proceeds need both their amount and a year within 2026–2040.',
      },
    ],
  },
  {
    id: 'input-metric',
    title: 'Input metric',
    subtitle: 'Adjust production or costs',
    operations: [
      {
        name: 'Production Change %',
        description: 'Adjusts production and production-sensitive financial drivers by a proportion in the selected years, with the resulting changes carried through to related financial measures.',
        inputs: [
          { position: 1, label: '% change (as fraction)', required: true },
          { position: 2, label: 'Start year', required: false },
          { position: 3, label: 'End year', required: false },
        ],
        example: 'Enter 0.10 to increase production by 10%, or -0.10 to reduce it by 10%. Enter 2028 and 2030 to apply the change in those years, inclusive.',
        notes: 'A reduction cannot exceed 100% (-1). Omitted year bounds (or 0) use 2026 and 2040. Financial measures containing fixed or unaffected items will not necessarily change by the same percentage.',
      },
      {
        name: 'OPEX Change %',
        description: 'Adjusts Total Cash Costs proportionally in the selected years and carries the cost difference through to related financial measures.',
        inputs: [
          { position: 1, label: '% change (as fraction)', required: true },
          { position: 2, label: 'Start year', required: false },
          { position: 3, label: 'End year', required: false },
        ],
        example: 'Enter 0.10 for 10% higher costs, or -0.10 for 10% lower costs. A reference cash cost of -100 ($m) becomes -110 ($m) with a 10% increase.',
        notes: 'A reduction cannot exceed 100% (-1). Optional start and end years are inclusive; omitted bounds (or 0) use 2026 and 2040.',
      },
      {
        name: 'CAPEX Change %',
        description: 'Adjusts Cash Capex proportionally in the selected years and carries the difference through to cash flow.',
        inputs: [
          { position: 1, label: '% change (as fraction)', required: true },
          { position: 2, label: 'Start year', required: false },
          { position: 3, label: 'End year', required: false },
        ],
        example: 'Enter 0.10 for 10% higher Capex, or -0.10 for 10% lower Capex. A reference Cash Capex of -100 ($m) becomes -110 ($m) with a 10% increase.',
        notes: 'A reduction cannot exceed 100% (-1). Optional start and end years are inclusive; omitted bounds (or 0) use 2026 and 2040.',
      },
      {
        name: 'CAPEX Change $m',
        description: 'Adds or reduces Cash Capex by a specified dollar amount in one or two years, with the same change carried through to cash flow.',
        inputs: [
          { position: 1, label: 'Change in year 1 (± $m)', required: true },
          { position: 2, label: 'Year 1', required: true },
          { position: 3, label: 'Change in year 2 (± $m)', required: false },
          { position: 4, label: 'Year 2', required: false },
        ],
        example: 'Enter 15 and 2027 to add 15 ($m) of Capex in 2027: a reference value of -120 becomes -135 ($m). Enter -10 and 2028 for an optional 10 ($m) reduction in 2028.',
        notes: 'Positive inputs add spending; negative inputs reduce it. Provide a non-zero amount and a year together for each adjustment. Years must be within 2026–2040 and present in the case profile.',
      },
      {
        name: 'OPEX Change $m',
        description: 'Adds or reduces Total Cash Costs by a specified dollar amount in one or two years, with the difference carried through to related financial measures.',
        inputs: [
          { position: 1, label: 'Change in year 1 (± $m)', required: true },
          { position: 2, label: 'Year 1', required: true },
          { position: 3, label: 'Change in year 2 (± $m)', required: false },
          { position: 4, label: 'Year 2', required: false },
        ],
        example: 'Enter -10 and 2027 to reduce costs by 10 ($m) in 2027: a reference cash cost of -100 becomes -90 ($m). Enter 5 and 2028 for an optional 5 ($m) cost addition in 2028.',
        notes: 'Positive inputs add costs; negative inputs reduce them. Provide a non-zero amount and a year together for each adjustment. Years must be within 2026–2040 and present in the case profile.',
      },
    ],
  },
]

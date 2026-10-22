# ========================================================================
# OPERATION INPUT VALIDATION — ERRORS THAT BLOCK, WARNINGS THAT INFORM
# ========================================================================
#
# Purpose
# -------
# Check React scenario instructions before the shared engine runs. The same
# rules also help validate saved definitions. OPERATION_MAP connects labels
# such as Farm Down (Dilution) to internal keys such as Dilution.
# The validation matrix Markdown explains the agreed business decisions;
# this Python function is one place where those decisions are enforced.
#
# How to read validate_operations
# -------------------------------
# Excluded instructions are skipped. Included instructions are checked for
# recognised operations, required fields, unused slots, profile existence
# and the operation-specific ranges below. The function returns two lists:
# errors block the action; warnings explain an allowed consequence.
# Each message includes case/operation context and, when relevant, a
# parameter position or booking year for the frontend to associate it with.
#
# Rules grouped by operation family
# --------------------------------
# - Timing: zero or positive whole years; optional positive cost/year pair.
# - Farm-in/down: nonnegative fractions; farm-down is capped at 1 (100%).
#   Optional window bounds and a positive transaction amount/year pair.
# - Percentage adjustments: fractions no lower than -1 (-100%), with no
#   positive upper cap. Optional start/end years must be in order.
# - Truncation: a whole cutoff year within the modelling horizon.
# - Absolute OPEX/CAPEX: a required nonzero signed amount and valid year,
#   plus an optional second amount/year pair. Both amount signs are allowed.
# An optional unused pair is represented by zero amount AND zero year.
# A default year of zero is only valid in slots that explicitly allow it.
#
# Examples of warnings, not errors
# --------------------------------
# A delay can shift some or all years outside the horizon; truncation can
# remove an entire profile. Those consequences are allowed and explained.
# An absolute adjustment can also turn a cost into a positive inflow. When
# checking that warning, bookings in the same year are combined first.
# Warnings are evaluated after the instruction passes its field checks.
#
# Validation layers
# -----------------
# Pydantic request models handle types and finite numeric values before
# this function. scenario_service performs additional structural checks,
# and individual operations retain their defensive checks. No profile
# values are changed here and no scenario is executed.
# For the actual cash effects, follow engine/operations.py. For the visible
# messages and request handling, follow routers/scenario.py.

"""React input checks and warnings; shared analytical operations stay unchanged."""
from scenario_modeller.data.schemas import YEAR_MIN, YEAR_MAX

OPERATION_MAP = dict(zip(
    ['No Change', 'Delay', 'Accelerate', 'Farm In (Increase)', 'Farm Down (Dilution)',
     'Truncate Before', 'Truncate After', 'Production Change %', 'OPEX Change %',
     'CAPEX Change %', 'CAPEX Change $m', 'OPEX Change $m'],
    ['NoChange', 'Delay', 'Accelerate', 'Increase', 'Dilution', 'TruncateBefore',
     'TruncateAfter', 'ProdnAdj', 'CostAdjOpex', 'CostAdjCapex', 'CapexAbsolute', 'OpexAbsolute']))
TIMING = {'Delay', 'Accelerate'}
SCALE = {'Increase', 'Dilution'}
PERCENT = {'ProdnAdj', 'CostAdjOpex', 'CostAdjCapex'}
ABSOLUTE = {'CapexAbsolute', 'OpexAbsolute'}


def validate_operations(instructions, profiles):
    errors, warnings = [], []
    for inst in instructions:
        if not inst.include:
            continue
        op = OPERATION_MAP.get(inst.operation, inst.operation)
        p = [getattr(inst, f'param{i}') for i in range(1, 6)]
        start_errors = len(errors)

        def error(position, message):
            errors.append({'severity': 'error', 'ID': inst.id, 'operation': op,
                           'parameter': position, 'message': message})

        def warn(message, year=None):
            warnings.append({'severity': 'warning', 'ID': inst.id, 'Year': year,
                             'operation': op, 'message': message})

        def year(position, optional=False):
            value = p[position - 1]
            if optional and value == 0:
                return
            if not float(value).is_integer() or not YEAR_MIN <= value <= YEAR_MAX:
                error(position, f'Enter a whole year from {YEAR_MIN} to {YEAR_MAX}.')

        def pair(amount, booking, required=False, positive=False):
            a, y = p[amount - 1], p[booking - 1]
            if not required and a == 0 and y == 0:
                return
            if a == 0 or (positive and a < 0):
                error(amount, 'Enter a positive amount.' if positive else 'Enter a non-zero amount.')
            year(booking)

        if op not in OPERATION_MAP.values():
            error(None, 'Select a recognised operation.')
            continue
        if op == 'NoChange':
            continue
        required = [1, 2] if op in ABSOLUTE else [1]
        for pos in required:
            if f'param{pos}' not in inst.model_fields_set:
                error(pos, 'Enter a value.')
        used = 5 if op in SCALE else 4 if op in ABSOLUTE else 1 if op.startswith('Truncate') else 3
        for pos in range(used + 1, 6):
            if p[pos - 1] != 0:
                error(pos, 'This parameter is unused; enter zero.')
        subset = profiles.loc[profiles.ID == inst.id]
        if subset.empty:
            error(None, 'No profile found for this case.')
            continue
        if op in TIMING:
            if p[0] < 0 or not float(p[0]).is_integer():
                error(1, 'Enter zero or a positive whole number of years.')
            pair(2, 3, positive=True)
        if op in SCALE | PERCENT:
            lower = 0 if op in SCALE else -1
            if p[0] < lower or (op == 'Dilution' and p[0] > 1):
                error(1, 'Enter a fraction from 0 to 1.' if op == 'Dilution' else
                      'Enter zero or a positive fraction.' if op == 'Increase' else
                      'A reduction cannot exceed 100% (-1).')
            year(2, optional=True)
            year(3, optional=True)
            start = p[1] or (subset.Year.min() if op in SCALE else YEAR_MIN)
            end = p[2] or (subset.Year.max() if op in SCALE else YEAR_MAX)
            if start > end:
                error(3, 'End year must be on or after start year, including default bounds.')
            if op in SCALE:
                pair(4, 5, positive=True)
        if op.startswith('Truncate'):
            year(1)
        if op in ABSOLUTE:
            pair(1, 2, required=True)
            pair(3, 4)
        if len(errors) != start_errors:
            continue
        if op in TIMING:
            # Compare before adding the shift, avoiding integer overflow for large shifts.
            clipped = subset.Year > YEAR_MAX - p[0] if op == 'Delay' else subset.Year < YEAR_MIN + p[0]
            if clipped.any():
                warn(f'{"All" if clipped.all() else "Some"} profile years move outside {YEAR_MIN}–{YEAR_MAX} and will be removed.')
        if op.startswith('Truncate'):
            retained = subset.Year >= p[0] if op == 'TruncateBefore' else subset.Year <= p[0]
            if not retained.any():
                warn('This cutoff removes the entire case profile.')
        if op in ABSOLUTE:
            metric = 'Cash Capex' if op == 'CapexAbsolute' else 'Total Cash Costs'
            for booking in {p[1], p[3]} - {0}:
                adjustment = sum(p[a] for a, y in [(0, 1), (2, 3)] if p[y] == booking)
                rows = subset.loc[(subset.Metric == metric) & (subset.Year == booking), 'Value']
                if len(rows) == 1 and rows.iloc[0] <= 0 and rows.iloc[0] - adjustment > 0:
                    warn(f'The combined adjustment turns {metric} into a positive inflow.', int(booking))
    return errors, warnings

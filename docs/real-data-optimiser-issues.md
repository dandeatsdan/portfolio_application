# Real Data — Optimiser Issues

**Date investigated:** 2026-09-16  
**Context:** Switched from 12-case sample data (`07_streamlit_app/data/sample/`) to 153-case real data (`data/real/`).

---

## Issue 1 — "Production values must be nonnegative; review the source data"

**Where it fires:** `07_streamlit_app/src/scenario_modeller/services/optimisation_service.py`, line 455

**What triggers it:** During constraint coefficient preparation, the optimiser sums `Total Production (mboed)` per case over the selected constraint year window. If any case's net sum is below −1e-8, the run is blocked entirely.

**Why it happens with real data:** Some cases are equity-accounted or contain non-revenue production sub-metrics. Their net total production over a selected window can sum to a negative number. This does not happen in the 12-case sample, but does in the 153-case real portfolio.

**Relevant code:**
```python
# optimisation_service.py ~line 455
if metric == 'production' and any(v < -1e-8 for v in result.values()):
    raise ValueError('Production values must be nonnegative; review the source data')
```

**Options to fix:**
1. **Clip to zero** — replace `result[i]` with `max(result[i], 0)` before the check, treating negative-net cases as contributing zero production. Consistent with how Excel treats negative RCOP in the tax base (`max(Underlying RCOP, 0)`).
2. **Warn and exclude** — raise a warning listing the affected cases rather than blocking the entire run; exclude those cases from production constraints only.
3. **Filter metric** — sum only equity-share production rows, not all production sub-metrics. Requires confirming which metric key is correct for this purpose.

**Recommended next step:** identify which cases are triggering the error (log `{case_id: value}` pairs where `value < -1e-8`) before choosing a fix.

---

## Issue 2 — "Reference production is missing or invalid for a case"

**Where it fires:** `08_react_app/frontend/src/pages/optimiserHelpers.js`, line 103, inside `referenceMix()`

**What triggers it:** When the user opens the Advanced Controls pane and the Oil/Gas mix or Regional mix toggle is enabled, the frontend calculates reference shares by looking up each loaded case's reference production value. If any case has a value that is `undefined`, non-finite, or negative, the function throws this error.

**Why it happens with real data:** Same root cause as Issue 1 — negative net production for some cases in the objective period reaches the frontend as a negative number, failing the `value < 0` guard.

**Relevant code:**
```javascript
// optimiserHelpers.js ~line 103
const value = values.get(c.id) === null ? 0 : values.get(c.id)
if (!Number.isFinite(value) || value < 0) throw new Error('Reference production is missing or invalid for a case.')
```

Note: `null` from the API (no metric rows in period) is already handled as `0`. The problem is negative values, not missing ones.

**Fix:** Align with whatever approach is chosen for Issue 1. If the backend clips negative sums to zero, the frontend will receive `0` for those cases and the check will pass. If the backend excludes those cases, the frontend case list needs to be filtered consistently.

---

## Data comparison — sample vs real

| | Sample (`data/sample/`) | Real (`data/real/`) |
|---|---|---|
| Cases | 12 | 153 |
| Profile rows | 3,064 | 25,517 |
| Unique metrics | 28 | 30 |
| Production `[Value]` min | −627 | −1,237 |
| Production `[Value]` max | 875 | 2,194 |
| 5Y totals min | −4,735 | −22,440 |
| 5Y totals max | 19,360 | 89,080 |
| Tax rate rows | 150 | 840 |

Real data also has an extra column in `004_totals_avgs.csv` (`[Index]`) and uses `[Meta Data]` (with space) instead of `[Meta]` in the case listing — worth checking whether any loader column references break on that difference.

---

## Data discovery order

Defined in `08_react_app/backend/state.py` lines 62–65:

1. `<repo_root>/data/real/` — checked first (gitignored, never commit)
2. `<repo_root>/07_streamlit_app/data/sample/` — fallback

---

## Open questions before fixing

- Which cases have negative net production over the 2026–2030 window? Log and review before deciding whether to clip or exclude.
- Are those cases intentionally included in portfolio analysis, or are they artefacts of how source financial entities aggregate?
- Is the correct production metric for optimisation `Total Production (mboed)` or a more specific equity/net metric?
- Does the `[Meta Data]` vs `[Meta]` column name difference in `001_case_listing.csv` affect any active loader?

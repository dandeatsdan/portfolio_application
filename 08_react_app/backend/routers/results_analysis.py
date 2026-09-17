# ========================================================================
# RESULTS ANALYSIS API — FILTER CALCULATED RESULTS FOR THE SCREEN
# ========================================================================
#
# Purpose
# -------
# Build result cards, profiles, waterfalls and case-impact tables from
# baseline/scenario rows supplied by React, optionally with a comparison.
# This endpoint does not call the scenario operation engine. Changing a
# visual filter still makes an analysis request, but it does not repeat the
# scenario run or recalculate country/year tax on the whole portfolio.
#
# Request controls
# ----------------
# The request selects an analysis kind, metric, grouping, inclusive years,
# optional case IDs, total/average basis and discount rate. Missing case_ids
# means no ID restriction; an explicit empty list means no selected cases.
# The models check supported kinds and year order. NPV is supported for
# period-total impact analysis, not as an annual average profile metric.
#
# Four result shapes
# ------------------
# kpis: selected-period portfolio measures and their changes.
# profile: annual reference/scenario/comparison series across the range.
# waterfall: reference total, grouped changes and scenario total.
# impact: reference/scenario/delta values for individual case IDs.
# Most paths filter and group copies of supplied rows. The NPV impact path
# instead passes raw signed cash flows to valuation_service.npv_by_case.
#
# Presentation conventions
# ------------------------
# Ordinary reporting values use the metrics-helper inversion on copies.
# Cumulative production uses the 0.36525 conversion from summed annual
# mboed rates to mmboe; annual/average production retains daily-rate units.
# Headline financial values can be scaled from $m to $bn. Unit selection
# belongs to the result shape, so read the relevant helper before comparing
# an annual chart number with a cumulative card.
#
# Delta is Scenario minus Baseline. KPI percentage changes divide by the
# absolute baseline and are absent when the baseline is zero. This avoids
# claiming a percentage improvement from a zero starting value. It differs
# from the older signed-denominator helper in comparison_service.py.
#
# The reference case listing supplies grouping labels; these functions do
# not change the scenario's inclusion settings. Filtered-out rows remain
# part of the original run held by the caller.
# Read frame and unit first, then the requested analysis kind;
# read scenario.py for where the original annual results come from.

"""Display-facing Results analysis. Raw model values are never modified."""
from typing import Literal
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict, model_validator
from ..schemas import ProfileRow
from ..state import app_state
from ..utils.display import to_display
from scenario_modeller.services.comparison_service import build_waterfall
from scenario_modeller.services.valuation_service import npv_by_case

router = APIRouter(prefix='/api/scenario', tags=['Results'])
KPI_METRICS = ['Total Production (mboed)', 'Cash Capex', 'Post-Tax RCOP', 'Post-Tax Cash Flow']


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    baseline: list[ProfileRow]
    scenario: list[ProfileRow]
    comparison: list[ProfileRow] | None = None
    kind: Literal['kpis', 'profile', 'waterfall', 'impact', 'stacked']
    metric: str = 'Post-Tax Cash Flow'
    group_by: Literal['case_name', 'region', 'country', 'group_entity', 'plan_type'] = 'case_name'
    year_from: int = Field(default=2026, ge=2026, le=2040)
    year_to: int = Field(default=2040, ge=2026, le=2040)
    average: bool = False
    case_ids: list[int] | None = None
    discount_rate: float = Field(default=8, gt=-100)

    @model_validator(mode='after')
    def valid_period(self):
        if self.year_from > self.year_to:
            raise ValueError('Start year must not exceed end year')
        if self.metric == 'Post-tax NPV' and (self.average or self.kind not in ('impact', 'stacked')):
            raise ValueError('NPV is available only as a total case impact')
        return self


def frame(rows, ids):
    data = pd.DataFrame([{'ID': r.id, 'Metric': r.metric, 'Year': r.year, 'Value': r.value} for r in rows],
                        columns=['ID', 'Metric', 'Year', 'Value'])
    if ids is not None:
        data = data.loc[data.ID.isin(ids)]
    return to_display(data, app_state.invert_metrics)


def unit(metric, cumulative=False, headline=False):
    if metric == 'Total Production (mboed)':
        return ('mmboe', .36525) if cumulative else ('mboed', 1)
    if headline:
        return '$bn', .001
    if '(' in metric and metric.endswith(')'):
        return metric.rsplit('(', 1)[1][:-1], 1
    return '$m', 1


@router.post('/analysis')
def analysis(request: AnalysisRequest):
    if request.metric not in set(app_state.profiles.Metric) | {'Post-tax NPV'}:
        raise HTTPException(422, detail='Unsupported analysis metric')
    ids = request.case_ids
    b, s = frame(request.baseline, ids), frame(request.scenario, ids)
    years = list(range(request.year_from, request.year_to + 1))
    if request.kind == 'stacked':
        # Per-year per-series scenario totals + reference total line.
        dim_col = {'case_name': 'Case Name', 'region': 'Region', 'country': 'Country',
                   'group_entity': 'Group Entity', 'plan_type': 'Plan Type'}[request.group_by]
        id_to_dim = app_state.case_listing.set_index('ID')[dim_col].fillna('Unknown').replace('', 'Unknown')
        label, factor = unit(request.metric)[0], unit(request.metric)[1]
        b_rows = b.loc[b.Metric == request.metric].copy()
        s_rows = s.loc[s.Metric == request.metric].copy()
        b_rows = b_rows.loc[b_rows.Year.isin(years)]
        s_rows = s_rows.loc[s_rows.Year.isin(years)]
        b_rows['_dim'] = b_rows['ID'].map(id_to_dim).fillna('Unknown')
        s_rows['_dim'] = s_rows['ID'].map(id_to_dim).fillna('Unknown')
        ref_by_year = b_rows.groupby('Year').Value.sum() * factor
        stacked = s_rows.groupby(['Year', '_dim']).Value.sum() * factor
        series_keys = sorted(s_rows['_dim'].unique().tolist())
        rows_out = []
        for y in years:
            row = {'year': y, 'reference': float(ref_by_year.get(y, 0))}
            for sk in series_keys:
                row[sk] = float(stacked.get((y, sk), 0))
            rows_out.append(row)
        return {'unit': label, 'series': series_keys, 'rows': rows_out}
    def totals(data, metric):
        selected = data.loc[(data.Metric == metric) & data.Year.isin(years)]
        return selected.groupby('ID').Value.sum()
    if request.kind == 'kpis':
        output = []
        for metric in KPI_METRICS:
            label, factor = unit(metric, cumulative=True, headline=True)
            baseline, scenario = float(totals(b, metric).sum()) * factor, float(totals(s, metric).sum()) * factor
            delta = scenario - baseline
            output.append(dict(metric=metric, unit=label, baseline=baseline, scenario=scenario,
                               delta=delta, delta_pct=delta / abs(baseline) * 100 if abs(baseline) > 1e-9 else None))
        return output
    if request.kind == 'profile':
        series = {'reference': b, 'primary': s}
        if request.comparison is not None:
            series['comparison'] = frame(request.comparison, ids)
        values = {key: data.loc[data.Metric == request.metric].groupby('Year').Value.sum() for key, data in series.items()}
        return {'unit': unit(request.metric)[0], 'rows': [dict(year=y, **{key: float(v.get(y, 0)) for key, v in values.items()}) for y in years]}
    if request.kind == 'waterfall':
        steps = build_waterfall(b, s, app_state.case_listing, request.metric, years, request.group_by)
        label, factor = unit(request.metric, cumulative=True)
        steps['Value'] *= factor
        return {'unit': label, 'rows': steps.rename(columns={'Label': 'label', 'Value': 'value', 'Type': 'type'}).to_dict('records')}
    if request.metric == 'Post-tax NPV':
        # NPV uses raw cash flows and the shared fixed-origin valuation service.
        def npv(rows):
            data = pd.DataFrame([r.model_dump() for r in rows], columns=['id', 'metric', 'year', 'value']).rename(columns={'id': 'ID', 'metric': 'Metric', 'year': 'Year', 'value': 'Value'})
            if ids is not None: data = data.loc[data.ID.isin(ids)]
            return npv_by_case(data, request.discount_rate, request.year_from, request.year_to).set_index('ID').NPV
        try:
            bv, sv = npv(request.baseline), npv(request.scenario)
        except ValueError as exc:
            raise HTTPException(422, detail=str(exc))
        label, factor = '$m', 1
    else:
        bv, sv = totals(b, request.metric), totals(s, request.metric)
        label, factor = unit(request.metric, cumulative=not request.average and len(years) > 1)
        if request.average: factor /= len(years)
    keys = sorted(set(bv.index) | set(sv.index))
    return {'unit': label, 'rows': [dict(id=int(i), baseline=float(bv.get(i, 0)) * factor,
        scenario=float(sv.get(i, 0)) * factor, delta=float(sv.get(i, 0) - bv.get(i, 0)) * factor) for i in keys]}

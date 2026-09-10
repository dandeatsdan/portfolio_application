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
    kind: Literal['kpis', 'profile', 'waterfall', 'impact']
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
        if self.metric == 'Post-tax NPV' and (self.average or self.kind != 'impact'):
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

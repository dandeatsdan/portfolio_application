"""Agreed input rules at both preflight and execution boundaries."""
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.schemas import ScenarioInstruction
from backend.operation_validation import validate_operations


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as c:
        yield c


def request(client, op, params):
    cases = client.get('/api/cases').json()
    instructions = [dict(id=c['id'], case=c['case'], include=True, operation='NoChange') for c in cases]
    instructions[0].update(operation=op, **{f'param{i+1}': v for i, v in enumerate(params)})
    return {'instructions': instructions}


@pytest.mark.parametrize('op,params,position', [
    ('Delay', [], 1), ('Delay', [-1], 1), ('Delay', [1.5], 1),
    ('Delay', [1, -5, 2028], 2), ('Accelerate', [1, 5, 235], 3),
    ('Increase', [.1, 235, 2030], 2), ('Dilution', [1.1], 1),
    ('Increase', [.1, 0, 0, -5, 2028], 4), ('Dilution', [.1, 0, 0, 5], 5),
    ('TruncateBefore', [235], 1), ('TruncateAfter', [2028.5], 1),
    ('ProdnAdj', [-1.01], 1), ('CostAdjOpex', [.1, 2041], 2),
    ('CostAdjCapex', [.1, 2030, 2028], 3),
    ('CapexAbsolute', [0, 0, 5, 2028], 1), ('OpexAbsolute', [5, 2028.5], 2),
    ('OpexAbsolute', [5, 2028, 1], 4), ('Delay', [1, 0, 0, 5], 4),
])
def test_rejects_invalid_inputs_before_execution(client, op, params, position):
    body = request(client, op, params)
    preview = client.post('/api/scenario/validate', json=body)
    assert preview.status_code == 200
    assert not preview.json()['valid']
    assert any(e['parameter'] == position for e in preview.json()['errors'])
    result = client.post('/api/scenario/run', json=body)
    assert result.status_code == 422
    assert result.json()['detail']['diagnostics']


@pytest.mark.parametrize('op,params', [
    ('Delay', [0]), ('Accelerate', [0]), ('Increase', [10]), ('Dilution', [1]),
    ('ProdnAdj', [-1]), ('CostAdjOpex', [10]), ('CostAdjCapex', [0]),
    ('TruncateBefore', [2026]), ('TruncateAfter', [2040]),
    ('CapexAbsolute', [20, 2028, -5, 2028]), ('OpexAbsolute', [20, 2030, -5, 2028]),
])
def test_valid_boundaries(client, op, params):
    assert client.post('/api/scenario/validate', json=request(client, op, params)).json()['valid']


def test_unknown_key_and_nonfinite_api(client):
    assert client.post('/api/scenario/run', json=request(client, 'Typo', [])).status_code == 422
    assert client.post('/api/scenario/run', json=request(client, 'Delay', ['Infinity'])).status_code == 422


def check(op, params):
    profiles = pd.DataFrame([{'ID': 1, 'Year': y, 'Metric': 'Cash Capex', 'Value': -100.}
                             for y in [2028, 2029, 2030]])
    inst = ScenarioInstruction(id=1, case='Example', include=True, operation=op,
                               **{f'param{i+1}': v for i, v in enumerate(params)})
    return validate_operations([inst], profiles)


def test_default_bounds_and_warning_semantics():
    assert check('Increase', [.1, 0, 2027])[0]
    for op, params in [('Delay', [12]), ('Accelerate', [235]),
                       ('TruncateBefore', [2031]), ('TruncateAfter', [2027])]:
        errors, warnings = check(op, params)
        assert not errors and warnings
    assert not check('Delay', [0])[1]
    # Assess the combined annual effect, not each input independently.
    assert not check('CapexAbsolute', [-150, 2028, 100, 2028])[1]
    assert check('CapexAbsolute', [-75, 2028, -50, 2028])[1]
    assert not check('CapexAbsolute', [-100, 2028])[1]


def test_clipping_warning_is_published_on_success(client):
    body = request(client, 'Delay', [235])
    result = client.post('/api/scenario/run', json=body)
    assert result.status_code == 200, result.text
    assert any('All profile years' in d['message'] for d in result.json()['diagnostics'])

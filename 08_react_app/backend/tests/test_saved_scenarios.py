"""Save/open round trips using isolated JSON directories and representative data."""
import json
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.routers.saved_scenarios import get_repository
from backend.scenario_repository import ScenarioRepository
from backend.saved_scenario_models import ScenarioDefinition
from backend.state import app_state


@pytest.fixture
def storage(tmp_path):
    return ScenarioRepository(tmp_path / 'scenarios')


@pytest.fixture
def client(storage):
    app.dependency_overrides[get_repository] = lambda: storage
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def definition(client):
    ids = [c['id'] for c in client.get('/api/cases').json()[:3]]
    configs = [dict(include=True, operation='No Change', params=[0]*5),
               dict(include=True, operation='Farm In (Increase)', params=[.1, 2028, 2030, 20, 2027]),
               dict(include=False, operation='Delay', params=[2, 5, 2028, 0, 0])]
    return dict(schema_version=1, name='Round trip', description='Description', rationale='Rationale',
                shortlisted_case_ids=ids, case_configurations=dict(zip(map(str, ids), configs)))


def test_complete_crud_roundtrip_restart_and_run(client, storage):
    body = definition(client)
    created = client.post('/api/scenarios', json=body)
    assert created.status_code == 201, created.text
    saved = created.json()
    sid = saved['scenario_id']
    assert all(saved[key] == value for key, value in body.items())
    assert len(list(storage.directory.glob('*.json'))) == 1
    recreated = ScenarioRepository(storage.directory)
    assert recreated.get(sid).model_dump(mode='json') == saved
    assert client.get('/api/scenarios').json()['scenarios'][0]['scenario_id'] == sid
    opened = client.get(f'/api/scenarios/{sid}').json()
    assert opened['validation_errors'] == []
    for key, value in body.items():
        assert opened[key] == value
    updated_body = {**body, 'name': 'Edited', 'expected_updated_at': saved['updated_at']}
    updated = client.put(f'/api/scenarios/{sid}', json=updated_body)
    assert updated.status_code == 200
    assert updated.json()['created_at'] == saved['created_at']
    assert updated.json()['scenario_id'] == sid
    assert client.put(f'/api/scenarios/{sid}', json=updated_body).status_code == 409
    copy = client.post('/api/scenarios', json={**body, 'name': 'Copy'}).json()
    assert copy['scenario_id'] != sid
    instructions = []
    for case in client.get('/api/cases').json():
        config = opened['case_configurations'].get(str(case['id']), dict(include=True, operation='No Change', params=[0]*5))
        instructions.append(dict(id=case['id'], case=case['case'], include=config['include'], operation=config['operation'],
                                 **{f'param{i+1}': p for i, p in enumerate(config['params'])}))
    run = client.post('/api/scenario/run', json={'instructions': instructions})
    assert run.status_code == 200, run.text
    assert client.delete(f'/api/scenarios/{sid}').status_code == 204
    assert client.get(f'/api/scenarios/{sid}').status_code == 404
    assert client.delete(f'/api/scenarios/{sid}').status_code == 404
    assert client.get(f'/api/scenarios/{copy["scenario_id"]}').status_code == 200


@pytest.mark.parametrize('mutation', ['duplicate', 'unknown', 'mismatch', 'operation', 'year', 'version', 'empty_name', 'params'])
def test_bad_definitions_do_not_write(client, storage, mutation):
    body = definition(client)
    first = str(body['shortlisted_case_ids'][0])
    if mutation == 'duplicate': body['shortlisted_case_ids'].append(int(first))
    if mutation == 'unknown':
        body['shortlisted_case_ids'].append(9999999)
        body['case_configurations']['9999999'] = body['case_configurations'][first]
    if mutation == 'mismatch': del body['case_configurations'][first]
    if mutation == 'operation': body['case_configurations'][first]['operation'] = 'Typo'
    if mutation == 'year': body['case_configurations'][first].update(operation='Truncate Before', params=[235, 0, 0, 0, 0])
    if mutation == 'version': body['schema_version'] = 2
    if mutation == 'empty_name': body['name'] = '  '
    if mutation == 'params': body['case_configurations'][first]['params'] = [0]
    assert client.post('/api/scenarios', json=body).status_code == 422
    assert list(storage.directory.glob('*.json')) == []


def test_corrupt_files_are_reported_without_hiding_good_records(client, storage):
    saved = client.post('/api/scenarios', json=definition(client)).json()
    bad = str(uuid4())
    (storage.directory / f'{bad}.json').write_text('{incomplete')
    listing = client.get('/api/scenarios').json()
    assert len(listing['scenarios']) == 1 and listing['errors']
    assert client.get(f'/api/scenarios/{bad}').status_code == 409
    assert client.get('/api/scenarios/not-a-uuid').status_code == 422
    assert client.get(f'/api/scenarios/{uuid4()}').status_code == 404
    assert client.get(f'/api/scenarios/{saved["scenario_id"]}').status_code == 200


def test_open_retains_definition_when_reference_case_disappears(client, monkeypatch):
    saved = client.post('/api/scenarios', json=definition(client)).json()
    removed = saved['shortlisted_case_ids'][0]
    monkeypatch.setattr(app_state, 'case_listing', app_state.case_listing.loc[app_state.case_listing.ID != removed])
    opened = client.get(f'/api/scenarios/{saved["scenario_id"]}').json()
    assert removed in opened['shortlisted_case_ids']
    assert opened['validation_errors'][0]['ID'] == removed


def test_failed_atomic_replace_preserves_original(client, storage, monkeypatch):
    saved = client.post('/api/scenarios', json=definition(client)).json()
    path = storage.directory / f'{saved["scenario_id"]}.json'
    original = path.read_bytes()
    def fail(*args): raise OSError('disk failure')
    monkeypatch.setattr('backend.scenario_repository.os.replace', fail)
    response = client.put(f'/api/scenarios/{saved["scenario_id"]}', json={
        **definition(client), 'name': 'Lost write', 'expected_updated_at': saved['updated_at']})
    assert response.status_code == 503
    assert path.read_bytes() == original
    assert not list(storage.directory.glob('*.tmp'))


def test_invalid_update_preserves_saved_definition_and_unsupported_files(client, storage):
    body = definition(client)
    saved = client.post('/api/scenarios', json=body).json()
    path = storage.directory / f'{saved["scenario_id"]}.json'
    original = path.read_bytes()
    body['case_configurations'][str(body['shortlisted_case_ids'][1])]['params'][0] = -1
    assert client.put(f'/api/scenarios/{saved["scenario_id"]}', json={**body, 'expected_updated_at': saved['updated_at']}).status_code == 422
    assert path.read_bytes() == original
    saved['schema_version'] = 99
    path.write_text(json.dumps(saved))
    assert client.get(f'/api/scenarios/{saved["scenario_id"]}').status_code == 409
    assert client.get('/api/scenarios').json()['errors']


def test_empty_shortlist_and_excluded_parameters_roundtrip(client):
    body = dict(name='Reference', description='', rationale='', shortlisted_case_ids=[], case_configurations={})
    assert client.post('/api/scenarios', json=body).status_code == 201
    body = definition(client)
    last = str(body['shortlisted_case_ids'][-1])
    body['case_configurations'][last]['params'] = [2, 5, 2028, 0, 0]
    saved = client.post('/api/scenarios', json=body).json()
    assert saved['case_configurations'][last] == body['case_configurations'][last]

# ========================================================================
# SAVED SCENARIOS API — CONNECT THE SAVED-SCENARIOS PANE TO JSON FILES
# ========================================================================
#
# The list/get/create/update/delete routes use ScenarioRepository for disk
# access and saved_scenario_models for the versioned definition format.
# SCENARIO_STORAGE_DIR can override the default app_data/scenarios folder.
# The dependency getter lets tests substitute an isolated repository.
#
# Reading versus saving
# ---------------------
# An existing definition may refer to cases or operations that are no
# longer valid against the loaded reference data. A view can return those
# validation_errors so the user can inspect the definition. Creating or
# updating a definition requires it to pass the current-data checks.
# The checks translate saved settings into scenario instructions and reuse
# validate_operations. Errors block saving; permitted warnings do not.
#
# HTTP outcomes
# -------------
# Successful creation returns 201; deletion returns 204 without a body.
# Missing scenarios produce 404. Invalid stored files and stale update
# conflicts produce 409. Storage failures are reported as 503, and invalid
# submitted definitions as 422. The wrapper translates repository failures
# into these API responses rather than exposing file operations to React.
#
# Updating requires the last-seen updated_at timestamp to prevent silently
# overwriting a newer save. Delete removes the file; the app's confirmation
# dialog belongs to the frontend. These endpoints do not calculate results,
# and saving a definition does not preserve a history of run outputs.
# Read scenario_repository.py for atomic writes and saved_scenario_models.py
# for exactly which editable fields are persisted.

"""Save definitions independently of analytical execution."""
import os
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from ..state import app_state
from ..schemas import ScenarioInstruction
from ..operation_validation import OPERATION_MAP, validate_operations
from ..scenario_repository import ScenarioRepository, InvalidScenarioFile, ScenarioConflict
from ..saved_scenario_models import (ScenarioDefinition, UpdateScenario, SavedScenario,
                                     ScenarioView, ScenarioList)

router = APIRouter(prefix='/api/scenarios', tags=['Saved scenarios'])
repository = ScenarioRepository(os.environ.get('SCENARIO_STORAGE_DIR',
    str(Path(__file__).resolve().parents[1] / 'app_data' / 'scenarios')))


def get_repository():
    return repository


def validation_errors(definition):
    known = set(app_state.case_listing.ID)
    errors, instructions = [], []
    for case_id in definition.shortlisted_case_ids:
        config = definition.case_configurations[str(case_id)]
        if case_id not in known:
            errors.append({'ID': case_id, 'message': 'This case is no longer in the loaded portfolio. Remove it from the shortlist.'})
            continue
        if config.operation not in OPERATION_MAP:
            errors.append({'ID': case_id, 'message': 'Select a recognised operation.'})
            continue
        instructions.append(ScenarioInstruction(id=case_id, case='', include=config.include,
            operation=config.operation, **{f'param{i+1}': value for i, value in enumerate(config.params)}))
    operation_errors, _ = validate_operations(instructions, app_state.raw_profiles)
    return errors + operation_errors


def require_valid(definition):
    errors = validation_errors(definition)
    if errors:
        raise HTTPException(422, detail={'message': 'Correct the scenario configuration before saving.', 'diagnostics': errors})


def storage_action(action):
    try:
        return action()
    except FileNotFoundError:
        raise HTTPException(404, detail='Saved scenario not found.')
    except (InvalidScenarioFile, ScenarioConflict) as exc:
        raise HTTPException(409, detail=str(exc))
    except OSError:
        raise HTTPException(503, detail='Scenario storage is unavailable. Your working changes have not been saved.')


@router.get('', response_model=ScenarioList)
def list_scenarios(repo=Depends(get_repository)):
    records, errors = storage_action(repo.list)
    return {'scenarios': records, 'errors': errors}


@router.get('/{scenario_id}', response_model=ScenarioView)
def get_scenario(scenario_id: UUID, repo=Depends(get_repository)):
    record = storage_action(lambda: repo.get(scenario_id))
    return ScenarioView(**record.model_dump(), validation_errors=validation_errors(record))


@router.post('', response_model=SavedScenario, status_code=201)
def create_scenario(definition: ScenarioDefinition, repo=Depends(get_repository)):
    require_valid(definition)
    return storage_action(lambda: repo.create(definition))


@router.put('/{scenario_id}', response_model=SavedScenario)
def update_scenario(scenario_id: UUID, request: UpdateScenario, repo=Depends(get_repository)):
    definition = ScenarioDefinition(**request.model_dump(exclude={'expected_updated_at'}))
    require_valid(definition)
    return storage_action(lambda: repo.update(scenario_id, definition, request.expected_updated_at))


@router.delete('/{scenario_id}', status_code=204)
def delete_scenario(scenario_id: UUID, repo=Depends(get_repository)):
    storage_action(lambda: repo.delete(scenario_id))
    return Response(status_code=204)

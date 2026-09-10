"""Atomic JSON storage for the local, single-process prototype."""
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import RLock
from datetime import datetime, timezone
from uuid import UUID, uuid4
from pydantic import ValidationError
from .saved_scenario_models import SavedScenario, ScenarioSummary


class InvalidScenarioFile(ValueError):
    pass


class ScenarioConflict(ValueError):
    pass


class ScenarioRepository:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.lock = RLock()

    def _path(self, scenario_id):
        return self.directory / f'{UUID(str(scenario_id))}.json'

    def get(self, scenario_id):
        path = self._path(scenario_id)
        try:
            record = SavedScenario.model_validate_json(path.read_text(encoding='utf-8'))
            if str(record.scenario_id) != path.stem:
                raise ValueError('Scenario ID does not match its filename.')
            return record
        except (ValidationError, ValueError, UnicodeError) as exc:
            raise InvalidScenarioFile(f'Scenario {path.stem} is unreadable or has an unsupported format.') from exc

    def list(self):
        records, errors = [], []
        for path in self.directory.glob('*.json'):
            try:
                record = self.get(path.stem)
                records.append(ScenarioSummary.model_validate(record.model_dump()))
            except (ValueError, OSError):
                errors.append(f'Could not read saved scenario file {path.name}. The file has been left unchanged.')
        return sorted(records, key=lambda r: r.updated_at, reverse=True), errors

    def _write(self, record):
        self.directory.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with NamedTemporaryFile(mode='w', encoding='utf-8', dir=self.directory,
                                    prefix='.scenario-', suffix='.tmp', delete=False) as handle:
                temporary = Path(handle.name)
                json.dump(record.model_dump(mode='json'), handle, ensure_ascii=False, indent=2, allow_nan=False)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self._path(record.scenario_id))
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        return record

    def create(self, definition):
        with self.lock:
            now = datetime.now(timezone.utc)
            record = SavedScenario(**definition.model_dump(), scenario_id=uuid4(), created_at=now, updated_at=now)
            return self._write(record)

    def update(self, scenario_id, definition, expected_updated_at):
        with self.lock:
            previous = self.get(scenario_id)
            if previous.updated_at != expected_updated_at:
                raise ScenarioConflict('This scenario changed since you opened it. Open the scenario from Saved scenarios before saving again.')
            record = SavedScenario(**definition.model_dump(), scenario_id=previous.scenario_id,
                                   created_at=previous.created_at, updated_at=datetime.now(timezone.utc))
            return self._write(record)

    def delete(self, scenario_id):
        with self.lock:
            self._path(scenario_id).unlink()

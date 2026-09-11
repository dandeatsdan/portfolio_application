# ========================================================================
# SCENARIO REPOSITORY — DURABLE SAVING WITHOUT A DATABASE SERVER
# ========================================================================
#
# Purpose
# -------
# Store each saved scenario definition in its own UUID-named JSON file.
# The repository owns file operations; the router owns HTTP responses and
# current-data business checks. Calculated results are not saved here.
#
# Basic operations
# ----------------
# create generates an ID and timestamps, then writes the definition.
# get reads and validates the JSON and checks that its ID matches the file.
# list returns newest-modified summaries and reports unreadable/invalid
# entries separately, leaving the affected files in place.
# update checks expected_updated_at before preserving the ID/creation time
# and writing a new modified time and definition.
# delete removes the scenario's file.
#
# Why saving uses a temporary file
# -------------------------------
# Writing directly over the original could leave half a JSON document if
# writing fails. _write creates a temporary file in the same directory,
# writes the complete JSON, flushes and fsyncs it, then uses os.replace to
# replace the destination atomically. Temporary files are cleaned up.
# This improves individual-file replacement; it is not a database-style
# transaction across several files or a backup/version-history system.
#
# Avoiding stale updates
# ----------------------
# Suppose two screens open version A. The first saves version B. The second
# still submits A's timestamp, so update raises ScenarioConflict instead
# of silently replacing B. The caller can then tell the user to reopen.
#
# Concurrency and file safety
# ---------------------------
# The RLock serialises repository operations using this instance in one
# process. It is not an inter-process file lock. UUID parsing determines
# the filename, rather than using an arbitrary user-supplied path.
# The storage directory is provided to this class by the caller; the API
# router configures its default or environment override.
# See saved_scenario_models.py for the file schema and the saved-scenarios
# router for how missing files, conflicts and storage errors reach React.

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

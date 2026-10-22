# ========================================================================
# SAVED SCENARIO MODELS — THE VERSIONED JSON DEFINITION
# ========================================================================
#
# What is saved
# -------------
# A scenario definition stores the name, description, rationale, shortlist
# and case configurations. Each configuration has an inclusion flag, an
# operation and exactly five parameters. This is the editable recipe for
# a run; it does not contain a historical snapshot of calculated results.
#
# Shortlist does not mean included portfolio
# -----------------------------------------
# In the React builder, cases are included at reference by default. The
# shortlist records cases with explicit configurations/review entries,
# including exclusions. Its IDs must be unique, and case_configs must have
# exactly the corresponding ID keys. Removing an override restores the
# builder's default behaviour; it does not necessarily remove a case from
# the portfolio.
#
# How the models relate
# ---------------------
# CaseConfiguration validates a single case's saved settings.
# ScenarioDefinition validates the editable, schema-versioned payload.
# SavedScenario adds the UUID and creation/update timestamps.
# UpdateScenario adds expected_updated_at for conflict detection.
# Summary/list/view models support the saved-scenarios pane and report
# stored definitions whose operation/case references need attention.
#
# Types and business validity
# ---------------------------
# Strict fields, finite numbers, forbidden extra fields and a supported
# schema version protect the file format. The router separately checks
# whether IDs and operations still match the currently loaded data.
# expected_updated_at allows the repository to reject a stale overwrite.
# Read scenario_repository.py for file writing, then routers/saved_scenarios.py
# for current-data checks and HTTP error messages.

"""Versioned editable definitions. Results are deliberately not stored."""
from datetime import datetime
from typing import Literal, Annotated
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator


class CaseConfiguration(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    include: StrictBool
    operation: str = Field(min_length=1)
    params: list[Annotated[float, Field(strict=True)]] = Field(min_length=5, max_length=5)


class ScenarioDefinition(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schema_version: Literal[1] = 1
    name: str = Field(min_length=1)
    description: str = ''
    rationale: str = ''
    shortlisted_case_ids: list[StrictInt]
    case_configurations: dict[str, CaseConfiguration]

    @model_validator(mode='after')
    def coherent_definition(self):
        if not self.name.strip():
            raise ValueError('Enter a scenario name.')
        ids = self.shortlisted_case_ids
        if len(ids) != len(set(ids)):
            raise ValueError('Shortlist IDs must be unique.')
        if set(self.case_configurations) != {str(i) for i in ids}:
            raise ValueError('Case configurations must match the shortlist IDs exactly.')
        return self


class SavedScenario(ScenarioDefinition):
    scenario_id: UUID
    created_at: datetime
    updated_at: datetime


class UpdateScenario(ScenarioDefinition):
    expected_updated_at: datetime


class ScenarioSummary(BaseModel):
    scenario_id: UUID
    name: str
    updated_at: datetime


class ScenarioList(BaseModel):
    scenarios: list[ScenarioSummary]
    errors: list[str]


class ScenarioView(SavedScenario):
    validation_errors: list[dict] = Field(default_factory=list)

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

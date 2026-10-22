# ========================================================================
# DOMAIN RECORDS — SMALL PYTHON CONTAINERS FOR SCENARIO INFORMATION
# ========================================================================
#
# These dataclasses name the fields in a scenario instruction and its
# metadata. They let Python code describe a record without using an
# unlabelled tuple. They do not load data, run calculations or save files.
#
# ScenarioInstruction describes a scenario/case pair, its inclusion flag,
# operation and five parameter slots. ScenarioMeta holds identifying and
# descriptive information. The operation determines each parameter's role.
#
# Type annotations explain intended values to readers and tooling; these
# plain dataclasses do not enforce the React API's business input rules.
# Do not confuse them with the Pydantic request models in backend/schemas.py
# or the versioned JSON definitions in backend/saved_scenario_models.py.
# The execution path mainly exchanges pandas instruction DataFrames; this
# file is not itself the scenario engine or its dispatch loop.

from dataclasses import dataclass, field


@dataclass
class ScenarioInstruction:
    scenario_id: int
    case_id: int
    case_name: str
    include: bool
    operation: str
    param1: float = 0.0
    param2: float = 0.0
    param3: float = 0.0
    param4: float = 0.0
    param5: float = 0.0


@dataclass
class ScenarioMeta:
    scenario_id: int
    scenario_name: str
    description: str = ""

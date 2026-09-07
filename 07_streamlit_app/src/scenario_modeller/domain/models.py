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

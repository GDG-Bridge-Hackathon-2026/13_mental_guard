from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class Emotion(str, Enum):
    ANGER = "ANGER"
    FRUSTRATION = "FRUSTRATION"
    CYNICISM = "CYNICISM"
    CONFUSION = "CONFUSION"
    CALM = "CALM"

class Trend(str, Enum):
    """
    trend calculation rule:
    - Compare current `threat_level` with the LAST value in
      `context.recent_threats`.

    Rules:
    - UP:
        current threat_level > last recent threat
    - DOWN:
        current threat_level < last recent threat
    - STABLE:
        current threat_level == last recent threat
        OR context.recent_threats is empty
    """
    UP = "UP"
    DOWN = "DOWN"
    STABLE = "STABLE"


class Intent(str, Enum):
    LEGITIMATE_COMPLAINT = "LEGITIMATE_COMPLAINT"
    VENT = "VENT"
    THREAT = "THREAT"
    INSULT = "INSULT"
    INQUIRY = "INQUIRY"


class Classification(str, Enum):
    """
    Customer interaction severity classification.

    A = Normal inquiry/request
    B = Complaint/frustration
    C = Verbal abuse
    D = Obstruction or non-physical threat
    E = Criminal or physical threat
    """

    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"

class RecommendedActionLevel(str, Enum):
    NORMAL = "NORMAL"
    CAUTION = "CAUTION"
    ESCALATE = "ESCALATE"
    TERMINATE_ALLOWED = "TERMINATE_ALLOWED"
    LEGAL_ACTION = "LEGAL_ACTION"

class Metrics(BaseModel):
    threat_level: int = Field(
        ...,
        ge=1,
        le=5,
        description=(
            "Stress/Danger Intensity of the call.\n\n"
            "1: Cold/Calm — No stress, neutral interaction.\n"
            "2: Warm — Slight agitation or annoyance.\n"
            "3: Hot — Raised voice, aggressive tone, uncooperative behavior.\n"
            "4: Boiling — Highly hostile, severe emotional stress to agent.\n"
            "5: Explosive — Immediate danger or extreme hostility; "
            "requires immediate call termination."
        )
    )
    emotion: Emotion
    factual_ratio: int = Field(..., ge=0, le=100)
    repetition_score: int = Field(..., ge=0, le=100)
    trend: Trend = Field(
        ...,
        description=(
            "Threat escalation trend compared to the most recent prior turn.\n"
            "UP: current threat_level > last recent threat.\n"
            "DOWN: current threat_level < last recent threat.\n"
            "STABLE: same threat_level or no prior threat history."
        )
    )

class Summary(BaseModel):
    core_demand: str
    intent: Intent
    risk_keywords: list[str]

class Scripts(BaseModel):
    공감: str
    단호: str
    위로: str

class RecommendedAction(BaseModel):
    level: RecommendedActionLevel
    scripts: Scripts
    legal_basis: Optional[str] = None

class AnalysisResponse(BaseModel):
    refined: str
    metrics: Metrics
    summary: Summary
    classification: Classification = Field(
        description=(
            "Severity classification.\n"
            "A: Normal inquiry/request.\n"
            "B: Complaint or frustration without abuse.\n"
            "C: Verbal abuse, profanity, insults, mockery.\n"
            "D: Obstruction or non-physical threats.\n"
            "E: Physical threats, stalking, criminal intimidation."
        )
    )
    preserved_facts: list[str]
    removed_expressions: list[str]
    abuse_types: list[str]
    confidence: float = Field(..., ge=0, le=1)
    recommended_action: RecommendedAction

class Context(BaseModel):
    recent_threats: list[int]
    cumulative_threat: float
    total_turns: int
    language: str

class InputRequest(BaseModel):
    text: str
    context: Context

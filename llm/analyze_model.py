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
    threat_level: int = Field(..., ge=1, le=5)
    emotion: Emotion
    factual_ratio: int = Field(..., ge=0, le=100)
    repetition_score: int = Field(..., ge=0, le=100)
    trend: Trend

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
    classification: Classification
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

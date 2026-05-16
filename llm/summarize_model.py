from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Speaker(str, Enum):
    CALLER = "CALLER"
    AGENT = "AGENT"

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

class LegalBasisMapKey(str, Enum):
    KR = "KR_EMOTION_LABOR_LAW_26_2"
    JP = "JP_KASAHARA_MANUAL_CH4"

class TurnItem(BaseModel):
    seq: int = Field(..., ge=1)
    speaker: Speaker
    text: str

    # CALLER の時だけ入るので optional
    classification: Optional[Classification] = None

    # CALLER の時だけ入るので optional
    threat_level: Optional[int] = Field(None, ge=1, le=5)

class SummarizeInput(BaseModel):
    # schemaでは array 直接
    turns: list[TurnItem]
    cumulative_threat: float
    language: str

class SummarizeResponse(BaseModel):
    final_classification: Classification
    final_action: RecommendedActionLevel
    core_demands: list[str]
    # schemaでは array
    agent_response_summary: list[str]
    legal_basis_keys: list[LegalBasisMapKey]

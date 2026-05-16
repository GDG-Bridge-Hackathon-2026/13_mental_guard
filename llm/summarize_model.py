from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Speaker(str, Enum):
    CALLER = "CALLER"
    AGENT = "AGENT"

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

class LegalBasisMapKey(str, Enum):
    KR = "KR_EMOTION_LABOR_LAW_26_2"
    JP = "JP_KASAHARA_MANUAL_CH4"

class TurnItem(BaseModel):
    seq: int = Field(..., ge=1)
    speaker: Speaker
    text: str

    # Only CALLER, optional
    classification: Optional[Classification] = Field(
        default=None,
        description=(
            "Severity classification.\n"
            "A: Normal inquiry/request.\n"
            "B: Complaint or frustration without abuse.\n"
            "C: Verbal abuse, profanity, insults, mockery.\n"
            "D: Obstruction or non-physical threats.\n"
            "E: Physical threats, stalking, criminal intimidation."
        )
    )

    # Only CALLER, optional
    threat_level: Optional[int] = Field(
        default=None,
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

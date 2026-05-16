import os
from enum import Enum
from typing import Optional
from google import genai
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field
from google.genai.types import GenerateContentConfig

import prompt_template

app = FastAPI()


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
    empathy: str
    firm: str
    comfort: str

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

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(req: InputRequest):
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY")
    )

    content = prompt_template.prompt_template.format(INPUT_JSON=req)

    response = client.models.generate_content(
        model=os.getenv("MODEL_NAME"), contents=content, 
        config=GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AnalysisResponse,
        )
    )
    result = AnalysisResponse.model_validate_json(response.text)
    return result

# Example request:
# curl -X POST "http://127.0.0.1:5555/1/analyze" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "text": "지난주에도 문의했는데 아직 처리가 안 됐습니다.",
#     "context": {
#       "recent_threats": [2, 3, 3, 4],
#       "cumulative_threat": 3.0,
#       "total_turns": 4,
#       "language": "KO"
#     }
#   }'

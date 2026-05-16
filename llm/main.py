import os
from enum import Enum
from typing import List
from google import genai
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Emotion(str, Enum):
    분노 = "분노"
    좌절 = "좌절"
    냉소 = "냉소"
    혼란 = "혼란"
    평정 = "평정"


class CallerSignals(BaseModel):
    emotion_keywords: List[Emotion]
    speech_feature_keywords: List[str]


class Safety(BaseModel):
    risk_level: int
    risk_reason: str
    risk_keywords: List[str]


class AnalysisResponse(BaseModel):
    refined_text: str
    core_demands: List[str]
    caller_signals: CallerSignals
    recommended_response: str
    safety: Safety
    confidence: float


class InputRequest(BaseModel):
    text: str


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(req: InputRequest):
    text = req.text

    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY")
    )

    response = client.models.generate_content(
        model=os.getenv("MODEL_NAME"), contents="Explain how AI works in a few words"
    )
    print(response.text)

    # TODO:
    # Here you can replace with actual LLM inference logic

    return AnalysisResponse(
        refined_text=response.text, # "민원인은 이전 문의 이후에도 처리가 지연되었으며, 처리 현황 확인과 상급자 연결을 요청하고 있습니다.",
        core_demands=[
            "처리 지연 사유 확인 요청",
            "상급자 연결 요청",
        ],
        caller_signals=CallerSignals(
            emotion_keywords=[Emotion.좌절],
            speech_feature_keywords=[
                "반복 문의",
                "처리 지연 강조",
                "상급자 연결 요구",
            ],
        ),
        recommended_response="접수번호를 먼저 확인한 뒤 처리 현황을 안내드리고, 필요 시 상급자 연결 절차를 도와드리겠습니다.",
        safety=Safety(
            risk_level=2,
            risk_reason="처리 지연에 대한 불만은 있으나 직접적인 위협이나 폭언은 없습니다.",
            risk_keywords=[],
        ),
        confidence=0.88,
    )


# Run:
# uvicorn main:app --reload
#
# Example request:
# curl -X POST http://127.0.0.1:5555/analyze \
#   -H "Content-Type: application/json" \
#   -d '{"text":"지난주에도 문의했고 어제도 다시 전화했는데 아직도 처리가 안 됐잖아요."}'

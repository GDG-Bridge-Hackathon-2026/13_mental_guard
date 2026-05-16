import os
from google import genai
from fastapi import FastAPI
from google.genai.types import GenerateContentConfig, ThinkingConfig
import analyze_model
import summarize_model
import analyze_prompt
import summarize_prompt

app = FastAPI()

@app.post("/analyze", response_model=analyze_model.AnalysisResponse)
async def analyze_claim(req: analyze_model.InputRequest):
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY")
    )

    content = analyze_prompt.prompt_template.format(INPUT_JSON=req)

    response = client.models.generate_content(
        model=os.getenv("MODEL_NAME"), contents=content, 
        config=GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=analyze_model.AnalysisResponse,
            thinking_config=ThinkingConfig(thinking_budget=0)
        ),
    )
    result = analyze_model.AnalysisResponse.model_validate_json(response.text)
    return result

@app.post("/summarize", response_model=summarize_model.SummarizeResponse)
async def summarize_claim(req: summarize_model.SummarizeInput):
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY")
    )

    content = summarize_prompt.prompt_template.format(INPUT_JSON=req)

    response = client.models.generate_content(
        model=os.getenv("MODEL_NAME"), contents=content, 
        config=GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=summarize_model.SummarizeResponse,
            thinking_config=ThinkingConfig(thinking_budget=0)
        ),
    )
    result = summarize_model.SummarizeResponse.model_validate_json(response.text)
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

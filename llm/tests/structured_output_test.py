from google import genai
from google.genai import types
from google.genai.types import GenerateContentConfig
from pydantic import BaseModel, Field
from typing import List

class MatchResult(BaseModel):
    answer: str = Field(description="Answer of math")

client = genai.Client()

response = client.models.generate_content(
    model="gemma-4-26b-a4b-it",
    contents="1 + 1 = ?",
    config=GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=MatchResult,
    )
)

print(response)
print(response.text)
result = MatchResult.model_validate_json(response.text)
print(result)
print(type(result))

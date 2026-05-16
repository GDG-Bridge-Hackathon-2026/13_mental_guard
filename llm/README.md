# LLM
## Before build
- Make .env file and write down like the following:
```
GEMINI_API_KEY=XXXXXXX
MODEL_NAME=XXXXXXX # Example: gemini-2.5-flash-lite
```
## Build
```
docker build -t llm-analyzer .
docker run --env-file .env --rm -p 5555:5555 llm-analyzer
``` 
- For running request test, you can run the following command.
```
curl -X POST "http://127.0.0.1:5555/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text": "지난주에도 문의했는데 아직 처리가 안 됐습니다.","context": {"recent_threats": [2, 3, 3, 4], "cumulative_threat": 3.0, "total_turns": 4, "language": "KO"}}'

# Output
{
  "refined":"고객님께서는 지난주에 문의했지만 아직 처리가 완료되지 않았다고 언급하셨습니다.",
  "metrics":{
    "threat_level":2,
    "emotion":"FRUSTRATION",
    "factual_ratio":90,
    "repetition_score":30,
    "trend":"STABLE"
  },
  "summary":{
    "core_demand":"처리 지연 사유 확인",
    "intent":"VENT",
    "risk_keywords":[]
  },
  "classification":"B",
  "preserved_facts":["지난주에도 문의함","아직 처리되지 않았다고 주장함"],
  "removed_expressions":[],
  "abuse_types":[],
  "confidence":0.86,
  "recommended_action":{
    "level":"CAUTION",
    "scripts":{
      "empathy":"불편을 겪으신 점을 확인했습니다. 접수 이력을 먼저 확인해보겠습니다.",
      "firm":"정확한 확인을 위해 접수번호와 문의 일자를 확인하겠습니다.",
      "comfort":"오래 기다리셔서 답답하셨을 것 같습니다. 처리 현황을 확인해드리겠습니다."
    },
    "legal_basis":null
  }
}
``` 

# ML Service Contract

BE가 호출하는 ML 서비스의 endpoint 명세.
모든 응답은 BE가 zod로 검증하며, 형태가 맞지 않으면 **1회 재시도 후 fallback** 처리됩니다.

## 공통 / Common

| 항목 | 값 |
|---|---|
| Base URL | `${ML_SERVICE_URL}` (BE env 변수) |
| Method | 모두 `POST` |
| Content-Type | `application/json` |
| Timeout | 15s (BE `ML_SERVICE_TIMEOUT_MS`) |
| 인증 | 현재 없음 (BE↔ML은 사설망 가정) |

### 공통 헤더

| Header | 필수 | 설명 |
|---|---|---|
| `Content-Type: application/json` | ✓ | |
| `X-Session-Id: ses_xxxxxxxx` | ✓ | **모든 요청에 동봉.** DB의 Session ID와 동일. ML은 이 값을 키로 in-memory context / 대화 히스토리 / cache를 유지해 같은 세션 내 호출들이 이전 맥락을 기억하도록 사용. |

**ML 측 권장 사용 패턴:**

- **/analyze**: `X-Session-Id` 별로 LLM conversation 유지 (system prompt + 직전 caller·agent 발화 K개를 메시지 리스트로 누적). 이렇게 하면 BE가 `context.recent_threats` 외에 추가 텍스트 맥락을 안 보내도 ML이 알아서 일관성 있는 분석을 함.
- **/summarize**: 누적된 conversation을 시점에 맞춰 정리. 호출 후 해당 session 캐시 정리.
- **/regenerate-script**: 같은 session 안에서 직전 응답 톤/맥락을 재사용 가능.

**세션 종료 / 정리:** BE가 `/summarize` 호출 후 그 세션의 ML 측 상태는 폐기해도 안전. 별도 cleanup endpoint가 필요하면 알려주세요 (예: `DELETE /sessions/{id}/context`).

**메모리 누수 방지:** ML은 일정 시간 비활성 세션은 자동 폐기 (예: 마지막 호출 후 1시간). 그렇지 않으면 장기 운영 시 메모리 누적.

### Enum 값

| Enum | Values |
|---|---|
| `Emotion` | `ANGER` `FRUSTRATION` `CYNICISM` `CONFUSION` `CALM` |
| `Intent` | `LEGITIMATE_COMPLAINT` `VENT` `THREAT` `INSULT` `INQUIRY` |
| `Trend` | `UP` `DOWN` `STABLE` |
| `Classification` | `A` `B` `C` `D` `E` |
| `ActionLevel` | `NORMAL` `CAUTION` `ESCALATE` `TERMINATE_ALLOWED` `LEGAL_ACTION` |
| `Speaker` | `CALLER` `AGENT` |
| `Language` | `KO` `JA` `EN` `AUTO` |
| `Tone` (한국어 고정) | `공감` `단호` `위로` |

---

## 1. `POST /analyze`

매 caller 발화마다 호출. 가장 자주 불림.

### Request — JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["text", "context"],
  "additionalProperties": false,
  "properties": {
    "text": {
      "type": "string",
      "description": "BE가 STT로 뽑은 caller 발화"
    },
    "context": {
      "type": "object",
      "required": ["recent_threats", "cumulative_threat", "total_turns", "language"],
      "additionalProperties": false,
      "properties": {
        "recent_threats": {
          "type": "array",
          "items": { "type": "number", "minimum": 1, "maximum": 5 },
          "description": "직전 5턴까지 caller threat_level (오래된→최근)"
        },
        "cumulative_threat": { "type": "number" },
        "total_turns": { "type": "integer", "minimum": 0 },
        "language": { "type": "string", "enum": ["KO", "JA", "EN", "AUTO"] }
      }
    }
  }
}
```

### Response — JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "refined", "metrics", "summary", "classification",
    "preserved_facts", "removed_expressions", "abuse_types",
    "confidence", "recommended_action"
  ],
  "additionalProperties": false,
  "properties": {
    "refined": {
      "type": "string",
      "description": "민원인이 말한 내용을 객관적·중립적으로 재진술한 자막"
    },
    "metrics": {
      "type": "object",
      "required": ["threat_level", "emotion", "factual_ratio", "repetition_score", "trend"],
      "additionalProperties": false,
      "properties": {
        "threat_level": { "type": "integer", "minimum": 1, "maximum": 5 },
        "emotion": {
          "type": "string",
          "enum": ["ANGER", "FRUSTRATION", "CYNICISM", "CONFUSION", "CALM"]
        },
        "factual_ratio": {
          "type": "integer", "minimum": 0, "maximum": 100,
          "description": "사실 진술 비율 %"
        },
        "repetition_score": {
          "type": "integer", "minimum": 0, "maximum": 100,
          "description": "직전 발화들과의 반복 정도"
        },
        "trend": { "type": "string", "enum": ["UP", "DOWN", "STABLE"] }
      }
    },
    "summary": {
      "type": "object",
      "required": ["core_demand", "intent", "risk_keywords"],
      "additionalProperties": false,
      "properties": {
        "core_demand": {
          "type": "string",
          "description": "민원인의 핵심 요구 (한 문장)"
        },
        "intent": {
          "type": "string",
          "enum": ["LEGITIMATE_COMPLAINT", "VENT", "THREAT", "INSULT", "INQUIRY"]
        },
        "risk_keywords": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "classification": { "type": "string", "enum": ["A", "B", "C", "D", "E"] },
    "preserved_facts": {
      "type": "array", "items": { "type": "string" },
      "description": "정제 시 보존된 사실"
    },
    "removed_expressions": {
      "type": "array", "items": { "type": "string" },
      "description": "정제 시 제거된 공격적/모욕 표현. 비어있지 않으면 is_filtered=true"
    },
    "abuse_types": {
      "type": "array", "items": { "type": "string" },
      "description": "학대 표현 유형 라벨 (예: '인격모독', '협박')"
    },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "recommended_action": {
      "type": "object",
      "required": ["level", "scripts", "legal_basis"],
      "additionalProperties": false,
      "properties": {
        "level": {
          "type": "string",
          "enum": ["NORMAL", "CAUTION", "ESCALATE", "TERMINATE_ALLOWED", "LEGAL_ACTION"]
        },
        "scripts": {
          "type": "object",
          "required": ["공감", "단호", "위로"],
          "additionalProperties": false,
          "properties": {
            "공감": { "type": "string" },
            "단호": { "type": "string" },
            "위로": { "type": "string" }
          }
        },
        "legal_basis": {
          "type": ["string", "null"],
          "description": "단일 법조항 텍스트. 없으면 null"
        }
      }
    }
  }
}
```

### Example Request

```json
{
  "text": "지난주에도 문의했는데 아직 처리가 안 됐습니다.",
  "context": {
    "recent_threats": [2, 3, 3, 4],
    "cumulative_threat": 3.0,
    "total_turns": 4,
    "language": "KO"
  }
}
```

### Example Response

```json
{
  "refined": "민원인은 지난주에도 문의했지만 아직 처리되지 않았다고 말하고 있습니다.",
  "metrics": {
    "threat_level": 2,
    "emotion": "FRUSTRATION",
    "factual_ratio": 80,
    "repetition_score": 30,
    "trend": "STABLE"
  },
  "summary": {
    "core_demand": "처리 지연 사유 확인",
    "intent": "VENT",
    "risk_keywords": []
  },
  "classification": "B",
  "preserved_facts": [
    "지난주에도 문의함",
    "아직 처리되지 않았다고 주장함"
  ],
  "removed_expressions": [],
  "abuse_types": [],
  "confidence": 0.86,
  "recommended_action": {
    "level": "CAUTION",
    "scripts": {
      "공감": "불편을 겪으신 점을 확인했습니다. 접수 이력을 먼저 확인해보겠습니다.",
      "단호": "정확한 확인을 위해 접수번호와 문의 일자를 확인하겠습니다.",
      "위로": "오래 기다리셔서 답답하셨을 것 같습니다. 처리 현황을 확인해드리겠습니다."
    },
    "legal_basis": null
  }
}
```

---

## 2. `POST /summarize`

세션 종료 시 1회. 종합 분석.

### Request — JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["turns", "cumulative_threat", "language"],
  "additionalProperties": false,
  "properties": {
    "turns": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["seq", "speaker", "text"],
        "additionalProperties": false,
        "properties": {
          "seq": { "type": "integer", "minimum": 1 },
          "speaker": { "type": "string", "enum": ["CALLER", "AGENT"] },
          "text": { "type": "string" },
          "classification": {
            "type": "string", "enum": ["A", "B", "C", "D", "E"],
            "description": "caller 턴에만 존재"
          },
          "threat_level": {
            "type": "integer", "minimum": 1, "maximum": 5,
            "description": "caller 턴에만 존재"
          }
        }
      }
    },
    "cumulative_threat": { "type": "number" },
    "language": { "type": "string" }
  }
}
```

### Response — JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "final_classification", "final_action",
    "core_demands", "agent_response_summary", "legal_basis_keys"
  ],
  "additionalProperties": false,
  "properties": {
    "final_classification": { "type": "string", "enum": ["A", "B", "C", "D", "E"] },
    "final_action": {
      "type": "string",
      "enum": ["NORMAL", "CAUTION", "ESCALATE", "TERMINATE_ALLOWED", "LEGAL_ACTION"]
    },
    "core_demands": {
      "type": "array", "items": { "type": "string" },
      "description": "민원인의 사실 기반 요구사항"
    },
    "agent_response_summary": {
      "type": "array", "items": { "type": "string" },
      "description": "접수인이 한 답변 요약"
    },
    "legal_basis_keys": {
      "type": "array", "items": { "type": "string" },
      "description": "BE LEGAL_BASIS_MAP의 key. 모르면 빈 배열"
    }
  }
}
```

### LEGAL_BASIS_MAP 현재 키 (확장 가능)

```json
{
  "KR_EMOTION_LABOR_LAW_26_2": "감정노동자보호법 제26조의2",
  "JP_KASAHARA_MANUAL_CH4": "厚生労働省 カスタマーハラスメント対策企業マニュアル 第4章"
}
```

ML이 새 key를 만들면 BE `src/services/summary.ts`의 `LEGAL_BASIS_MAP`에도 동시에 추가해야 매핑됩니다.

### Example Request

```json
{
  "turns": [
    {
      "seq": 1,
      "speaker": "CALLER",
      "text": "지난주에도 문의했는데 아직 처리가 안 됐습니다.",
      "classification": "B",
      "threat_level": 2
    },
    {
      "seq": 2,
      "speaker": "AGENT",
      "text": "접수번호를 먼저 확인하겠습니다."
    },
    {
      "seq": 3,
      "speaker": "CALLER",
      "text": "도대체 언제까지 기다려야 합니까?",
      "classification": "C",
      "threat_level": 4
    }
  ],
  "cumulative_threat": 3.0,
  "language": "KO"
}
```

### Example Response

```json
{
  "final_classification": "C",
  "final_action": "CAUTION",
  "core_demands": [
    "처리 지연 사유 확인",
    "상급자 연결 요청"
  ],
  "agent_response_summary": [
    "접수번호 확인 후 처리 현황 안내를 약속함"
  ],
  "legal_basis_keys": ["KR_EMOTION_LABOR_LAW_26_2"]
}
```

---

## 3. `POST /regenerate-script`

"다른 응대 보기" 버튼.

### Request — JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["turn_id", "raw_text", "tone"],
  "additionalProperties": false,
  "properties": {
    "turn_id": { "type": "string", "description": "참조용 (로깅)" },
    "raw_text": { "type": "string" },
    "tone": { "type": "string", "enum": ["공감", "단호", "위로"] },
    "additional_context": { "type": "string", "maxLength": 2000 }
  }
}
```

### Response — JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["script"],
  "additionalProperties": false,
  "properties": {
    "script": { "type": "string" }
  }
}
```

### Example Request

```json
{
  "turn_id": "tur_a1b2c3d4",
  "raw_text": "도대체 환불 처리가 왜 이렇게 늦는 거야",
  "tone": "단호",
  "additional_context": "고객이 5번째 전화"
}
```

### Example Response

```json
{
  "script": "고객님, 환불 처리는 영업일 기준 3일 이내 완료됩니다. 정확한 접수번호를 알려주시면 즉시 확인해드리겠습니다."
}
```

---

## 에러 응답 (선택)

ML이 에러를 명확히 던지려면 다음 형태 권장 (BE는 status code만 봄):

```json
{
  "error": {
    "code": "MODEL_OVERLOADED",
    "message": "사유"
  }
}
```

| HTTP | BE 해석 |
|---|---|
| 2xx | 성공 (단, body가 schema와 다르면 1회 재시도) |
| 4xx | 즉시 fallback (재시도 안 함) |
| 5xx | 즉시 fallback (재시도 안 함) |
| timeout (>15s) | 즉시 fallback |

---

## 빠른 mock 서버 예시 (FastAPI)

ML 실제 구현 전, FE/BE 개발 중 mock으로 띄울 때:

```python
from fastapi import FastAPI
app = FastAPI()

@app.post("/analyze")
def analyze(body: dict):
    return {
        "refined": "민원인이 처리 지연에 대해 문의하고 있습니다.",
        "metrics": {
            "threat_level": 2, "emotion": "FRUSTRATION",
            "factual_ratio": 70, "repetition_score": 20, "trend": "STABLE"
        },
        "summary": {
            "core_demand": "처리 현황 확인",
            "intent": "VENT", "risk_keywords": []
        },
        "classification": "B",
        "preserved_facts": [], "removed_expressions": [], "abuse_types": [],
        "confidence": 0.5,
        "recommended_action": {
            "level": "CAUTION",
            "scripts": {
                "공감": "기다리시느라 답답하셨겠습니다.",
                "단호": "접수번호를 알려주세요.",
                "위로": "신속히 도와드리겠습니다."
            },
            "legal_basis": None
        }
    }
# /summarize, /regenerate-script 동일 패턴
```

---

## 코드 진실의 소스 (BE)

스키마가 명세와 어긋난다면 다음 파일이 우선:

- `server/src/schemas.ts` — `AnalysisSchema`
- `server/src/ml/summarize-session.ts` — `SummarizeResponseSchema`
- `server/src/ml/regenerate-script.ts` — `RegenerateResponseSchema`

# CivilRelay AI / server

Express + TypeScript + Prisma 백엔드.
민원인 음성을 STT/분석해 정제 자막으로 접수인에 전달, 접수인 답변은 원본 그대로
민원인에게 전달, 종료 시 종합 분석 생성.

## 스택

- Node 20+ / TypeScript / Express + **`ws`** (WebSocket)
- **Prisma** (Postgres, User/Session/Turn/Analysis + SessionEvent/Note/Escalation/Feedback)
- **Google Cloud Storage** (음성 파일)
- **Google Cloud Speech-to-Text** (BE에서 STT 직접 호출)
- **Firebase Admin** (ID 토큰 검증)
- ML 서비스 HTTP 호출 (Gemini는 ML 서비스 내부)
- zod (입력 + ML 응답 검증)

## 디렉토리

```
server/
├── prisma/schema.prisma
├── src/
│   ├── index.ts                HTTP + WebSocket 엔트리
│   ├── env.ts                  zod 환경변수
│   ├── prisma.ts               PrismaClient 싱글톤
│   ├── firebase.ts             firebase-admin 초기화
│   ├── errors.ts               ApiError + handler
│   ├── ids.ts                  ses_/tur_/ana_/evt_/nte_/esc_/fbk_
│   ├── types.ts, schemas.ts    Json 필드 + zod 스키마
│   ├── thresholds.ts           누적 위협/분포 계산
│   ├── i18n.ts                 영어 enum ↔ ko/ja 라벨
│   ├── fallback.ts             LLM 실패 시 기본 Analysis
│   ├── stt.ts                  GCP Speech-to-Text 래퍼
│   ├── storage.ts              GCS 업로드
│   ├── events.ts               pub/sub + SessionEvent 영속화
│   ├── middleware/auth.ts      Firebase 토큰 검증
│   ├── ml/                     ML HTTP 클라이언트
│   │   ├── analyze-turn.ts
│   │   ├── summarize-session.ts
│   │   └── regenerate-script.ts
│   ├── services/
│   │   ├── sessions.ts         create / list / status / access
│   │   ├── turns.ts            addCallerTurn / addAgentTurn
│   │   ├── summary.ts          endSession + getCachedSummary + agent health
│   │   ├── transcript.ts       raw|clean|both view
│   │   ├── events.ts           DB 이벤트 조회
│   │   ├── notes.ts            메모
│   │   ├── escalations.ts      상급자 호출/종료/법적대응
│   │   ├── feedback.ts         AI 결과 피드백
│   │   └── analytics.ts        agent health, admin analytics
│   ├── routes/
│   │   ├── sessions.ts         POST/GET/PATCH status/end/summary/events
│   │   ├── turns.ts            POST /sessions/:id/turns
│   │   ├── agent-turns.ts      /agent-turns + /agent-audio
│   │   ├── transcript.ts
│   │   ├── scripts.ts          /turns/:id/scripts/regenerate
│   │   ├── escalations.ts, notes.ts, feedback.ts
│   │   ├── agents.ts           /agents/:id/health
│   │   └── admin.ts            /admin/analytics
│   └── ws/
│       ├── index.ts            upgrade 라우팅 + Firebase token 검증
│       ├── caller-audio.ts     audio.chunk → 버퍼 → STT → addCallerTurn
│       ├── agent-events.ts     세션 모든 이벤트 구독
│       ├── caller-events.ts    민원인 가시 이벤트만 필터링
│       └── signaling.ts        WebRTC 시그널 패스스루
└── .env.example
```

## 인증

- 모든 REST: `Authorization: Bearer <firebase-id-token>`
- 모든 WS: `?token=<firebase-id-token>` 쿼리

서버는 token 검증 + User upsert → `req.user` / `ws.ctx.userId` 채움.

## 실행

```bash
cd server
npm install
cp .env.example .env                     # 값 채우기 (실제 secret은 .env에만)
npm run prisma:generate
npm run prisma:migrate -- --name init    # 첫 마이그레이션
npm run dev                              # http://localhost:4000
```

## Swagger 테스트용 토큰

Firebase Auth ID 토큰을 직접 발급하는 스크립트:

```powershell
# .env에 FIREBASE_WEB_API_KEY 추가 (Firebase Console > Project Settings > General > Web API Key)

# 기본 (uid=agent_test_001, role=AGENT)
npm run gen-token

# 관리자 토큰 (SUPERVISOR/ADMIN endpoint 테스트용)
npm run gen-token -- --uid admin_001 --role ADMIN

# 슬랙/메모에 토큰만 복사하려면 stdout만 캡처
npm run gen-token | Set-Clipboard
```

동작:
1. Firebase Auth에 user 없으면 생성
2. Prisma User 테이블에 upsert (요청한 role)
3. custom token → ID token 교환 → stdout에 출력

Swagger UI 우측 상단 `Authorize` → `Bearer <발급된 토큰>` 붙여넣으면 모든 endpoint에 적용됨. **만료 ~1시간.**

## API 문서 / API docs

- **Swagger UI**: http://localhost:4000/docs — REST 엔드포인트 인터랙티브 문서
- **OpenAPI JSON**: http://localhost:4000/openapi.json — Postman/Insomnia로 import
- **WebSocket**: [`../docs/websocket.md`](../docs/websocket.md) — 3 WS 채널 메시지 포맷 (OpenAPI는 WS 지원 안 함)

OpenAPI는 `src/openapi/`에서 zod 스키마를 기반으로 자동 생성됩니다. 새 endpoint를 추가하면 `src/openapi/paths.ts`에 등록도 잊지 마세요.

## REST endpoints

모두 `Authorization: Bearer …` 필요.

| Method | Path |
|---|---|
| GET    | /health / /api/health |
| POST   | /api/sessions |
| GET    | /api/sessions |
| GET    | /api/sessions/:id |
| PATCH  | /api/sessions/:id/status |
| PATCH  | /api/sessions/:id/end |
| GET    | /api/sessions/:id/summary |
| GET    | /api/sessions/:id/transcript?view=raw\|clean\|both |
| GET    | /api/sessions/:id/events |
| POST   | /api/sessions/:id/turns                  (speaker=caller\|agent) |
| POST   | /api/sessions/:id/agent-turns |
| POST   | /api/sessions/:id/agent-audio |
| POST   | /api/sessions/:id/escalations  / GET |
| POST   | /api/sessions/:id/notes        / GET |
| POST   | /api/sessions/:id/feedback |
| POST   | /api/turns/:turnId/scripts/regenerate |
| GET    | /api/agents/:agentId/health |
| GET    | /api/admin/analytics            (SUPERVISOR/ADMIN) |

## WebSocket endpoints

| Path | 방향 |
|---|---|
| `/ws/sessions/:id/caller-audio?token=…` | 민원인 → 서버 (audio.chunk / audio.end) |
| `/ws/sessions/:id/agent-events?token=…` | 서버 → 접수인 (caption.final / risk.update / threshold.* / summary.update / agent.audio.ready / session.* / error) |
| `/ws/sessions/:id/caller-events?token=…` | 서버 → 민원인 (agent.audio.ready / session.* / error) |
| `/ws/sessions/:id/signaling?token=…` | WebRTC 시그널 양방향 (선택) |

이벤트 wire 포맷은 dot.case (`caption.final`), DB enum은 SCREAMING_SNAKE (`CAPTION_FINAL`). 변환은 `src/events.ts`.

## enum 값 (응답 포맷)

- `speaker`: `caller` | `agent` (소문자 wire)
- `emotion`: `ANGER` `FRUSTRATION` `CYNICISM` `CONFUSION` `CALM`
- `intent`: `LEGITIMATE_COMPLAINT` `VENT` `THREAT` `INSULT` `INQUIRY`
- `level` (ActionLevel): `NORMAL` `CAUTION` `ESCALATE` `TERMINATE_ALLOWED` `LEGAL_ACTION`
- `trend`: `UP` `DOWN` `STABLE`
- `classification`: `A` `B` `C` `D` `E`
- `status`: `CREATED` `WAITING` `ACTIVE` `PAUSED` `ENDING` `ENDED` `FAILED`
- `mode`: `CAPTION_RELAY` `TEXT_ONLY` `DEMO`
- `recommended_action.scripts` 키: **한국어** `공감` `단호` `위로` (명세 §2.3)
- `regenerate-script` 의 `tone`: **한국어** `공감` `단호` `위로`

FE 표시 변환은 `src/i18n.ts` (ko/ja 라벨).

## ML 서비스 계약

```
POST {ML_SERVICE_URL}/analyze
  body: { text, context: { recent_threats[], cumulative_threat, total_turns, language } }
  resp: AnalysisSchema (refined, metrics, summary, classification, preserved_facts, removed_expressions, abuse_types, confidence, recommended_action)

POST {ML_SERVICE_URL}/summarize
  body: { turns: [{ seq, speaker, text, classification?, threat_level? }], cumulative_threat, language }
  resp: { final_classification, final_action, core_demands[], agent_response_summary[], legal_basis_keys[] }

POST {ML_SERVICE_URL}/regenerate-script
  body: { turn_id, raw_text, tone (공감|단호|위로), additional_context? }
  resp: { script }
```

## 사람이 해야 하는 일

### 보안
- [ ] `.env.example`에서 실제 secret 제거하고 placeholder로 복구. 실제 값은 `.env`에만.
- [ ] git 히스토리에 secret이 들어갔다면 → service account 키/DB 비밀번호 재발급.

### GCP
- [x] GCS 버킷 `mental-guard-voice-record` 생성
- [ ] bucket IAM에 `allUsers : Storage Object Viewer` 부여 (public URL용)
- [ ] **Speech-to-Text API 활성화** (Console > APIs & Services > Enable Speech-to-Text)
- [ ] Service account에 `Cloud Speech Client` 역할 추가 (Storage 권한 외)

### Firebase
- [x] Project + Service account 키
- [ ] Auth Sign-in 방법 활성화 (FE와 협의)

### Prisma
```bash
npm run prisma:migrate -- --name init
# 이후 스키마 변경마다
npm run prisma:migrate -- --name <changes>
```

### ML 팀
- [ ] `/analyze`, `/summarize`, `/regenerate-script` 3개 endpoint 구현
- [ ] LLM 응답에 새 필드(`preserved_facts`, `removed_expressions`, `abuse_types`, `confidence`) 포함
- [ ] `agent_response_summary` 추가

### BE 내부 후속
- [ ] `services/summary.ts` `LEGAL_BASIS_MAP` 채우기
- [ ] `services/summary.ts` `findRepeatCaller` 실제 매칭 로직
- [ ] STT가 음성 1분 초과면 `longRunningRecognize`로 교체 (`src/stt.ts`)
- [ ] WebSocket 멀티 인스턴스 운영 시 EventEmitter → Redis pub/sub 교체

### FE 협의
- [ ] Firebase Auth SDK로 ID 토큰 획득 (REST는 Bearer, WS는 ?token=)
- [ ] WS 3채널: 민원인 화면은 caller-audio (send) + caller-events (recv), 접수인 화면은 agent-events (recv)
- [ ] i18n 라벨 (`src/i18n.ts` 참고)
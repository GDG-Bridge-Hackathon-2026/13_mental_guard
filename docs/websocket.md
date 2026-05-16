# WebSocket API

OpenAPI 3.x는 WebSocket을 공식 지원하지 않아 `/docs` Swagger UI에는 포함되지 않습니다.
WebSocket 채널은 모두 이 문서를 참조하세요.

> All WebSocket channels are documented here because OpenAPI 3.x does not natively
> describe WebSocket protocols. See the REST API at `/docs` for HTTP endpoints.

---

## 공통 / Common

| 항목 | 값 |
|---|---|
| **Base** | `ws://localhost:4000` (또는 VM/배포 호스트) |
| **인증** | 쿼리스트링 `?token=<firebase-id-token>` — REST의 Bearer와 동일한 Firebase ID 토큰 |
| **포맷** | UTF-8 JSON 메시지. 한 메시지에 하나의 JSON 객체 |
| **이벤트 wire 포맷** | dot.case (`caption.final`, `risk.update`, …) |
| **권한** | AGENT는 자기 세션만, SUPERVISOR/ADMIN은 모든 세션 |

| Field | Value |
|---|---|
| **Base** | `ws://localhost:4000` (or your VM/deploy host) |
| **Auth** | Query `?token=<firebase-id-token>` — same Firebase ID token as REST |
| **Format** | One UTF-8 JSON object per message |
| **Event wire format** | dot.case (`caption.final`, `risk.update`, …) |
| **Access** | AGENT sees only own sessions, SUPERVISOR/ADMIN see all |

### Close codes

| Code | Reason |
|---|---|
| 1000 | Normal closure |
| 4001 | Invalid/missing token |
| 4003 | Forbidden (다른 agent의 세션) |
| 4004 | Session not found |

---

## 1. `WS /ws/sessions/:id/caller-audio?token=…`

민원인 브라우저 → 서버. 마이크 청크를 보냄.
Caller browser → server. Sends mic chunks.

### Client → Server

#### `audio.chunk`

음성 청크 1개. 서버는 메모리에 버퍼링.
Single audio chunk. The server buffers it in memory.

```json
{
  "type": "audio.chunk",
  "seq": 12,
  "mime_type": "audio/webm",
  "data": "<base64-encoded-audio>",
  "timestamp": "2026-05-16T15:01:00.123Z"
}
```

#### `audio.end`

발화 종료. 서버는 누적 버퍼를 GCP STT로 보내고, ML `/analyze`까지 돌린 뒤
`agent-events` 채널로 `caption.final`을 발행.
End of utterance. The server runs GCP STT on the accumulated buffer, then
ML `/analyze`, and emits `caption.final` on the `agent-events` channel.

```json
{
  "type": "audio.end",
  "language_hint": "ko",
  "duration_ms": 5240,
  "timestamp": "2026-05-16T15:01:05.000Z"
}
```

### Server → Client

#### `audio.received`

각 chunk 수신 ack.
ACK for each received chunk.

```json
{ "type": "audio.received", "seq": 12 }
```

#### `error`

STT/분석 실패 등. Turn은 fallback Analysis로라도 저장됨.
STT/analysis failure. The turn is still persisted with a fallback Analysis.

```json
{
  "type": "error",
  "error": { "code": "STT_FAILED", "message": "..." }
}
```

---

## 2. `WS /ws/sessions/:id/agent-events?token=…`

서버 → 접수인 브라우저. 세션의 모든 이벤트를 그대로 전달.
Server → agent browser. Streams **all** events of the session.

이 채널은 듣기 전용 (서버가 보냄). 보낸 메시지는 무시됨.
Read-only channel. Anything the client sends is ignored.

### Server → Agent

#### `caption.partial`

(현재 미구현. 향후 streaming STT 도입 시 사용)
*(Not implemented yet. Reserved for streaming STT later.)*

```json
{
  "type": "caption.partial",
  "session_id": "session_001",
  "turn_id": "turn_temp_001",
  "raw_partial": "...",
  "clean_partial": "...",
  "latency_ms": 1300,
  "timestamp": "..."
}
```

#### `caption.final`

한 턴이 확정됨. UI에 자막 카드를 그릴 시점.
A turn is finalized. Time to render the caption card.

```json
{
  "id": "evt_xxxxxxxx",
  "session_id": "session_001",
  "type": "caption.final",
  "payload": {
    "turn": { /* TurnOutput */ },
    "analysis": {
      "threat_level": 3,
      "emotion": "ANGER",
      "core_demand": "처리 지연 사유 확인",
      "classification": "B",
      "recommended_action": {
        "level": "CAUTION",
        "scripts": {
          "공감": "...",
          "단호": "...",
          "위로": "..."
        },
        "legal_basis": null
      }
    }
  },
  "timestamp": "2026-05-16T15:01:03.000Z"
}
```

> scripts 키는 **한국어 고정** (`공감` / `단호` / `위로`).
> The `scripts` keys are **fixed Korean** values.

#### `risk.update`

누적 위협 변화. 게이지 UI 업데이트용.
Cumulative threat update. For gauge UI updates.

```json
{
  "type": "risk.update",
  "payload": {
    "cumulative_threat": 4.1,
    "trend": "UP",
    "threshold_triggered": "WARNING"
  }
}
```

#### `threshold.warning` / `threshold.terminate_allowed`

```json
{
  "type": "threshold.warning",
  "payload": {
    "level": "WARNING",
    "message": "위험도가 높아졌습니다. 상급자 호출을 고려하세요.",
    "reason": "cumulative_threat >= 4.0"
  }
}
```

#### `summary.update`

세션 진행 중 누적 요약 갱신. (현재는 종료 시점에만 발생)
Running summary update. (Currently emitted only at session end.)

#### `session.status` / `session.paused` / `session.ended`

세션 라이프사이클 변화.
Session lifecycle changes.

```json
{
  "type": "session.status",
  "payload": { "status": "ACTIVE", "message": "상담이 진행 중입니다." }
}
```

#### `agent.audio.ready`

접수인 음성 업로드 직후 발행. (agent-events 채널에도 같이 흐름)
Emitted right after an agent audio upload. (Also flows on this channel.)

---

## 3. `WS /ws/sessions/:id/caller-events?token=…`

서버 → 민원인 브라우저. **민원인이 봐도 되는 이벤트만** 필터링.
Server → caller browser. Filters to events that the **caller is allowed to see**.

가시 이벤트 / Visible events:

- `agent.audio.ready` — 접수인 음성 재생 트리거
- `session.status` / `session.paused` / `session.ended`
- `error`

```json
{
  "type": "agent.audio.ready",
  "payload": {
    "turn_id": "turn_002",
    "audio_url": "https://storage.googleapis.com/.../voice/.../turn_002.webm"
  },
  "timestamp": "2026-05-16T15:01:08.000Z"
}
```

---

## 4. `WS /ws/sessions/:id/signaling?token=…` *(선택 / optional)*

WebRTC peer 간 SDP/ICE 메시지 패스스루.
Pass-through for WebRTC SDP/ICE messages between peers in the same session.

서버는 메시지 내용을 해석하지 않고, 같은 세션의 다른 peer들에게 그대로 전달.
The server does not interpret the content — it broadcasts to all other peers in the same room.

```json
{ "type": "offer", "sdp": "..." }
{ "type": "answer", "sdp": "..." }
{ "type": "ice-candidate", "candidate": "..." }
```

---

## 클라이언트 예시 / Client example (브라우저)

```ts
const token = await firebaseUser.getIdToken();
const sessionId = 'ses_xxxxxxxx';

// 접수인 화면: 이벤트 구독
const events = new WebSocket(
  `ws://localhost:4000/ws/sessions/${sessionId}/agent-events?token=${token}`
);
events.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  if (evt.type === 'caption.final') renderCaption(evt.payload);
  if (evt.type === 'risk.update') updateGauge(evt.payload);
};

// 민원인 화면: 마이크 청크 전송
const audio = new WebSocket(
  `ws://localhost:4000/ws/sessions/${sessionId}/caller-audio?token=${token}`
);
mediaRecorder.ondataavailable = async (e) => {
  const data = await blobToBase64(e.data);
  audio.send(JSON.stringify({
    type: 'audio.chunk', seq: seq++,
    mime_type: 'audio/webm', data,
    timestamp: new Date().toISOString(),
  }));
};
// VAD가 발화 종료를 감지하면
audio.send(JSON.stringify({ type: 'audio.end', duration_ms: dur }));
```

---

## 이벤트 영속화 / Persistence

WebSocket으로 흘러간 모든 이벤트는 `SessionEvent` 테이블에 저장되고
`GET /api/sessions/:id/events`로도 조회 가능합니다.
All events streamed over WebSocket are also persisted to the `SessionEvent` table and
queryable via `GET /api/sessions/:id/events`.

연결이 끊겼던 시간대의 이벤트는 REST로 백필하세요.
Use the REST endpoint to backfill events from any disconnected period.
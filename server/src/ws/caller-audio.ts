// 민원인 음성 청크 수신 → GCP streamingRecognize로 실시간 STT.
//
// 발화 단위 정책 (GCP 5분 제한 자연 회피):
//   - 첫 audio.chunk 도착 시 새 streaming session open
//   - 각 chunk는 GCP에 실시간 push + 로컬 버퍼에도 보관 (GCS 업로드용)
//   - GCP가 interim 결과 보낼 때마다 caption.partial 이벤트 (DB 영속화 X)
//   - audio.end 시 GCP stream close → 최종 transcript 받아서 addCallerTurn 호출
//     addCallerTurn 내부에서 GCS 업로드 + ML 분석 + caption.final 이벤트
//   - 다음 발화 chunk는 즉시 새 stream을 열어 누적 (queue로 직렬 처리)

import type { WebSocket } from 'ws';
import type { WsContext } from './index.js';
import { addCallerTurn } from '../services/turns.js';
import { createTranscribeStream, type StreamingHandle } from '../stt.js';
import { emit } from '../events.js';
import { EventType, Language } from '@prisma/client';

interface ChunkMsg {
  type: 'audio.chunk';
  seq: number;
  mime_type?: string;
  data: string;
  timestamp?: string;
}
interface EndMsg {
  type: 'audio.end';
  language_hint?: 'ko' | 'ja' | 'auto';
  duration_ms?: number;
  timestamp?: string;
}
type Incoming = ChunkMsg | EndMsg;

interface ActiveUtterance {
  stream: StreamingHandle;
  audioChunks: Buffer[];
  mime: string;
  startedAt: number;
}

function langFromHint(hint?: 'ko' | 'ja' | 'auto'): Language {
  return hint === 'ko' ? Language.KO : hint === 'ja' ? Language.JA : Language.AUTO;
}

export function handleCallerAudio(ws: WebSocket, ctx: WsContext) {
  let active: ActiveUtterance | null = null;
  let mime = 'audio/webm';
  let queue: Promise<void> = Promise.resolve();
  let closed = false;

  const send = (payload: unknown) => {
    if (!closed && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  };

  const openUtterance = (langHint?: 'ko' | 'ja' | 'auto'): ActiveUtterance => {
    const stream = createTranscribeStream({ language_hint: langFromHint(langHint) });

    stream.onPartial((text) => {
      // 영속화 X — interim은 폭주할 수 있으니 메모리 버스로만 전파
      emit(
        ctx.sessionId,
        EventType.CAPTION_PARTIAL,
        { raw_partial: text, timestamp: new Date().toISOString() },
        { persist: false }
      ).catch((e) => console.error('[caller-audio partial emit]', e));
    });

    stream.onError((err) => {
      console.warn('[caller-audio] stt stream error', err);
      send({
        type: 'error',
        error: { code: 'STT_FAILED', message: err.message ?? String(err) },
      });
    });

    return { stream, audioChunks: [], mime, startedAt: Date.now() };
  };

  ws.on('message', (raw) => {
    let msg: Incoming;
    try {
      msg = JSON.parse(raw.toString()) as Incoming;
    } catch {
      send({ type: 'error', error: { code: 'INVALID_INPUT', message: 'invalid json' } });
      return;
    }

    if (msg.type === 'audio.chunk') {
      try {
        if (msg.mime_type) mime = msg.mime_type;
        if (!active) active = openUtterance(); // 첫 chunk면 새 발화 시작
        const buf = Buffer.from(msg.data, 'base64');
        active.audioChunks.push(buf);
        active.stream.write(buf);
        send({ type: 'audio.received', seq: msg.seq });
      } catch (e) {
        send({
          type: 'error',
          error: { code: 'INVALID_INPUT', message: `chunk failed: ${String(e)}` },
        });
      }
      return;
    }

    if (msg.type === 'audio.end') {
      if (!active) {
        send({ type: 'error', error: { code: 'INVALID_INPUT', message: 'no active utterance' } });
        return;
      }
      const u = active;
      active = null; // 다음 발화의 chunk는 즉시 새 stream으로

      const langHint = langFromHint(msg.language_hint);
      const explicitDuration = msg.duration_ms;

      queue = queue
        .then(async () => {
          if (closed) return;
          try {
            // GCP stream close + 최종 transcript 수신
            const result = await u.stream.close();
            const audio = Buffer.concat(u.audioChunks);
            const durationMs = explicitDuration ?? Date.now() - u.startedAt;

            // 이미 STT 끝났으므로 prerecorded_text로 전달 — addCallerTurn 안에서 STT 재호출 안 함
            await addCallerTurn(ctx.sessionId, {
              type: 'voice',
              audio,
              mime: u.mime,
              language_hint: langHint,
              duration_ms: durationMs,
              prerecorded_text: result.text,
              prerecorded_confidence: result.confidence,
            });
            // caption.final / risk.update 등은 addCallerTurn이 emit
          } catch (e) {
            console.error('[caller-audio process]', e);
            send({
              type: 'error',
              error: {
                code: 'STT_FAILED',
                message: e instanceof Error ? e.message : String(e),
              },
            });
          }
        })
        .catch((e) => console.error('[ws caller-audio queue]', e));
    }
  });

  const cleanup = () => {
    closed = true;
    if (active) {
      active.stream.abort();
      active = null;
    }
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

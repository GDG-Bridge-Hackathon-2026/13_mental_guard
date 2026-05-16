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
  language_hint?: 'ko' | 'ja' | 'en' | 'auto';
  duration_ms?: number;
  timestamp?: string;
}
type Incoming = ChunkMsg | EndMsg;

interface ActiveUtterance {
  stream: StreamingHandle | null;
  streamError: Error | null;
  audioChunks: Buffer[];
  mime: string;
  startedAt: number;
  lastSeq: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const STALE_CHUNK_GUARD_MS = 1000;
const IDLE_UTTERANCE_TIMEOUT_MS = 30_000;

function langFromHint(hint?: 'ko' | 'ja' | 'en' | 'auto'): Language {
  return hint === 'ko'
    ? Language.KO
    : hint === 'ja'
      ? Language.JA
      : hint === 'en'
        ? Language.EN
        : Language.AUTO;
}

function isAudioTimeoutError(err: Error): boolean {
  const maybeCode = (err as Error & { code?: unknown }).code;
  return maybeCode === 11 || /Audio Timeout Error/i.test(err.message);
}

export function handleCallerAudio(ws: WebSocket, ctx: WsContext) {
  let active: ActiveUtterance | null = null;
  let mime = 'audio/webm';
  let queue: Promise<void> = Promise.resolve();
  let closed = false;
  let staleChunkGuardUntil = 0;
  let ignoreAllChunksUntil = 0;

  const send = (payload: unknown) => {
    if (!closed && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  };

  const clearIdleTimer = (utterance: ActiveUtterance) => {
    if (!utterance.idleTimer) return;
    clearTimeout(utterance.idleTimer);
    utterance.idleTimer = null;
  };

  const scheduleIdleCleanup = (utterance: ActiveUtterance) => {
    clearIdleTimer(utterance);
    utterance.idleTimer = setTimeout(() => {
      if (active !== utterance) return;
      console.warn('[caller-audio] audio.end not received; dropping idle utterance');
      utterance.stream?.abort();
      active = null;
      staleChunkGuardUntil = Date.now() + STALE_CHUNK_GUARD_MS;
      send({
        type: 'error',
        error: {
          code: 'AUDIO_TIMEOUT',
          message: 'audio.end not received before idle timeout',
        },
      });
    }, IDLE_UTTERANCE_TIMEOUT_MS);
  };

  const openUtterance = (langHint?: 'ko' | 'ja' | 'en' | 'auto'): ActiveUtterance => {
    const hintedLanguage = langFromHint(langHint);
    const stream = createTranscribeStream({
      language_hint:
        ctx.sessionLanguage === Language.AUTO ? hintedLanguage : ctx.sessionLanguage,
    });
    const utterance: ActiveUtterance = {
      stream,
      streamError: null,
      audioChunks: [],
      mime,
      startedAt: Date.now(),
      lastSeq: 0,
      idleTimer: null,
    };

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
      if (isAudioTimeoutError(err)) {
        console.info('[caller-audio] streaming STT timed out; falling back to batch STT on audio.end');
      } else {
        console.warn('[caller-audio] stt stream error', err);
      }
      utterance.streamError = err;
      utterance.stream = null;
      stream.abort();
    });

    return utterance;
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
        if (!Number.isInteger(msg.seq) || msg.seq <= 0 || typeof msg.data !== 'string') {
          throw new Error('invalid audio chunk');
        }
        if (!active && Date.now() < ignoreAllChunksUntil) {
          send({ type: 'audio.ignored', seq: msg.seq, reason: 'audio.end already received' });
          return;
        }
        if (!active && Date.now() < staleChunkGuardUntil && msg.seq > 1) {
          send({ type: 'audio.ignored', seq: msg.seq, reason: 'late chunk after audio.end' });
          return;
        }
        if (msg.mime_type) mime = msg.mime_type;
        if (!active) active = openUtterance(); // 첫 chunk면 새 발화 시작
        const buf = Buffer.from(msg.data, 'base64');
        if (buf.length === 0) throw new Error('empty audio chunk');
        active.audioChunks.push(buf);
        active.lastSeq = Math.max(active.lastSeq, msg.seq);
        scheduleIdleCleanup(active);
        active.stream?.write(buf);
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
        ignoreAllChunksUntil = Date.now() + STALE_CHUNK_GUARD_MS;
        send({ type: 'error', error: { code: 'NO_ACTIVE_UTTERANCE', message: 'no active utterance' } });
        return;
      }
      const u = active;
      active = null; // 다음 발화의 chunk는 즉시 새 stream으로
      clearIdleTimer(u);
      staleChunkGuardUntil = Date.now() + STALE_CHUNK_GUARD_MS;

      const langHint = langFromHint(msg.language_hint);
      const explicitDuration = msg.duration_ms;

      queue = queue
        .then(async () => {
          if (closed) return;
          try {
            // GCP stream close + 최종 transcript 수신
            const audio = Buffer.concat(u.audioChunks);
            if (audio.length === 0) {
              send({
                type: 'error',
                error: { code: 'INVALID_INPUT', message: 'empty utterance audio' },
              });
              return;
            }
            const durationMs = explicitDuration ?? Date.now() - u.startedAt;
            let prerecorded: { text: string; confidence: number | null } | undefined;

            if (u.stream) {
              try {
                const result = await u.stream.close();
                prerecorded = { text: result.text, confidence: result.confidence };
              } catch (e) {
                console.warn('[caller-audio] streaming STT close failed; falling back to batch STT', e);
              }
            } else if (u.streamError) {
              console.warn('[caller-audio] streaming STT unavailable; falling back to batch STT');
            }

            // If streaming STT succeeded, reuse it. Otherwise addCallerTurn runs batch STT.
            await addCallerTurn(ctx.sessionId, {
              type: 'voice',
              audio,
              mime: u.mime,
              language_hint: langHint,
              duration_ms: durationMs,
              ...(prerecorded
                ? {
                    prerecorded_text: prerecorded.text,
                    prerecorded_confidence: prerecorded.confidence ?? undefined,
                  }
                : {}),
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
      clearIdleTimer(active);
      active.stream?.abort();
      active = null;
    }
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

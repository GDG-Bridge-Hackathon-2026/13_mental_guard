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

  const enqueueUtterance = (
    utterance: ActiveUtterance,
    opts: { languageHint: Language; durationMs?: number; reason: 'audio.end' | 'idle_timeout' }
  ) => {
    queue = queue
      .then(async () => {
        if (closed) return;
        try {
          const audio = Buffer.concat(utterance.audioChunks);
          if (audio.length === 0) {
            send({
              type: 'error',
              error: { code: 'INVALID_INPUT', message: 'empty utterance audio' },
            });
            return;
          }

          const durationMs = opts.durationMs ?? Date.now() - utterance.startedAt;
          let prerecorded: { text: string; confidence: number | null } | undefined;

          if (utterance.stream) {
            try {
              const result = await utterance.stream.close();
              prerecorded = { text: result.text, confidence: result.confidence };
            } catch (e) {
              console.warn('[caller-audio] streaming STT close failed; falling back to batch STT', e);
            }
          } else if (utterance.streamError) {
            console.warn('[caller-audio] streaming STT unavailable; falling back to batch STT');
          }

          if (opts.reason === 'idle_timeout') {
            send({
              type: 'audio.implicit_end',
              reason: 'audio.end not received before idle timeout',
              last_seq: utterance.lastSeq,
            });
          }

          await addCallerTurn(ctx.sessionId, {
            type: 'voice',
            audio,
            mime: utterance.mime,
            language_hint: opts.languageHint,
            duration_ms: durationMs,
            ...(prerecorded
              ? {
                  prerecorded_text: prerecorded.text,
                  prerecorded_confidence: prerecorded.confidence ?? undefined,
                }
              : {}),
          });
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
  };

  const scheduleIdleCleanup = (utterance: ActiveUtterance) => {
    clearIdleTimer(utterance);
    utterance.idleTimer = setTimeout(() => {
      if (active !== utterance) return;
      active = null;
      staleChunkGuardUntil = Date.now() + STALE_CHUNK_GUARD_MS;

      if (utterance.audioChunks.length === 0) {
        console.warn('[caller-audio] audio.end not received; dropping empty idle utterance');
        utterance.stream?.abort();
        send({
          type: 'error',
          error: {
            code: 'AUDIO_TIMEOUT',
            message: 'audio.end not received before idle timeout',
          },
        });
        return;
      }

      console.warn('[caller-audio] audio.end not received; finalizing idle utterance');
      enqueueUtterance(utterance, {
        languageHint: ctx.sessionLanguage === Language.AUTO ? Language.AUTO : ctx.sessionLanguage,
        reason: 'idle_timeout',
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
      emit(
        ctx.sessionId,
        EventType.CAPTION_PARTIAL,
        { raw_partial: text, timestamp: new Date().toISOString() },
        { persist: false }
      ).catch((e) => console.error('[caller-audio partial emit]', e));
    });

    stream.onError((err) => {
      if (isAudioTimeoutError(err)) {
        console.info('[caller-audio] streaming STT timed out; falling back to batch STT on finalization');
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
        if (!active) active = openUtterance();

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

      const utterance = active;
      active = null;
      clearIdleTimer(utterance);
      staleChunkGuardUntil = Date.now() + STALE_CHUNK_GUARD_MS;

      enqueueUtterance(utterance, {
        languageHint: langFromHint(msg.language_hint),
        durationMs: msg.duration_ms,
        reason: 'audio.end',
      });
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

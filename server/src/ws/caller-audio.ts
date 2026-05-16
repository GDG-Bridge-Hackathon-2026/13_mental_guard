// 민원인 음성 청크 수신 → 메모리 버퍼링 → audio.end 시 STT → addCallerTurn (analyze + 이벤트 발행)

import type { WebSocket } from 'ws';
import type { WsContext } from './index.js';
import { addCallerTurn } from '../services/turns.js';
import { Language } from '@prisma/client';

interface ChunkMsg {
  type: 'audio.chunk';
  seq: number;
  mime_type?: string;
  data: string; // base64
  timestamp?: string;
}
interface EndMsg {
  type: 'audio.end';
  language_hint?: 'ko' | 'ja' | 'auto';
  duration_ms?: number;
  timestamp?: string;
}
type Incoming = ChunkMsg | EndMsg;

export function handleCallerAudio(ws: WebSocket, ctx: WsContext) {
  let chunks: Buffer[] = [];
  let mime = 'audio/webm';
  let processing = false;

  const reset = () => {
    chunks = [];
  };

  ws.on('message', async (raw) => {
    let msg: Incoming;
    try {
      msg = JSON.parse(raw.toString()) as Incoming;
    } catch {
      return send(ws, { type: 'error', error: { code: 'INVALID_INPUT', message: 'invalid json' } });
    }

    if (msg.type === 'audio.chunk') {
      try {
        const buf = Buffer.from(msg.data, 'base64');
        chunks.push(buf);
        if (msg.mime_type) mime = msg.mime_type;
        send(ws, { type: 'audio.received', seq: msg.seq });
      } catch {
        send(ws, { type: 'error', error: { code: 'INVALID_INPUT', message: 'invalid base64' } });
      }
      return;
    }

    if (msg.type === 'audio.end') {
      if (processing) return;
      if (chunks.length === 0) {
        send(ws, { type: 'error', error: { code: 'INVALID_INPUT', message: 'no audio chunks' } });
        return;
      }
      processing = true;
      const audio = Buffer.concat(chunks);
      reset();
      try {
        const langHint =
          msg.language_hint === 'ko'
            ? Language.KO
            : msg.language_hint === 'ja'
              ? Language.JA
              : Language.AUTO;
        await addCallerTurn(ctx.sessionId, {
          type: 'voice',
          audio,
          mime,
          language_hint: langHint,
          duration_ms: msg.duration_ms,
        });
        // 결과 이벤트(caption.final 등)는 agent-events 채널로 자동 전파됨
      } catch (e) {
        send(ws, {
          type: 'error',
          error: { code: 'STT_FAILED', message: String(e instanceof Error ? e.message : e) },
        });
      } finally {
        processing = false;
      }
    }
  });

  ws.on('close', () => reset());
}

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}
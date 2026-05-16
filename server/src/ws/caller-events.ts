// 민원인 화면용 이벤트 스트림.
// 민원인이 관심 있는 이벤트만 필터링 (agent.audio.ready, session.status, session.ended, error)

import type { WebSocket } from 'ws';
import type { WsContext } from './index.js';
import { subscribe } from '../events.js';

const CALLER_VISIBLE = new Set([
  'agent.audio.ready',
  'session.status',
  'session.paused',
  'session.ended',
  'error',
]);

export function handleCallerEvents(ws: WebSocket, ctx: WsContext) {
  const unsubscribe = subscribe(ctx.sessionId, (event) => {
    if (!CALLER_VISIBLE.has(event.type)) return;
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(event));
  });

  ws.on('close', () => unsubscribe());
  ws.on('error', () => unsubscribe());
}
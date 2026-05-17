// 접수인 화면용 이벤트 스트림.
// 세션의 모든 이벤트를 그대로 전달. caller 전용 이벤트(agent.audio.ready)도 일단 같이 보냄 — FE에서 필터링.

import type { WebSocket } from 'ws';
import type { WsContext } from './index.js';
import { subscribe } from '../events.js';

export function handleAgentEvents(ws: WebSocket, ctx: WsContext) {
  const unsubscribe = subscribe(ctx.sessionId, (event) => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(event));
  });

  ws.on('close', () => unsubscribe());
  ws.on('error', () => unsubscribe());
}
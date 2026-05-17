// WebRTC signaling 단순 패스스루.
// 같은 세션의 다른 peer들에게 offer/answer/ice-candidate 메시지를 forward.

import type { WebSocket } from 'ws';
import type { WsContext } from './index.js';

const rooms = new Map<string, Set<WebSocket>>();

export function handleSignaling(ws: WebSocket, ctx: WsContext) {
  const room = rooms.get(ctx.sessionId) ?? new Set<WebSocket>();
  room.add(ws);
  rooms.set(ctx.sessionId, room);

  ws.on('message', (raw) => {
    const data = raw.toString();
    for (const peer of room) {
      if (peer !== ws && peer.readyState === peer.OPEN) {
        peer.send(data);
      }
    }
  });

  const cleanup = () => {
    room.delete(ws);
    if (room.size === 0) rooms.delete(ctx.sessionId);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}
// WebSocket 라우팅. http server의 upgrade 이벤트에서 경로별 핸들러로 분기.
//
// 경로:
//   /ws/sessions/:id/caller-audio
//   /ws/sessions/:id/agent-events
//   /ws/sessions/:id/caller-events
//   /ws/sessions/:id/signaling
//
// 인증: ?token=<firebase-id-token> 쿼리. 검증 후 ws.userId/ws.sessionId 부착.

import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { firebaseAuth } from '../firebase.js';
import { prisma } from '../prisma.js';
import { handleCallerAudio } from './caller-audio.js';
import { handleAgentEvents } from './agent-events.js';
import { handleCallerEvents } from './caller-events.js';
import { handleSignaling } from './signaling.js';

export interface WsContext {
  sessionId: string;
  userId: string;
  channel: 'caller-audio' | 'agent-events' | 'caller-events' | 'signaling';
}

const PATH_RE = /^\/ws\/sessions\/([^/]+)\/(caller-audio|agent-events|caller-events|signaling)\/?$/;

export function attachWebSocket(server: import('node:http').Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const { pathname, searchParams } = new URL(req.url ?? '/', 'http://localhost');
      const m = PATH_RE.exec(pathname);
      if (!m) return reject(socket, 404, 'unknown ws path');

      const [, sessionId, channelRaw] = m;
      const channel = channelRaw as WsContext['channel'];

      // 인증
      const token = searchParams.get('token');
      if (!token) return reject(socket, 401, 'token query required');
      let userId: string;
      try {
        const decoded = await firebaseAuth.verifyIdToken(token);
        userId = decoded.uid;
      } catch {
        return reject(socket, 401, 'invalid token');
      }

      // 세션 존재 + 권한 (AGENT 본인 또는 SUPERVISOR/ADMIN)
      const session = await prisma.session.findUnique({
        where: { id: sessionId! },
        select: { agentId: true },
      });
      if (!session) return reject(socket, 404, 'session not found');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reject(socket, 401, 'user not provisioned');
      if (user.role === 'AGENT' && session.agentId !== userId) {
        return reject(socket, 403, 'forbidden');
      }

      const ctx: WsContext = { sessionId: sessionId!, userId, channel };
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, ctx);
      });
    } catch (e) {
      console.error('[ws upgrade]', e);
      reject(socket, 500, 'internal');
    }
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, ctx: WsContext) => {
    switch (ctx.channel) {
      case 'caller-audio':
        return handleCallerAudio(ws, ctx);
      case 'agent-events':
        return handleAgentEvents(ws, ctx);
      case 'caller-events':
        return handleCallerEvents(ws, ctx);
      case 'signaling':
        return handleSignaling(ws, ctx);
    }
  });

  return wss;
}

function reject(socket: Duplex, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\n\r\n`);
  socket.destroy();
}
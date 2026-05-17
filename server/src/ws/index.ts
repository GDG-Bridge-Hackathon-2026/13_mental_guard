// WebSocket 라우팅 + 인증.
//
// 인증 두 종류:
//   1. Firebase ID 토큰 (접수인/관리자) — agent-events 포함 모든 채널
//   2. caller 토큰 (민원인, Session.callerToken) — caller-audio/caller-events만

import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import type { Language } from '@prisma/client';
import { firebaseAuth } from '../firebase.js';
import { prisma } from '../prisma.js';
import { verifyCallerToken } from '../services/caller-token.js';
import { handleCallerAudio } from './caller-audio.js';
import { handleAgentEvents } from './agent-events.js';
import { handleCallerEvents } from './caller-events.js';
import { handleSignaling } from './signaling.js';

type Channel = 'caller-audio' | 'agent-events' | 'caller-events' | 'signaling';

export interface WsContext {
  sessionId: string;
  userId: string; // Firebase UID 또는 `caller:${sessionId}`
  scope: 'user' | 'caller';
  channel: Channel;
  sessionLanguage: Language;
}

const CALLER_ALLOWED_CHANNELS = new Set<Channel>(['caller-audio', 'caller-events']);
const PATH_RE = /^\/ws\/sessions\/([^/]+)\/(caller-audio|agent-events|caller-events|signaling)\/?$/;

export function attachWebSocket(
  server: import('node:http').Server,
  options: { allowedOrigins?: string[] | '*' } = {}
) {
  const wss = new WebSocketServer({ noServer: true });
  const allowedOrigins = options.allowedOrigins ?? '*';

  server.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      // origin 검사
      if (allowedOrigins !== '*') {
        const origin = req.headers.origin;
        if (origin && !allowedOrigins.includes(origin)) {
          return reject(socket, 403, 'origin not allowed');
        }
      }

      const { pathname, searchParams } = new URL(req.url ?? '/', 'http://localhost');
      const m = PATH_RE.exec(pathname);
      if (!m) return reject(socket, 404, 'unknown ws path');

      const [, sessionIdRaw, channelRaw] = m;
      const sessionId = sessionIdRaw!;
      const channel = channelRaw as Channel;

      const token = searchParams.get('token');
      if (!token) return reject(socket, 401, 'token query required');

      const auth = await authenticateWs(token, sessionId);
      if (!auth) return reject(socket, 401, 'invalid token');

      // 스코프 검증
      if (auth.scope === 'caller') {
        if (!CALLER_ALLOWED_CHANNELS.has(channel)) {
          return reject(socket, 403, 'caller token scope: caller-audio/caller-events only');
        }
      } else {
        // user 스코프: AGENT는 자기 세션만
        if (auth.role === 'AGENT' && auth.sessionAgentId !== auth.userId) {
          return reject(socket, 403, 'not your session');
        }
      }

      const ctx: WsContext = {
        sessionId,
        userId: auth.userId,
        scope: auth.scope,
        channel,
        sessionLanguage: auth.sessionLanguage,
      };
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

// ── 인증 ────────────────────────────────────────────────────────────────

interface UserAuth {
  scope: 'user';
  userId: string;
  role: 'AGENT' | 'SUPERVISOR' | 'ADMIN';
  sessionAgentId: string;
  sessionLanguage: Language;
}
interface CallerAuth {
  scope: 'caller';
  userId: string; // `caller:${sessionId}`
  sessionLanguage: Language;
}

async function authenticateWs(
  token: string,
  sessionId: string
): Promise<UserAuth | CallerAuth | null> {
  // (1) Firebase ID token 먼저
  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    const [user, session] = await Promise.all([
      prisma.user.findUnique({ where: { id: decoded.uid } }),
      prisma.session.findUnique({ where: { id: sessionId }, select: { agentId: true, language: true } }),
    ]);
    if (!user) return null;
    if (!session) return null;
    return {
      scope: 'user',
      userId: decoded.uid,
      role: user.role,
      sessionAgentId: session.agentId,
      sessionLanguage: session.language,
    };
  } catch {
    // fall through
  }

  // (2) caller 토큰
  const matched = await verifyCallerToken(token, sessionId);
  if (matched) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { language: true },
    });
    if (!session) return null;
    return { scope: 'caller', userId: `caller:${sessionId}`, sessionLanguage: session.language };
  }

  return null;
}

function reject(socket: Duplex, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\n\r\n`);
  socket.destroy();
}

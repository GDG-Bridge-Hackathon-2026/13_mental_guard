// 민원인 WS 접속용 단명 토큰.
// 디자인 노트는 memory의 project_caller_token.md 참조.

import { customAlphabet } from 'nanoid';
import { prisma } from '../prisma.js';
import { ApiError } from '../errors.js';

// URL-safe 32바이트 (~256bit entropy)
const tokenGen = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_',
  40
);

export const DEFAULT_TTL_SECONDS = 4 * 60 * 60; // 4시간
export const MAX_TTL_SECONDS = 24 * 60 * 60; // 24시간

export interface MintResult {
  token: string;
  expires_at: string;
}

export async function mintCallerToken(
  sessionId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<MintResult> {
  const ttl = Math.min(Math.max(ttlSeconds, 60), MAX_TTL_SECONDS);
  const token = tokenGen();
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await prisma.session.update({
    where: { id: sessionId },
    data: { callerToken: token, callerTokenExpiresAt: expiresAt },
  });

  return { token, expires_at: expiresAt.toISOString() };
}

/** WS 인증 경로에서 사용. 매칭 성공 시 sessionId 반환, 실패 시 null. */
export async function verifyCallerToken(
  token: string,
  expectedSessionId: string
): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: {
      id: expectedSessionId,
      callerToken: token,
      callerTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return session?.id ?? null;
}

export async function revokeCallerToken(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { callerToken: null, callerTokenExpiresAt: null },
  });
}

/** API 응답에서 ws 접속 URL을 만들어주는 헬퍼. */
export function buildWsUrls(opts: {
  protocol: 'http' | 'https';
  host: string;
  sessionId: string;
  token: string;
}) {
  const wsProto = opts.protocol === 'https' ? 'wss' : 'ws';
  const base = `${wsProto}://${opts.host}/ws/sessions/${opts.sessionId}`;
  const q = `?token=${encodeURIComponent(opts.token)}`;
  return {
    caller_audio: `${base}/caller-audio${q}`,
    caller_events: `${base}/caller-events${q}`,
  };
}

/** Express request에서 publicly-routable host/proto 추출 (X-Forwarded-* 고려). */
export function extractRequestOrigin(req: import('express').Request) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const protocol = (
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ?? req.protocol
  ) as 'http' | 'https';
  const host = (
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.get('host')!
  );
  return { protocol, host };
}

export function ttlOrDefault(input?: number) {
  if (!input || input <= 0) return DEFAULT_TTL_SECONDS;
  if (input > MAX_TTL_SECONDS) {
    throw new ApiError(400, 'INVALID_INPUT', `ttl_seconds exceeds max ${MAX_TTL_SECONDS}`);
  }
  return input;
}

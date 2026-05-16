import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { MintCallerTokenSchema } from '../schemas.js';
import {
  buildWsUrls,
  extractRequestOrigin,
  mintCallerToken,
  revokeCallerToken,
  ttlOrDefault,
} from '../services/caller-token.js';

export const callerTokenRouter = Router();

// POST /api/sessions/:id/caller-token — 발급/재발급
callerTokenRouter.post(
  '/sessions/:id/caller-token',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    const body = MintCallerTokenSchema.parse(req.body ?? {});
    const ttl = ttlOrDefault(body.ttl_seconds);
    const { token, expires_at } = await mintCallerToken(req.params.id, ttl);

    const { protocol, host } = extractRequestOrigin(req);
    const ws_urls = buildWsUrls({ protocol, host, sessionId: req.params.id, token });

    res.status(201).json({ token, expires_at, ws_urls });
  })
);

// DELETE /api/sessions/:id/caller-token — 즉시 폐기
callerTokenRouter.delete(
  '/sessions/:id/caller-token',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    await revokeCallerToken(req.params.id);
    res.status(204).end();
  })
);

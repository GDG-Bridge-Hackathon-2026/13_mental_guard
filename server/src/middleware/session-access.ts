import type { Session } from '@prisma/client';
import { ah } from '../utils/async-handler.js';
import { assertSessionAccess, getSession } from '../services/sessions.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** loadSession 미들웨어가 채우는, 경로 :id에 해당하는 Session row */
    targetSession?: Session;
  }
}

/**
 * `:id` 경로 변수로 세션 로드 + ownership 검증.
 * 라우트에서 `req.targetSession`으로 접근.
 *
 * 사용:
 *   router.patch('/:id/status', requireAuth, loadSession, ah(handler))
 */
export const loadSession = ah(async (req, _res, next) => {
  const s = await getSession(req.params.id);
  assertSessionAccess(s, req.user!);
  req.targetSession = s;
  next();
});

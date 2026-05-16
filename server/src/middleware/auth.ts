import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors.js';
import { firebaseAuth } from '../firebase.js';
import { prisma } from '../prisma.js';
import type { UserRole } from '@prisma/client';

export interface AuthedUser {
  id: string; // Firebase UID == User.id
  email: string | null;
  displayName: string | null;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthedUser;
  }
}

/**
 * Authorization: Bearer <firebase-id-token>
 * - 토큰 검증
 * - User 테이블 upsert (최초 로그인 시 auto-provision)
 * - req.user 채움
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authorization: Bearer <id-token> required');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'empty bearer token');

    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(token);
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'invalid or expired id token');
    }

    const user = await prisma.user.upsert({
      where: { id: decoded.uid },
      update: {
        email: decoded.email ?? undefined,
        displayName: decoded.name ?? undefined,
        photoUrl: decoded.picture ?? undefined,
      },
      create: {
        id: decoded.uid,
        email: decoded.email ?? null,
        displayName: decoded.name ?? null,
        photoUrl: decoded.picture ?? null,
      },
    });

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
    next();
  } catch (e) {
    next(e);
  }
};

/** SUPERVISOR/ADMIN 만 허용. requireAuth 이후에 사용. */
export const requireRole =
  (...allowed: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, 'UNAUTHORIZED', 'auth required'));
    if (!allowed.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', `role ${req.user.role} not allowed`));
    }
    next();
  };
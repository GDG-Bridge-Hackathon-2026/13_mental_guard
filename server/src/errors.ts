import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ALREADY_ENDED'
  | 'SESSION_NOT_ENDED'
  | 'TURN_NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AUDIO_UPLOAD_FAILED'
  | 'STT_FAILED'
  | 'LLM_FAILED'
  | 'LLM_INVALID_JSON'
  | 'STORAGE_FAILED'
  | 'WEBSOCKET_DISCONNECTED'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, retry_after: err.retryAfter },
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    });
  }
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'LIMIT_FILE_SIZE'
  ) {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'audio file exceeds 25MB' },
    });
  }
  console.error('[unhandled]', err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'internal server error' },
  });
};
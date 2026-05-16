// 공통 응답 빌더.

import type { z } from 'zod';
import { ErrorResponseSchema } from './schemas.js';

export const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

export const multipartContent = <T extends z.ZodTypeAny>(schema: T) => ({
  'multipart/form-data': { schema },
});

const errResp = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

export const CommonErrorResponses = {
  400: errResp('INVALID_INPUT — body/query validation failed'),
  401: errResp('UNAUTHORIZED — invalid or missing Firebase ID token'),
  403: errResp('FORBIDDEN — agent has no access to this session'),
  404: errResp('SESSION_NOT_FOUND / TURN_NOT_FOUND'),
  409: errResp('SESSION_ALREADY_ENDED / SESSION_NOT_ENDED'),
  500: errResp('INTERNAL / STT_FAILED / LLM_FAILED / STORAGE_FAILED'),
} as const;
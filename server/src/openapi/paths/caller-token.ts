import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

const CallerTokenResponse = z
  .object({
    token: z.string(),
    expires_at: z.string().datetime(),
    ws_urls: z.object({
      caller_audio: z.string(),
      caller_events: z.string(),
    }),
  })
  .openapi('CallerTokenResponse');

export function registerCallerToken(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/caller-token',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en(
      '민원인용 WS 접속 토큰 발급',
      'Issue caller-scope WS access token'
    ),
    description: ko_en(
      'Firebase 계정이 없는 민원인이 WS에 접속할 수 있도록 단명 토큰 발급. QR/링크로 전달. caller-audio, caller-events 채널만 허용.',
      'Issue a short-lived token for the caller (no Firebase account). Embed in QR/link. Allows only caller-audio and caller-events channels.'
    ),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: jsonContent(Sc.MintCallerTokenSchema) },
    },
    responses: {
      201: {
        description: 'Created',
        content: jsonContent(CallerTokenResponse),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/sessions/{id}/caller-token',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('caller 토큰 즉시 폐기', 'Revoke caller token immediately'),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      204: { description: 'No Content' },
      ...CommonErrorResponses,
    },
  });
}

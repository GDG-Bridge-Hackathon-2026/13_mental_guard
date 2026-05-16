import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerEscalations(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/escalations',
    tags: ['Escalations'],
    security: auth,
    summary: ko_en('상급자 호출/강제종료/법적대응 기록', 'Record supervisor call / terminate / legal action'),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: jsonContent(Sc.CreateEscalationInput) },
    },
    responses: {
      201: {
        description: 'Created',
        content: jsonContent(z.object({ escalation_id: z.string(), status: z.literal('created') })),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}/escalations',
    tags: ['Escalations'],
    security: auth,
    summary: ko_en('에스컬레이션 목록', 'List escalations'),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(z.object({ escalations: z.array(Sc.EscalationOutput) })),
      },
      ...CommonErrorResponses,
    },
  });
}

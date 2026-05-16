import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerAdmin(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/admin/analytics',
    tags: ['Admin'],
    security: auth,
    summary: ko_en('관리자 통계 (SUPERVISOR/ADMIN)', 'Admin analytics (SUPERVISOR/ADMIN only)'),
    request: {
      query: z.object({
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
        department: z.string().optional(),
        agent_id: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            total_sessions: z.number().int(),
            high_risk_sessions: z.number().int(),
            avg_threat: z.number(),
            filtered_expression_count: z.number().int(),
            top_intents: z.array(z.string()),
            classification_distribution: z.object({
              A: z.number().int(), B: z.number().int(), C: z.number().int(),
              D: z.number().int(), E: z.number().int(),
            }),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });
}

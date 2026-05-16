import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerAgents(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/agents/{agentId}/health',
    tags: ['Agents'],
    security: auth,
    summary: ko_en('접수인 보호 지표 (오늘)', "Agent today's protection metrics"),
    request: { params: z.object({ agentId: z.string() }) },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            agent_id: z.string(),
            today: z.object({
              sessions: z.number().int(),
              high_risk_sessions: z.number().int(),
              filtered_abuse_count: z.number().int(),
              recommended_break_minutes: z.number().int(),
            }),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });
}

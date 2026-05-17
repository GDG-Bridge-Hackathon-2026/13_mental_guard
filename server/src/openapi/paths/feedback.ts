import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerFeedback(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/feedback',
    tags: ['Feedback'],
    security: auth,
    summary: ko_en('AI 분석 결과 피드백', 'Submit feedback on AI analysis'),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: jsonContent(Sc.CreateFeedbackInput) },
    },
    responses: {
      201: {
        description: 'Created',
        content: jsonContent(z.object({ feedback_id: z.string(), status: z.literal('saved') })),
      },
      ...CommonErrorResponses,
    },
  });
}

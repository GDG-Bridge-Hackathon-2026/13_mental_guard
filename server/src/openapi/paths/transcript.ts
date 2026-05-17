import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerTranscript(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}/transcript',
    tags: ['Transcript'],
    security: auth,
    summary: ko_en('대화 transcript', 'Conversation transcript'),
    request: {
      params: z.object({ id: z.string() }),
      query: z.object({ view: z.enum(['raw', 'clean', 'both']).default('both') }),
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            session_id: z.string(),
            view: z.enum(['raw', 'clean', 'both']),
            transcript: z.array(
              z.object({
                seq: z.number().int(),
                speaker: z.enum(['caller', 'agent']),
                raw_text: z.string().optional(),
                displayed_text: z.string().nullable().optional(),
                timestamp: z.string().datetime(),
              })
            ),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });
}

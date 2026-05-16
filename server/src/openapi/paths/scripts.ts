import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerScripts(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/turns/{turnId}/scripts/regenerate',
    tags: ['Scripts'],
    security: auth,
    summary: ko_en('추천 응답 재생성', 'Regenerate suggested script'),
    description: ko_en(
      'tone은 한국어 고정 (공감/단호/위로).',
      "tone is fixed Korean: '공감' | '단호' | '위로'."
    ),
    request: {
      params: z.object({ turnId: z.string() }),
      body: { content: jsonContent(Sc.RegenerateScriptInput) },
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            script: z.string(),
            tone: z.enum(['공감', '단호', '위로']),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });
}

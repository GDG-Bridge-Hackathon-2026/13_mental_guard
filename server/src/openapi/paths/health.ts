import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerHealth(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    summary: ko_en('헬스체크', 'Health check'),
    responses: {
      200: { description: 'OK', content: jsonContent(z.object({ ok: z.boolean() })) },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/health',
    tags: ['Health'],
    summary: ko_en('헬스체크 (api prefix)', 'Health check (api prefix)'),
    responses: {
      200: { description: 'OK', content: jsonContent(z.object({ ok: z.boolean() })) },
    },
  });
}

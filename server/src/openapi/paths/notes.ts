import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerNotes(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/notes',
    tags: ['Notes'],
    security: auth,
    summary: ko_en('메모 작성', 'Create note'),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: jsonContent(Sc.CreateNoteInput) },
    },
    responses: {
      201: {
        description: 'Created',
        content: jsonContent(
          z.object({ note_id: z.string(), created_at: z.string().datetime() })
        ),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}/notes',
    tags: ['Notes'],
    security: auth,
    summary: ko_en('메모 목록', 'List notes'),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: 'OK', content: jsonContent(z.object({ notes: z.array(Sc.NoteOutput) })) },
      ...CommonErrorResponses,
    },
  });
}

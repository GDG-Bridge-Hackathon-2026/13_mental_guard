import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent, multipartContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerAgent(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/agent-turns',
    tags: ['Agent'],
    security: auth,
    summary: ko_en('접수인 답변 저장', "Save agent's answer"),
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          ...jsonContent(Sc.CreateAgentTurnTextInput),
          ...multipartContent(Sc.AgentTurnVoiceMultipart),
        },
      },
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            turn: Sc.TurnOutput,
            delivered_to_caller: z.boolean(),
            playback_event_id: z.string().nullable(),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/agent-audio',
    tags: ['Agent'],
    security: auth,
    summary: ko_en('접수인 음성 업로드 + 민원인 재생 이벤트', 'Upload agent audio + emit playback event'),
    description: ko_en(
      'WebRTC 대체용. 업로드 즉시 caller-events에 agent.audio.ready 발행.',
      'WebRTC replacement. Emits agent.audio.ready on caller-events.'
    ),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: multipartContent(Sc.AgentTurnVoiceMultipart) },
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            turn_id: z.string(),
            audio_url: z.string().url().nullable(),
            playback_event_id: z.string().nullable(),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });
}

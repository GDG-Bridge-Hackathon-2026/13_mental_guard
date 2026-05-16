import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent, multipartContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerTurns(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/turns',
    tags: ['Turns'],
    security: auth,
    summary: ko_en('발화 저장 + 분석 (caller/agent)', 'Save and analyze a turn (caller/agent)'),
    description: ko_en(
      'multipart 음성 또는 JSON 텍스트. speaker로 분기. caller면 STT→ML 분석→자막, agent면 저장+민원인 음성 전달 준비.',
      'Multipart audio or JSON text. Firebase tokens may submit caller/agent turns. Caller tokens may only submit caller turns for their session.'
    ),
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          ...jsonContent(Sc.CreateTurnTextInput),
          ...multipartContent(Sc.TurnVoiceMultipart),
        },
      },
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            turn: Sc.TurnOutput,
            analysis: Sc.AnalysisOutput.optional(),
            session_update: z
              .object({
                total_turns: z.number().int(),
                cumulative_threat: z.number(),
                classification_distribution: z.object({
                  A: z.number(), B: z.number(), C: z.number(), D: z.number(), E: z.number(),
                }),
                threshold_triggered: z.enum(['WARNING', 'TERMINATE_ALLOWED']).nullable(),
              })
              .optional(),
            delivered_to_caller: z.boolean().optional(),
            playback_event_id: z.string().nullable().optional(),
          })
        ),
      },
      413: {
        description: 'PAYLOAD_TOO_LARGE — audio > 25MB',
        content: jsonContent(Sc.ErrorResponseSchema),
      },
      ...CommonErrorResponses,
    },
  });
}

// 모든 REST 엔드포인트 OpenAPI 등록. 한·영 description 병기.

import './setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from './schemas.js';
import { CommonErrorResponses, jsonContent, multipartContent } from './responses.js';

const ko_en = (ko: string, en: string) => `**KO** ${ko}\n\n**EN** ${en}`;
const auth = [{ bearerAuth: [] }];

const sessionIdParam = {
  in: 'path' as const,
  name: 'id',
  required: true,
  schema: z.string(),
  description: ko_en('세션 ID (ses_xxxxxxxx)', 'Session ID (ses_xxxxxxxx)'),
};

const turnIdParam = {
  in: 'path' as const,
  name: 'turnId',
  required: true,
  schema: z.string(),
};

const agentIdParam = {
  in: 'path' as const,
  name: 'agentId',
  required: true,
  schema: z.string(),
};

export function registerPaths(registry: OpenAPIRegistry) {
  // ── Health ────────────────────────────────────────────────────────────
  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    summary: ko_en('헬스체크', 'Health check'),
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(z.object({ ok: z.boolean() })),
      },
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

  // ── Sessions ──────────────────────────────────────────────────────────
  registry.registerPath({
    method: 'post',
    path: '/api/sessions',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 생성', 'Create session'),
    description: ko_en(
      '새 상담 세션을 만든다. agent_id는 토큰에서 자동 추출.',
      'Create a new consultation session. agent_id is taken from the auth token.'
    ),
    request: {
      body: { content: jsonContent(Sc.CreateSessionInput) },
    },
    responses: {
      201: {
        description: ko_en('생성됨', 'Created'),
        content: jsonContent(z.object({ session: Sc.SessionOutput })),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/sessions',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 목록 조회', 'List sessions'),
    description: ko_en(
      'AGENT 권한은 자기 세션만 조회. SUPERVISOR/ADMIN은 agent_id 필터 사용 가능.',
      'AGENT only sees own sessions. SUPERVISOR/ADMIN can filter by agent_id.'
    ),
    request: {
      query: z.object({
        agent_id: z.string().optional(),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
        classification: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
        status: z
          .enum(['CREATED', 'WAITING', 'ACTIVE', 'PAUSED', 'ENDING', 'ENDED', 'FAILED'])
          .optional(),
        min_threat: z.coerce.number().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().nonnegative().default(0),
        sort: z.string().default('started_at:desc'),
      }),
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            sessions: z.array(Sc.SessionOutput),
            total: z.number().int(),
            limit: z.number().int(),
            offset: z.number().int(),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 상세 + 모든 턴/분석', 'Session detail with all turns and analyses'),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({
            session: Sc.SessionOutput,
            turns: z.array(Sc.TurnOutput),
            analyses: z.array(Sc.AnalysisOutput),
          })
        ),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/sessions/{id}/status',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 상태 변경', 'Change session status'),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: jsonContent(Sc.PatchStatusInput) },
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(z.object({ session: Sc.SessionOutput })),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/sessions/{id}/end',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 종료 + 종합 요약 생성', 'End session and generate summary'),
    description: ko_en(
      '멱등. 이미 종료된 세션이면 캐시된 summary 반환.',
      'Idempotent. Returns the cached summary if the session is already ended.'
    ),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: jsonContent(Sc.EndSessionInput) },
    },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(z.object({ summary: Sc.SessionSummaryOutput })),
      },
      ...CommonErrorResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}/summary',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('캐시된 종합 요약 조회', 'Get cached summary'),
    description: ko_en(
      '세션이 종료된 상태에서만 동작. 그 외엔 409.',
      'Only works after the session has ended; returns 409 otherwise.'
    ),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(z.object({ summary: Sc.SessionSummaryOutput })),
      },
      ...CommonErrorResponses,
    },
  });

  // ── Transcript & Events ───────────────────────────────────────────────
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

  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}/events',
    tags: ['Transcript'],
    security: auth,
    summary: ko_en('세션 이벤트 로그', 'Session event log'),
    description: ko_en(
      'WebSocket으로 흘러간 모든 이벤트가 영속화돼 있음.',
      'All events streamed via WebSocket are persisted here.'
    ),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'OK',
        content: jsonContent(
          z.object({ events: z.array(Sc.SessionEventOutput) })
        ),
      },
      ...CommonErrorResponses,
    },
  });

  // ── Turns ─────────────────────────────────────────────────────────────
  registry.registerPath({
    method: 'post',
    path: '/api/sessions/{id}/turns',
    tags: ['Turns'],
    security: auth,
    summary: ko_en('발화 저장 + 분석 (caller/agent)', 'Save and analyze a turn (caller/agent)'),
    description: ko_en(
      'multipart 음성 또는 JSON 텍스트. speaker로 분기. caller면 STT→ML 분석→자막, agent면 저장+민원인 음성 전달 준비.',
      'Multipart audio or JSON text. Branches on speaker: caller goes through STT + ML analysis + caption; agent stores and prepares caller playback.'
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

  // ── Agent answers ─────────────────────────────────────────────────────
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
      'WebRTC replacement. Emits agent.audio.ready on caller-events as soon as the upload completes.'
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

  // ── Scripts ───────────────────────────────────────────────────────────
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

  // ── Notes ─────────────────────────────────────────────────────────────
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
      200: {
        description: 'OK',
        content: jsonContent(z.object({ notes: z.array(Sc.NoteOutput) })),
      },
      ...CommonErrorResponses,
    },
  });

  // ── Escalations ───────────────────────────────────────────────────────
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
        content: jsonContent(
          z.object({ escalation_id: z.string(), status: z.literal('created') })
        ),
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
        content: jsonContent(
          z.object({ escalations: z.array(Sc.EscalationOutput) })
        ),
      },
      ...CommonErrorResponses,
    },
  });

  // ── Feedback ──────────────────────────────────────────────────────────
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
        content: jsonContent(
          z.object({ feedback_id: z.string(), status: z.literal('saved') })
        ),
      },
      ...CommonErrorResponses,
    },
  });

  // ── Agents (health) ───────────────────────────────────────────────────
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

  // ── Admin analytics ───────────────────────────────────────────────────
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
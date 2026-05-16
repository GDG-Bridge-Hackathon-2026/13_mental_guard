import '../setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as Sc from '../schemas.js';
import { CommonErrorResponses, auth, jsonContent } from '../responses.js';
import { ko_en } from '../i18n.js';

export function registerSessions(registry: OpenAPIRegistry) {
  // POST /api/sessions
  registry.registerPath({
    method: 'post',
    path: '/api/sessions',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 생성', 'Create session'),
    description: ko_en(
      '새 상담 세션을 만든다. agent_id는 토큰에서 자동 추출.',
      'Create a new session. agent_id is taken from the auth token.'
    ),
    request: { body: { content: jsonContent(Sc.CreateSessionInput) } },
    responses: {
      201: {
        description: ko_en('생성됨', 'Created'),
        content: jsonContent(z.object({ session: Sc.SessionOutput })),
      },
      ...CommonErrorResponses,
    },
  });

  // GET /api/sessions
  registry.registerPath({
    method: 'get',
    path: '/api/sessions',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 목록 조회', 'List sessions'),
    description: ko_en(
      'AGENT는 자기 세션만 조회. SUPERVISOR/ADMIN은 agent_id 필터 가능.',
      'AGENT only sees own sessions. SUPERVISOR/ADMIN can filter by agent_id.'
    ),
    request: {
      query: z.object({
        agent_id: z.string().optional(),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
        classification: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
        status: z
          .enum(['created', 'waiting', 'active', 'paused', 'ending', 'ended', 'failed'])
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

  // GET /api/sessions/:id
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

  // PATCH /api/sessions/:id/status
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
      200: { description: 'OK', content: jsonContent(z.object({ session: Sc.SessionOutput })) },
      ...CommonErrorResponses,
    },
  });

  // PATCH /api/sessions/:id/end
  registry.registerPath({
    method: 'patch',
    path: '/api/sessions/{id}/end',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 종료 + 종합 요약 생성', 'End session and generate summary'),
    description: ko_en(
      '멱등. 이미 종료된 세션이면 캐시된 summary 반환.',
      'Idempotent. Returns cached summary if already ended.'
    ),
    request: {
      params: z.object({ id: z.string() }),
      body: { content: jsonContent(Sc.EndSessionInput) },
    },
    responses: {
      200: { description: 'OK', content: jsonContent(z.object({ summary: Sc.SessionSummaryOutput })) },
      ...CommonErrorResponses,
    },
  });

  // GET /api/sessions/:id/summary
  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}/summary',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('캐시된 종합 요약 조회', 'Get cached summary'),
    description: ko_en(
      '세션이 종료된 상태에서만 동작. 그 외엔 409.',
      'Only after session has ended; returns 409 otherwise.'
    ),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: 'OK', content: jsonContent(z.object({ summary: Sc.SessionSummaryOutput })) },
      ...CommonErrorResponses,
    },
  });

  // GET /api/sessions/:id/events
  registry.registerPath({
    method: 'get',
    path: '/api/sessions/{id}/events',
    tags: ['Sessions'],
    security: auth,
    summary: ko_en('세션 이벤트 로그', 'Session event log'),
    description: ko_en(
      'WebSocket으로 흘러간 모든 이벤트가 영속화돼 있음.',
      'All events streamed via WebSocket are persisted here.'
    ),
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: 'OK', content: jsonContent(z.object({ events: z.array(Sc.SessionEventOutput) })) },
      ...CommonErrorResponses,
    },
  });
}

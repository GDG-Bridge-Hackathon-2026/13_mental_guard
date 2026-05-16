// OpenAPI 컴포넌트 schemas — 요청/응답 모양 정의.
// 한·영 description 병기. 입력 스키마는 src/schemas.ts를 재사용하되 .openapi()로 이름 부여.

import './setup.js';
import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as S from '../schemas.js';

const bilingual = (ko: string, en: string) => `${ko}\n\n${en}`;

// ── shared enums (string)  ───────────────────────────────────────────────
const SpeakerStr = z.enum(['caller', 'agent']);
const SourceStr = z.enum(['voice', 'text']);
const DeliveryMethodStr = z.enum(['caption', 'audio', 'text']);
const ChannelStr = z.enum(['voice', 'text', 'mixed']);
const LanguageStr = z.enum(['ko', 'ja', 'auto']);
const SessionStatusStr = z.enum([
  'created', 'waiting', 'active', 'paused', 'ending', 'ended', 'failed',
]);
const SessionModeStr = z.enum(['caption_relay', 'text_only', 'demo']);
const ClassificationStr = z.enum(['A', 'B', 'C', 'D', 'E']);
const ActionLevelStr = z.enum([
  'NORMAL', 'CAUTION', 'ESCALATE', 'TERMINATE_ALLOWED', 'LEGAL_ACTION',
]);
const EmotionStr = z.enum(['ANGER', 'FRUSTRATION', 'CYNICISM', 'CONFUSION', 'CALM']);
const IntentStr = z.enum([
  'LEGITIMATE_COMPLAINT', 'VENT', 'THREAT', 'INSULT', 'INQUIRY',
]);
const TrendStr = z.enum(['UP', 'DOWN', 'STABLE']);
const EscalationTypeStr = z.enum(['SUPERVISOR_CALL', 'TERMINATE', 'LEGAL_REPORT']);

// ── output: Session ──────────────────────────────────────────────────────
export const SessionOutput = z
  .object({
    id: z.string(),
    agent_id: z.string(),
    caller_id: z.string().nullable(),
    channel: ChannelStr,
    language: LanguageStr,
    mode: SessionModeStr,
    status: SessionStatusStr,
    started_at: z.string().datetime(),
    ended_at: z.string().datetime().nullable(),
    total_turns: z.number().int(),
    cumulative_threat: z.number(),
    factual_ratio_avg: z.number(),
    repetition_avg: z.number(),
    classification_distribution: z.object({
      A: z.number().int(), B: z.number().int(), C: z.number().int(),
      D: z.number().int(), E: z.number().int(),
    }),
    final_classification: ClassificationStr.nullable(),
    final_action: ActionLevelStr.nullable(),
    legal_basis: z.array(z.string()).nullable(),
    core_demands: z.array(z.string()).nullable(),
    summary: z.unknown().nullable(),
    metadata: z.record(z.string()).nullable(),
  })
  .openapi('Session', {
    description: bilingual('상담 세션 1건', 'A single consultation session'),
  });

// ── output: Turn ─────────────────────────────────────────────────────────
export const TurnOutput = z
  .object({
    id: z.string(),
    session_id: z.string(),
    seq: z.number().int(),
    speaker: SpeakerStr,
    source: SourceStr,
    delivery_method: DeliveryMethodStr,
    raw_text: z.string(),
    raw_audio_url: z.string().url().nullable(),
    stt_url: z.string().url().nullable(),
    displayed_text: z.string().nullable(),
    is_filtered: z.boolean(),
    duration_ms: z.number().int().nullable(),
    stt_confidence: z.number().nullable(),
    latency_ms: z.number().int().nullable(),
    timestamp: z.string().datetime(),
  })
  .openapi('Turn', {
    description: bilingual('발화 1턴 (민원인 또는 접수인)', 'A single utterance turn (caller or agent)'),
  });

// ── output: Analysis ─────────────────────────────────────────────────────
const MetricsSchema = z.object({
  threat_level: z.number().int().min(1).max(5),
  emotion: EmotionStr,
  factual_ratio: z.number().int().min(0).max(100),
  repetition_score: z.number().int().min(0).max(100),
  trend: TrendStr,
});
const AnalysisSummaryJson = z.object({
  core_demand: z.string(),
  intent: IntentStr,
  risk_keywords: z.array(z.string()),
});
const RecommendedActionJson = z.object({
  level: ActionLevelStr,
  scripts: z
    .object({
      공감: z.string(),
      단호: z.string(),
      위로: z.string(),
    })
    .openapi({
      description: bilingual(
        '톤별 추천 응답 (키는 한국어 고정: 공감/단호/위로)',
        'Recommended scripts by tone (keys are fixed Korean: 공감/단호/위로)'
      ),
    }),
  legal_basis: z.string().nullable(),
});

export const AnalysisOutput = z
  .object({
    id: z.string(),
    turn_id: z.string(),
    refined: z.string(),
    metrics: MetricsSchema,
    summary: AnalysisSummaryJson,
    classification: ClassificationStr,
    preserved_facts: z.array(z.string()),
    removed_expressions: z.array(z.string()),
    abuse_types: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    recommended_action: RecommendedActionJson,
    created_at: z.string().datetime(),
  })
  .openapi('Analysis', {
    description: bilingual(
      'LLM이 caller 턴마다 만드는 분석 결과',
      'LLM analysis result generated per caller turn'
    ),
  });

// ── output: SessionSummary ───────────────────────────────────────────────
export const SessionSummaryOutput = z
  .object({
    session_id: z.string(),
    duration_seconds: z.number().int(),
    final: z.object({
      classification: ClassificationStr,
      action: ActionLevelStr,
      legal_basis: z.array(z.string()),
    }),
    cumulative: z.object({
      total_turns: z.number().int(),
      avg_threat: z.number(),
      max_threat: z.number(),
      factual_ratio: z.number(),
      repetition_score: z.number(),
      distribution: z.object({
        A: z.number().int(), B: z.number().int(), C: z.number().int(),
        D: z.number().int(), E: z.number().int(),
      }),
    }),
    timeline: z.array(
      z.object({
        seq: z.number().int(),
        timestamp: z.string().datetime(),
        threat_level: z.number(),
      })
    ),
    core_demands: z.array(z.string()),
    agent_response_summary: z.array(z.string()),
    caller_pattern: z
      .object({
        is_repeat: z.boolean(),
        similar_past_sessions: z.array(z.string()),
      })
      .nullable(),
    agent_health: z.object({
      today_high_risk_count: z.number().int(),
      filtered_abuse_count: z.number().int(),
      recommended_break_minutes: z.number().int(),
    }),
  })
  .openapi('SessionSummary');

// ── output: SessionEvent ─────────────────────────────────────────────────
export const SessionEventOutput = z
  .object({
    id: z.string(),
    session_id: z.string(),
    type: z.string(),
    payload: z.unknown(),
    timestamp: z.string().datetime(),
  })
  .openapi('SessionEvent');

// ── output: Note / Escalation / Feedback ─────────────────────────────────
export const NoteOutput = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    agentId: z.string(),
    content: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi('Note');

export const EscalationOutput = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    type: EscalationTypeStr,
    reason: z.string().nullable(),
    requestedBy: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi('Escalation');

// ── error response ───────────────────────────────────────────────────────
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      retry_after: z.number().optional(),
    }),
  })
  .openapi('Error');

// ── multipart upload schemas ─────────────────────────────────────────────
export const TurnVoiceMultipart = z
  .object({
    speaker: SpeakerStr.optional(),
    audio: z.string().openapi({ type: 'string', format: 'binary' }),
    language_hint: LanguageStr.optional(),
    duration_ms: z.number().int().optional(),
  })
  .openapi('TurnVoiceMultipart');

export const AgentTurnVoiceMultipart = z
  .object({
    audio: z.string().openapi({ type: 'string', format: 'binary' }),
    duration_ms: z.number().int().optional(),
  })
  .openapi('AgentTurnVoiceMultipart');

// ── input schemas: src/schemas.ts에서 가져와 이름만 부여 ─────────────────
export const CreateSessionInput = S.CreateSessionSchema.openapi('CreateSessionInput');
export const PatchStatusInput = S.PatchStatusSchema.openapi('PatchStatusInput');
export const EndSessionInput = S.EndSessionSchema.openapi('EndSessionInput');
export const CreateTurnTextInput = S.CreateTurnTextSchema.openapi('CreateTurnTextInput');
export const CreateAgentTurnTextInput = S.CreateAgentTurnTextSchema.openapi('CreateAgentTurnTextInput');
export const RegenerateScriptInput = S.RegenerateScriptSchema.openapi('RegenerateScriptInput');
export const CreateNoteInput = S.CreateNoteSchema.openapi('CreateNoteInput');
export const CreateEscalationInput = S.CreateEscalationSchema.openapi('CreateEscalationInput');
export const CreateFeedbackInput = S.CreateFeedbackSchema.openapi('CreateFeedbackInput');

export function registerSchemas(registry: OpenAPIRegistry) {
  // 명시 등록. .openapi('Name', ...) 의 첫 인자와 동일 이름 사용.
  registry.register('Session', SessionOutput);
  registry.register('Turn', TurnOutput);
  registry.register('Analysis', AnalysisOutput);
  registry.register('SessionSummary', SessionSummaryOutput);
  registry.register('SessionEvent', SessionEventOutput);
  registry.register('Note', NoteOutput);
  registry.register('Escalation', EscalationOutput);
  registry.register('Error', ErrorResponseSchema);
  registry.register('TurnVoiceMultipart', TurnVoiceMultipart);
  registry.register('AgentTurnVoiceMultipart', AgentTurnVoiceMultipart);
  registry.register('CreateSessionInput', CreateSessionInput);
  registry.register('PatchStatusInput', PatchStatusInput);
  registry.register('EndSessionInput', EndSessionInput);
  registry.register('CreateTurnTextInput', CreateTurnTextInput);
  registry.register('CreateAgentTurnTextInput', CreateAgentTurnTextInput);
  registry.register('RegenerateScriptInput', RegenerateScriptInput);
  registry.register('CreateNoteInput', CreateNoteInput);
  registry.register('CreateEscalationInput', CreateEscalationInput);
  registry.register('CreateFeedbackInput', CreateFeedbackInput);
}
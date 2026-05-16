import { z } from 'zod';
import {
  Channel,
  Language,
  Classification,
  ActionLevel,
  SessionMode,
  SessionStatus,
  Speaker,
  EscalationType,
} from '@prisma/client';
import { Emotion, Intent, Trend } from './enums.js';

// ── Requests ────────────────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  agent_id: z.string().optional(), // 보통 req.user.id로 덮어씀
  caller_id: z.string().nullable().optional(),
  channel: z.nativeEnum(Channel).default(Channel.VOICE),
  language: z.nativeEnum(Language).default(Language.AUTO),
  mode: z.nativeEnum(SessionMode).default(SessionMode.CAPTION_RELAY),
  metadata: z.record(z.string()).optional(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const PatchStatusSchema = z.object({
  status: z.nativeEnum(SessionStatus),
});

export const EndSessionSchema = z.object({
  generate_summary: z.boolean().default(true),
  save_audio: z.boolean().default(true),
  reason: z.enum(['normal', 'terminated', 'failed']).default('normal'),
});

// /turns — speaker 명시 (caller 또는 agent)
export const CreateTurnTextSchema = z.object({
  speaker: z.nativeEnum(Speaker).default(Speaker.CALLER),
  type: z.literal('text'),
  content: z.string().min(1).max(5000),
  language_hint: z.nativeEnum(Language).default(Language.AUTO),
});
export type CreateTurnTextInput = z.infer<typeof CreateTurnTextSchema>;

export const CreateTurnVoiceSchema = z.object({
  speaker: z.nativeEnum(Speaker).default(Speaker.CALLER),
  type: z.literal('voice'),
  language_hint: z.nativeEnum(Language).default(Language.AUTO),
  duration_ms: z.coerce.number().int().nonnegative().optional(),
});
export type CreateTurnVoiceInput = z.infer<typeof CreateTurnVoiceSchema>;

// /agent-turns — speaker는 항상 agent
export const CreateAgentTurnTextSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const CreateAgentTurnVoiceSchema = z.object({
  duration_ms: z.coerce.number().int().nonnegative().optional(),
});

// /scripts/regenerate — tone은 명세대로 한국어
export const RegenerateScriptSchema = z.object({
  tone: z.enum(['공감', '단호', '위로']),
  additional_context: z.string().max(2000).optional(),
});
export type RegenerateScriptInput = z.infer<typeof RegenerateScriptSchema>;

export const ListSessionsQuerySchema = z.object({
  agent_id: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  classification: z.nativeEnum(Classification).optional(),
  status: z.nativeEnum(SessionStatus).optional(),
  min_threat: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  sort: z
    .string()
    .regex(/^[a-z_]+:(asc|desc)$/)
    .default('started_at:desc'),
});
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;

export const TranscriptQuerySchema = z.object({
  view: z.enum(['raw', 'clean', 'both']).default('both'),
});

export const CreateNoteSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const CreateEscalationSchema = z.object({
  type: z.nativeEnum(EscalationType),
  reason: z.string().max(2000).optional(),
});

export const CreateFeedbackSchema = z.object({
  turn_id: z.string().optional(),
  field: z.string().min(1),
  expected: z.string(),
  actual: z.string(),
  comment: z.string().max(2000).optional(),
});

export const AdminAnalyticsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  department: z.string().optional(),
  agent_id: z.string().optional(),
});

// ── LLM Analysis (ML 응답 검증) ─────────────────────────────────────────────
// scripts JSON 키는 명세대로 한국어 (공감/단호/위로)

export const ScriptsSchema = z.object({
  공감: z.string(),
  단호: z.string(),
  위로: z.string(),
});

export const RecommendedActionSchema = z.object({
  level: z.nativeEnum(ActionLevel),
  scripts: ScriptsSchema,
  legal_basis: z.string().nullable(),
});

export const AnalysisSchema = z.object({
  refined: z.string(),
  metrics: z.object({
    threat_level: z.number().int().min(1).max(5),
    emotion: z.nativeEnum(Emotion),
    factual_ratio: z.number().int().min(0).max(100),
    repetition_score: z.number().int().min(0).max(100),
    trend: z.nativeEnum(Trend),
  }),
  summary: z.object({
    core_demand: z.string(),
    intent: z.nativeEnum(Intent),
    risk_keywords: z.array(z.string()),
  }),
  classification: z.nativeEnum(Classification),
  preserved_facts: z.array(z.string()).default([]),
  removed_expressions: z.array(z.string()).default([]),
  abuse_types: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0),
  recommended_action: RecommendedActionSchema,
});
export type AnalysisPayload = z.infer<typeof AnalysisSchema>;
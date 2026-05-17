import type { Analysis, Escalation, Note, Prisma, Session, Turn } from '@prisma/client';

type JsonValue = Prisma.JsonValue | null;

function iso(value: Date): string {
  return value.toISOString();
}

function lower(value: string): string {
  return value.toLowerCase();
}

function stringArray(value: JsonValue): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === 'string');
}

function stringArrayOrEmpty(value: JsonValue): string[] {
  return stringArray(value) ?? [];
}

function stringRecord(value: JsonValue): Record<string, string> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string') out[key] = val;
  }
  return out;
}

export function toSessionDto(session: Session) {
  return {
    id: session.id,
    agent_id: session.agentId,
    caller_id: session.callerId,
    channel: lower(session.channel),
    language: lower(session.language),
    mode: lower(session.mode),
    status: lower(session.status),
    started_at: iso(session.startedAt),
    ended_at: session.endedAt ? iso(session.endedAt) : null,
    total_turns: session.totalTurns,
    cumulative_threat: session.cumulativeThreat,
    factual_ratio_avg: session.factualRatioAvg,
    repetition_avg: session.repetitionAvg,
    classification_distribution: session.classificationDistribution,
    final_classification: session.finalClassification,
    final_action: session.finalAction,
    legal_basis: stringArray(session.legalBasis),
    core_demands: stringArray(session.coreDemands),
    summary: session.summary,
    metadata: stringRecord(session.metadata),
  };
}

export function toTurnDto(turn: Turn) {
  return {
    id: turn.id,
    session_id: turn.sessionId,
    seq: turn.seq,
    speaker: lower(turn.speaker),
    source: lower(turn.source),
    delivery_method: lower(turn.deliveryMethod),
    raw_text: turn.rawText,
    raw_audio_url: turn.rawAudioUrl,
    stt_url: turn.sttUrl,
    displayed_text: turn.displayedText,
    is_filtered: turn.isFiltered,
    duration_ms: turn.durationMs,
    stt_confidence: turn.sttConfidence,
    latency_ms: turn.latencyMs,
    timestamp: iso(turn.timestamp),
  };
}

export function toAnalysisDto(analysis: Analysis) {
  return {
    id: analysis.id,
    turn_id: analysis.turnId,
    refined: analysis.refined,
    metrics: analysis.metrics,
    summary: analysis.summary,
    classification: analysis.classification,
    preserved_facts: stringArrayOrEmpty(analysis.preservedFacts),
    removed_expressions: stringArrayOrEmpty(analysis.removedExpressions),
    abuse_types: stringArrayOrEmpty(analysis.abuseTypes),
    confidence: analysis.confidence,
    recommended_action: analysis.recommendedAction,
    created_at: iso(analysis.createdAt),
  };
}

export function toNoteDto(note: Note) {
  return {
    id: note.id,
    session_id: note.sessionId,
    agent_id: note.agentId,
    content: note.content,
    created_at: iso(note.createdAt),
  };
}

export function toEscalationDto(escalation: Escalation) {
  return {
    id: escalation.id,
    session_id: escalation.sessionId,
    type: escalation.type,
    reason: escalation.reason,
    requested_by: escalation.requestedBy,
    created_at: iso(escalation.createdAt),
  };
}

import { prisma } from '../prisma.js';
import { ApiError } from '../errors.js';
import { emit } from '../events.js';
import {
  Classification,
  Speaker,
  SessionStatus,
  EventType,
  Prisma,
} from '@prisma/client';
import type {
  AnalysisMetrics,
  ClassificationDistribution,
  SessionSummary,
} from '../types.js';
import { summarizeSession as mlSummarize } from '../ml/summarize-session.js';

/**
 * TODO(사람): 실제 법조항 매핑.
 * key는 ML 서비스가 돌려주는 legal_basis_keys와 1:1.
 */
const LEGAL_BASIS_MAP: Record<string, string> = {
  KR_EMOTION_LABOR_LAW_26_2: '감정노동자보호법 제26조의2',
  JP_KASAHARA_MANUAL_CH4: '厚生労働省 カスタマーハラスメント対策企業マニュアル 第4章',
};

export async function endSession(sessionId: string): Promise<SessionSummary> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      turns: {
        orderBy: { seq: 'asc' },
        include: { analysis: true },
      },
    },
  });
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', `session ${sessionId} not found`);

  // 멱등
  if (session.endedAt && session.summary) {
    return session.summary as unknown as SessionSummary;
  }
  if (session.turns.length === 0) {
    throw new ApiError(400, 'INVALID_INPUT', 'cannot end session with zero turns');
  }

  const mlSummary = await mlSummarize(
    {
      cumulative_threat: session.cumulativeThreat,
      language: session.language,
      turns: session.turns.map((t) => ({
        seq: t.seq,
        speaker: t.speaker,
        text: t.rawText,
        classification: t.analysis?.classification,
        threat_level: (t.analysis?.metrics as AnalysisMetrics | undefined)?.threat_level,
      })),
    },
    sessionId
  );

  const legalBasis = mlSummary.legal_basis_keys
    .map((k) => LEGAL_BASIS_MAP[k])
    .filter((s): s is string => !!s);

  const callerTurns = session.turns.filter((t) => t.speaker === Speaker.CALLER);
  const threats = callerTurns.map(
    (t) => (t.analysis?.metrics as AnalysisMetrics | undefined)?.threat_level ?? 0
  );
  const maxThreat = threats.length ? Math.max(...threats) : 0;
  const durationSec = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

  const [callerPattern, agentHealth] = await Promise.all([
    findRepeatCaller(session.agentId, session.metadata as Record<string, string> | null),
    getAgentHealthMetrics(session.agentId),
  ]);

  const summary: SessionSummary = {
    session_id: session.id,
    duration_seconds: durationSec,
    final: {
      classification: mlSummary.final_classification,
      action: mlSummary.final_action,
      legal_basis: legalBasis,
    },
    cumulative: {
      total_turns: session.totalTurns,
      avg_threat: session.cumulativeThreat,
      max_threat: maxThreat,
      factual_ratio: session.factualRatioAvg,
      repetition_score: session.repetitionAvg,
      distribution:
        session.classificationDistribution as unknown as ClassificationDistribution,
    },
    timeline: callerTurns.map((t) => ({
      seq: t.seq,
      timestamp: t.timestamp.toISOString(),
      threat_level: (t.analysis?.metrics as AnalysisMetrics | undefined)?.threat_level ?? 0,
    })),
    core_demands: mlSummary.core_demands,
    agent_response_summary: mlSummary.agent_response_summary,
    caller_pattern: callerPattern,
    agent_health: agentHealth,
  };

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.ENDED,
      endedAt: new Date(),
      finalClassification: mlSummary.final_classification,
      finalAction: mlSummary.final_action,
      legalBasis: legalBasis as unknown as Prisma.InputJsonValue,
      coreDemands: mlSummary.core_demands as unknown as Prisma.InputJsonValue,
      summary: summary as unknown as Prisma.InputJsonValue,
    },
  });

  await emit(sessionId, EventType.SESSION_ENDED, { summary_id: session.id });

  return summary;
}

export async function getCachedSummary(
  sessionId: string
): Promise<{ summary: SessionSummary; agentId: string }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { agentId: true, endedAt: true, summary: true },
  });
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', `session ${sessionId} not found`);
  if (!session.endedAt || !session.summary) {
    throw new ApiError(409, 'SESSION_NOT_ENDED', 'call PATCH /sessions/:id/end first');
  }
  return {
    summary: session.summary as unknown as SessionSummary,
    agentId: session.agentId,
  };
}

// ── TODO(사람) 구현 필요 ──────────────────────────────────────────────────

async function findRepeatCaller(
  _agentId: string,
  _metadata: Record<string, string> | null
): Promise<{ is_repeat: boolean; similar_past_sessions: string[] } | null> {
  // 예: metadata.caller_id 또는 caller_phone_masked로 매칭
  return null;
}

export async function getAgentHealthMetrics(
  agentId: string
): Promise<{
  today_high_risk_count: number;
  filtered_abuse_count: number;
  recommended_break_minutes: number;
}> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [highRiskCount, filteredCount] = await Promise.all([
    prisma.session.count({
      where: {
        agentId,
        startedAt: { gte: since },
        finalClassification: { in: [Classification.C, Classification.D, Classification.E] },
      },
    }),
    prisma.turn.count({
      where: {
        speaker: Speaker.CALLER,
        isFiltered: true,
        session: { agentId, startedAt: { gte: since } },
      },
    }),
  ]);

  return {
    today_high_risk_count: highRiskCount,
    filtered_abuse_count: filteredCount,
    recommended_break_minutes:
      highRiskCount >= 3 ? 15 : highRiskCount >= 1 ? 5 : 0,
  };
}
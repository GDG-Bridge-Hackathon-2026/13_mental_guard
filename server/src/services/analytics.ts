// 통계 집계. Prisma aggregate/groupBy로 N+1 회피.
// 예외: analyses.summary.intent (Json path)는 Prisma groupBy 미지원 → in-app 집계 + 표본 cap.

import { prisma } from '../prisma.js';
import {
  Classification,
  Speaker,
  type Prisma,
} from '@prisma/client';
import type {
  AnalysisSummaryJson,
  ClassificationDistribution,
} from '../types.js';

const HIGH_RISK = [Classification.C, Classification.D, Classification.E];

const emptyDist = (): ClassificationDistribution => ({ A: 0, B: 0, C: 0, D: 0, E: 0 });

// ── agent 보호 지표 ─────────────────────────────────────────────────────

export async function getAgentTodayHealth(agentId: string) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const sessionScope: Prisma.SessionWhereInput = { agentId, startedAt: { gte: since } };

  const [sessions, highRisk, filteredCount] = await Promise.all([
    prisma.session.count({ where: sessionScope }),
    prisma.session.count({
      where: { ...sessionScope, finalClassification: { in: HIGH_RISK } },
    }),
    prisma.turn.count({
      where: { speaker: Speaker.CALLER, isFiltered: true, session: sessionScope },
    }),
  ]);

  return {
    agent_id: agentId,
    today: {
      sessions,
      high_risk_sessions: highRisk,
      filtered_abuse_count: filteredCount,
      recommended_break_minutes: highRisk >= 3 ? 15 : highRisk >= 1 ? 5 : 0,
    },
  };
}

// ── 관리자 통계 ──────────────────────────────────────────────────────────

export async function getAdminAnalytics(query: {
  from?: Date;
  to?: Date;
  agentId?: string;
}) {
  const where: Prisma.SessionWhereInput = {
    ...(query.agentId ? { agentId: query.agentId } : {}),
    ...(query.from || query.to
      ? {
          startedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  // 모두 서버 측 집계 — 세션 수만큼 row를 가져오지 않음.
  const [
    total,
    highRisk,
    threatAvg,
    classGroups,
    filteredCount,
    intentSample,
  ] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.count({ where: { ...where, finalClassification: { in: HIGH_RISK } } }),
    prisma.session.aggregate({ where, _avg: { cumulativeThreat: true } }),
    // 모든 caller turn의 classification 분포 — groupBy로 DB에서 직접
    prisma.analysis.groupBy({
      by: ['classification'],
      where: { turn: { session: where } },
      _count: { _all: true },
    }),
    prisma.turn.count({
      where: { isFiltered: true, session: where },
    }),
    // top_intents는 JSON path라 groupBy 불가. 표본 cap 후 in-app 집계.
    // 정확도 필요시 Analysis에 intent 컬럼을 denormalize.
    prisma.analysis.findMany({
      where: { turn: { session: where } },
      select: { summary: true },
      take: 5000,
    }),
  ]);

  const distribution = emptyDist();
  for (const row of classGroups) {
    distribution[row.classification] = row._count._all;
  }

  const intentCount = new Map<string, number>();
  for (const a of intentSample) {
    const intent = (a.summary as unknown as AnalysisSummaryJson | null)?.intent;
    if (intent) intentCount.set(intent, (intentCount.get(intent) ?? 0) + 1);
  }
  const topIntents = [...intentCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  return {
    total_sessions: total,
    high_risk_sessions: highRisk,
    avg_threat: threatAvg._avg.cumulativeThreat ?? 0,
    filtered_expression_count: filteredCount,
    top_intents: topIntents,
    classification_distribution: distribution,
  };
}
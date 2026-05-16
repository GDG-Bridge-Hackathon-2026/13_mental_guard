import { prisma } from '../prisma.js';
import { Classification, Speaker } from '@prisma/client';
import type { ClassificationDistribution } from '../types.js';
import type { AnalysisSummaryJson } from '../types.js';
import { getAgentHealthMetrics } from './summary.js';

export async function getAgentTodayHealth(agentId: string) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [sessions, highRisk, filteredCount] = await Promise.all([
    prisma.session.count({ where: { agentId, startedAt: { gte: since } } }),
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

  const health = await getAgentHealthMetrics(agentId);

  return {
    agent_id: agentId,
    today: {
      sessions,
      high_risk_sessions: highRisk,
      filtered_abuse_count: filteredCount,
      recommended_break_minutes: health.recommended_break_minutes,
    },
  };
}

export async function getAdminAnalytics(query: {
  from?: Date;
  to?: Date;
  agentId?: string;
}) {
  const where = {
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

  const [total, highRisk, sessions, filteredCount] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.count({
      where: {
        ...where,
        finalClassification: { in: [Classification.C, Classification.D, Classification.E] },
      },
    }),
    prisma.session.findMany({
      where,
      select: { cumulativeThreat: true, classificationDistribution: true },
    }),
    prisma.turn.count({
      where: { isFiltered: true, session: where },
    }),
  ]);

  // 누적 분포 집계
  const dist: ClassificationDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let threatSum = 0;
  for (const s of sessions) {
    threatSum += s.cumulativeThreat;
    const d = s.classificationDistribution as unknown as ClassificationDistribution;
    for (const key of Object.keys(dist) as Classification[]) {
      dist[key] += d[key] ?? 0;
    }
  }
  const avgThreat = sessions.length ? threatSum / sessions.length : 0;

  // top intents — analyses.summary 에서 추출 (간단 집계, 부담되면 별도 잡)
  const analyses = await prisma.analysis.findMany({
    where: { turn: { session: where } },
    select: { summary: true },
    take: 1000,
  });
  const intentCount = new Map<string, number>();
  for (const a of analyses) {
    const s = a.summary as unknown as AnalysisSummaryJson;
    const demand = s.core_demand ?? '';
    if (demand) intentCount.set(demand, (intentCount.get(demand) ?? 0) + 1);
  }
  const topIntents = [...intentCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  return {
    total_sessions: total,
    high_risk_sessions: highRisk,
    avg_threat: avgThreat,
    filtered_expression_count: filteredCount,
    top_intents: topIntents,
    classification_distribution: dist,
  };
}
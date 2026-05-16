import { prisma } from '../prisma.js';
import { newSessionId } from '../ids.js';
import { ApiError } from '../errors.js';
import { emptyDistribution } from '../thresholds.js';
import { emit } from '../events.js';
import {
  Channel,
  Language,
  Classification,
  SessionMode,
  SessionStatus,
  EventType,
  Prisma,
  type UserRole,
} from '@prisma/client';

export async function createSession(input: {
  agentId: string;
  callerId?: string | null;
  channel: Channel;
  language: Language;
  mode: SessionMode;
  metadata?: Record<string, string>;
}) {
  return prisma.session.create({
    data: {
      id: newSessionId(),
      agentId: input.agentId,
      callerId: input.callerId ?? null,
      channel: input.channel,
      language: input.language,
      mode: input.mode,
      status: SessionStatus.CREATED,
      classificationDistribution:
        emptyDistribution() as unknown as Prisma.InputJsonValue,
      metadata: input.metadata
        ? (input.metadata as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

export async function getSession(id: string) {
  const s = await prisma.session.findUnique({ where: { id } });
  if (!s) throw new ApiError(404, 'SESSION_NOT_FOUND', `session ${id} not found`);
  return s;
}

export async function getSessionWithTurns(id: string) {
  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      turns: {
        orderBy: { seq: 'asc' },
        include: { analysis: true },
      },
    },
  });
  if (!s) throw new ApiError(404, 'SESSION_NOT_FOUND', `session ${id} not found`);
  return s;
}

/** AGENT는 자기 세션만, SUPERVISOR/ADMIN은 모두 접근 가능. */
export function assertSessionAccess(
  session: { agentId: string },
  user: { id: string; role: UserRole }
) {
  if (user.role === 'AGENT' && session.agentId !== user.id) {
    throw new ApiError(403, 'FORBIDDEN', 'not your session');
  }
}

export async function updateStatus(sessionId: string, status: SessionStatus) {
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { status },
  });

  await emit(sessionId, EventType.SESSION_STATUS, {
    status,
    message: STATUS_MESSAGES[status],
  });

  if (status === SessionStatus.PAUSED) {
    await emit(sessionId, EventType.SESSION_PAUSED, { reason: 'manual' });
  }

  return session;
}

const STATUS_MESSAGES: Record<SessionStatus, string> = {
  CREATED: '세션이 생성되었습니다.',
  WAITING: '연결 대기 중입니다.',
  ACTIVE: '상담이 진행 중입니다.',
  PAUSED: '상담이 일시 중지되었습니다.',
  ENDING: '상담 종료 처리 중입니다.',
  ENDED: '상담이 종료되었습니다.',
  FAILED: '시스템 오류로 세션이 실패했습니다.',
};

export async function listSessions(filter: {
  agentId?: string;
  from?: Date;
  to?: Date;
  classification?: Classification;
  status?: SessionStatus;
  minThreat?: number;
  limit: number;
  offset: number;
  sortField: string;
  sortDir: 'asc' | 'desc';
}) {
  const where: Prisma.SessionWhereInput = {};
  if (filter.agentId) where.agentId = filter.agentId;
  if (filter.from || filter.to) {
    where.startedAt = {};
    if (filter.from) where.startedAt.gte = filter.from;
    if (filter.to) where.startedAt.lte = filter.to;
  }
  if (filter.classification) where.finalClassification = filter.classification;
  if (filter.status) where.status = filter.status;
  if (filter.minThreat !== undefined) where.cumulativeThreat = { gte: filter.minThreat };

  const orderBy = { [filter.sortField]: filter.sortDir } as Prisma.SessionOrderByWithRelationInput;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      orderBy,
      skip: filter.offset,
      take: filter.limit,
    }),
    prisma.session.count({ where }),
  ]);
  return { sessions, total };
}
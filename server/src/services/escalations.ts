import { prisma } from '../prisma.js';
import { newEscalationId } from '../ids.js';
import { EscalationType } from '@prisma/client';

export async function createEscalation(input: {
  sessionId: string;
  type: EscalationType;
  reason?: string;
  requestedBy: string;
}) {
  return prisma.escalation.create({
    data: {
      id: newEscalationId(),
      sessionId: input.sessionId,
      type: input.type,
      reason: input.reason ?? null,
      requestedBy: input.requestedBy,
    },
  });
}

export async function listEscalations(sessionId: string) {
  return prisma.escalation.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}
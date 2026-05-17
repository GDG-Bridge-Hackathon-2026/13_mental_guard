import { prisma } from '../prisma.js';
import { newFeedbackId } from '../ids.js';
import { ApiError } from '../errors.js';

export async function createFeedback(input: {
  sessionId: string;
  turnId?: string;
  field: string;
  expected: string;
  actual: string;
  comment?: string;
}) {
  if (input.turnId) {
    const turn = await prisma.turn.findUnique({
      where: { id: input.turnId },
      select: { sessionId: true },
    });
    if (!turn) throw new ApiError(404, 'TURN_NOT_FOUND', `turn ${input.turnId} not found`);
    if (turn.sessionId !== input.sessionId) {
      throw new ApiError(400, 'INVALID_INPUT', 'turn_id does not belong to session');
    }
  }

  return prisma.feedback.create({
    data: {
      id: newFeedbackId(),
      sessionId: input.sessionId,
      turnId: input.turnId ?? null,
      field: input.field,
      expected: input.expected,
      actual: input.actual,
      comment: input.comment ?? null,
    },
  });
}

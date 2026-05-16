import { prisma } from '../prisma.js';
import { newFeedbackId } from '../ids.js';

export async function createFeedback(input: {
  sessionId: string;
  turnId?: string;
  field: string;
  expected: string;
  actual: string;
  comment?: string;
}) {
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
import { prisma } from '../prisma.js';
import { newNoteId } from '../ids.js';

export async function createNote(input: {
  sessionId: string;
  agentId: string;
  content: string;
}) {
  return prisma.note.create({
    data: {
      id: newNoteId(),
      sessionId: input.sessionId,
      agentId: input.agentId,
      content: input.content,
    },
  });
}

export async function listNotes(sessionId: string) {
  return prisma.note.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}
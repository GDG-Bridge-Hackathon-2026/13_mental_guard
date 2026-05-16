import { prisma } from '../prisma.js';
import { ApiError } from '../errors.js';

export type TranscriptView = 'raw' | 'clean' | 'both';

export async function getTranscript(sessionId: string, view: TranscriptView) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, agentId: true },
  });
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', `session ${sessionId} not found`);

  const turns = await prisma.turn.findMany({
    where: { sessionId },
    orderBy: { seq: 'asc' },
    select: {
      seq: true,
      speaker: true,
      source: true,
      rawText: view === 'clean' ? false : true,
      displayedText: view === 'raw' ? false : true,
      timestamp: true,
    },
  });

  return {
    session_id: sessionId,
    view,
    agentId: session.agentId,
    transcript: turns.map((t) => ({
      seq: t.seq,
      speaker: t.speaker.toLowerCase(),
      ...(view !== 'clean' ? { raw_text: t.rawText } : {}),
      ...(view !== 'raw' ? { displayed_text: t.displayedText } : {}),
      timestamp: t.timestamp.toISOString(),
    })),
  };
}
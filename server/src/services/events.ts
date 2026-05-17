import { prisma } from '../prisma.js';
import { EventType } from '@prisma/client';

const EVENT_WIRE: Record<EventType, string> = {
  CAPTION_PARTIAL: 'caption.partial',
  CAPTION_FINAL: 'caption.final',
  RISK_UPDATE: 'risk.update',
  SUMMARY_UPDATE: 'summary.update',
  THRESHOLD_WARNING: 'threshold.warning',
  THRESHOLD_TERMINATE_ALLOWED: 'threshold.terminate_allowed',
  AGENT_AUDIO_READY: 'agent.audio.ready',
  SESSION_STATUS: 'session.status',
  SESSION_PAUSED: 'session.paused',
  SESSION_ENDED: 'session.ended',
  ERROR: 'error',
};

export async function listEvents(sessionId: string, limit = 200) {
  const events = await prisma.sessionEvent.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'asc' },
    take: limit,
  });
  return events.map((e) => ({
    id: e.id,
    session_id: e.sessionId,
    type: EVENT_WIRE[e.type],
    payload: e.payload,
    timestamp: e.timestamp.toISOString(),
  }));
}
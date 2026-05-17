import type {
  AgentTurn,
  Session,
  SessionSummary,
  TranscriptItem,
} from "@/types/mvp";
import { getMockCallerTurns } from "./mockTurns";
import { buildMockSummary } from "./mockSummary";
import type { Lang } from "@/i18n/translations";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let agentReplySeq = 100;

export async function createMockSession(): Promise<Session> {
  await wait(150);
  const id = `session_${Date.now()}`;
  return {
    id,
    agentId: "agent_001",
    status: "created",
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

export async function startMockSession(session: Session): Promise<Session> {
  await wait(100);
  return { ...session, status: "active", startedAt: new Date().toISOString() };
}

export async function sendMockAgentReply(
  sessionId: string,
  replyText: string
): Promise<AgentTurn> {
  await wait(300);
  agentReplySeq += 1;
  return {
    id: `turn_agent_${agentReplySeq}`,
    seq: agentReplySeq,
    speaker: "agent",
    rawText: replyText,
    deliveredToCaller: true,
    timestamp: new Date().toISOString(),
  };
}

export async function endMockSession(
  sessionId: string,
  startedAtIso: string,
  lang: Lang
): Promise<SessionSummary> {
  await wait(400);
  const started = new Date(startedAtIso).getTime();
  const duration = Math.max(60, Math.round((Date.now() - started) / 1000));
  return buildMockSummary(sessionId, duration, lang);
}

export async function getMockTranscript(
  sessionId: string,
  agentTurns: AgentTurn[],
  lang: Lang
): Promise<TranscriptItem[]> {
  await wait(200);

  const turns = getMockCallerTurns(lang);

  const callerItems: TranscriptItem[] = turns.map((t) => ({
    seq: t.seq,
    speaker: "caller",
    rawText: t.rawText,
    cleanCaption: t.cleanCaption,
    timestamp: t.timestamp,
  }));

  const agentItems: TranscriptItem[] = agentTurns.map((t) => ({
    seq: t.seq,
    speaker: "agent",
    rawText: t.rawText,
    cleanCaption: t.rawText,
    timestamp: t.timestamp,
  }));

  return [...callerItems, ...agentItems].sort((a, b) => {
    if (a.timestamp === b.timestamp) return a.seq - b.seq;
    return a.timestamp < b.timestamp ? -1 : 1;
  });
}

export type Speaker = "caller" | "agent";

export type SessionStatus = "created" | "active" | "ended";

export type DemoEventType =
  | "session.created"
  | "session.started"
  | "caption.partial"
  | "caption.final"
  | "summary.update"
  | "agent.reply"
  | "session.ended"
  | "demo.reset";

export interface Session {
  id: string;
  agentId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface RecommendedReply {
  id: string;
  tone: string;
  text: string;
}

export interface CaptionTurn {
  id: string;
  seq: number;
  speaker: Speaker;
  rawText: string;
  cleanCaption: string;
  coreDemand?: string;
  recommendedReplies?: RecommendedReply[];
  detectedAbuseTypes?: string[];
  timestamp: string;
}

export interface AgentTurn {
  id: string;
  seq: number;
  speaker: "agent";
  rawText: string;
  deliveredToCaller: boolean;
  timestamp: string;
}

export interface DemoEvent {
  type: DemoEventType;
  sessionId: string;
  payload: unknown;
  timestamp: string;
}

export interface SessionSummary {
  sessionId: string;
  durationSeconds: number;
  coreDemands: string[];
  agentResponses: string[];
  detectedAbuseTypes: string[];
  finalSummary: string;
  recommendedNextAction: string;
  complaintCategory: string;
}

export interface TranscriptItem {
  seq: number;
  speaker: Speaker;
  rawText: string;
  cleanCaption: string | null;
  timestamp: string;
}

export type ScriptTone = "공감" | "단호" | "위로";

export type EscalationType = "SUPERVISOR_CALL" | "TERMINATE" | "LEGAL_REPORT";

export interface Note {
  id: string;
  sessionId: string;
  agentId: string;
  content: string;
  createdAt: string;
}

export interface Escalation {
  id: string;
  sessionId: string;
  type: EscalationType;
  reason: string | null;
  requestedBy: string;
  createdAt: string;
}

export interface AgentHealth {
  agentId: string;
  today: {
    sessions: number;
    highRiskSessions: number;
    filteredAbuseCount: number;
    recommendedBreakMinutes: number;
  };
}

export interface AdminAnalytics {
  totalSessions: number;
  highRiskSessions: number;
  avgThreat: number;
  filteredExpressionCount: number;
  topIntents: string[];
  classificationDistribution: Record<"A" | "B" | "C" | "D" | "E", number>;
}

export interface SessionListItem {
  id: string;
  agentId: string;
  status: SessionStatus | "waiting" | "paused" | "ending" | "failed";
  startedAt: string;
  endedAt: string | null;
  totalTurns: number;
  cumulativeThreat: number;
  finalClassification: "A" | "B" | "C" | "D" | "E" | null;
  finalAction:
    | "NORMAL"
    | "CAUTION"
    | "ESCALATE"
    | "TERMINATE_ALLOWED"
    | "LEGAL_ACTION"
    | null;
  coreDemands: string[];
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: string;
  payload: unknown;
  timestamp: string;
}

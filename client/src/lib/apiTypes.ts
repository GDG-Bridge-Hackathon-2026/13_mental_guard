// Backend response shapes — based on the official contract:
//
//   • Field names: snake_case throughout (REST + WS public DTOs)
//   • State enums (session/turn-level): lowercase
//       status, channel, language, speaker, source, delivery_method, mode
//   • ML / analysis-domain enums: keep domain values
//       classification (A..E), final_action / recommended_action.level
//       (NORMAL/CAUTION/...), metrics.emotion (ANGER/...), metrics.trend
//       (UP/DOWN/STABLE), summary.intent (LEGITIMATE_COMPLAINT/...)

export type BackendSessionStatus =
  | "created"
  | "waiting"
  | "active"
  | "paused"
  | "ending"
  | "ended"
  | "failed";

export type BackendChannel = "voice" | "text" | "mixed";
export type BackendLanguage = "ko" | "ja" | "en" | "auto";
export type BackendMode = "caption_relay" | "text_only" | "demo";
export type BackendActionLevel =
  | "NORMAL"
  | "CAUTION"
  | "ESCALATE"
  | "TERMINATE_ALLOWED"
  | "LEGAL_ACTION";
export type BackendClassification = "A" | "B" | "C" | "D" | "E";
export type BackendTurnSpeaker = "caller" | "agent";
export type BackendTurnSource = "voice" | "text";
export type BackendDeliveryMethod = "caption" | "audio" | "text";

export interface BackendSession {
  id: string;
  agent_id: string;
  caller_id: string | null;
  channel: BackendChannel;
  language: BackendLanguage;
  mode: BackendMode;
  status: BackendSessionStatus;
  started_at: string;
  ended_at: string | null;
  total_turns: number;
  cumulative_threat: number;
  factual_ratio_avg: number;
  repetition_avg: number;
  classification_distribution: Record<BackendClassification, number>;
  final_classification: BackendClassification | null;
  final_action: BackendActionLevel | null;
  legal_basis: string[] | null;
  core_demands: string[] | null;
  summary?: unknown;
  metadata?: Record<string, string> | null;
}

export interface BackendTurn {
  id: string;
  session_id: string;
  seq: number;
  speaker: BackendTurnSpeaker;
  source: BackendTurnSource;
  delivery_method: BackendDeliveryMethod;
  raw_text: string;
  raw_audio_url: string | null;
  stt_url: string | null;
  displayed_text: string | null;
  is_filtered: boolean;
  duration_ms: number | null;
  stt_confidence: number | null;
  latency_ms: number | null;
  timestamp: string;
}

export interface BackendAnalysisScripts {
  공감: string;
  단호: string;
  위로: string;
}

export interface BackendAnalysisMetrics {
  threat_level: number;
  emotion: "ANGER" | "FRUSTRATION" | "CYNICISM" | "CONFUSION" | "CALM";
  factual_ratio: number;
  repetition_score: number;
  trend: "UP" | "DOWN" | "STABLE";
}

export interface BackendAnalysisSummary {
  core_demand: string;
  intent:
    | "LEGITIMATE_COMPLAINT"
    | "VENT"
    | "THREAT"
    | "INSULT"
    | "INQUIRY";
  risk_keywords: string[];
}

export interface BackendRecommendedAction {
  level: BackendActionLevel;
  scripts: BackendAnalysisScripts;
  legal_basis: string | null;
}

export interface BackendAnalysis {
  id: string;
  turn_id: string;
  refined: string;
  metrics: BackendAnalysisMetrics;
  summary: BackendAnalysisSummary;
  classification: BackendClassification;
  preserved_facts: string[];
  removed_expressions: string[];
  abuse_types: string[];
  confidence: number;
  recommended_action: BackendRecommendedAction;
  created_at: string;
}

export interface BackendSessionUpdate {
  total_turns: number;
  cumulative_threat: number;
  classification_distribution: Record<BackendClassification, number>;
  threshold_triggered: "WARNING" | "TERMINATE_ALLOWED" | null;
}

export interface BackendTurnEnvelope {
  turn: BackendTurn;
  analysis?: BackendAnalysis;
  session_update?: BackendSessionUpdate;
  delivered_to_caller?: boolean;
  playback_event_id?: string | null;
}

export interface BackendAgentTurnEnvelope {
  turn: BackendTurn;
  delivered_to_caller: boolean;
  playback_event_id: string | null;
}

export interface BackendSessionSummary {
  session_id: string;
  duration_seconds: number;
  final: {
    classification: BackendClassification;
    action: BackendActionLevel;
    legal_basis: string[];
  };
  cumulative: {
    total_turns: number;
    avg_threat: number;
    max_threat: number;
    factual_ratio: number;
    repetition_score: number;
    distribution: Record<BackendClassification, number>;
  };
  timeline: Array<{
    seq: number;
    timestamp: string;
    threat_level: number;
  }>;
  core_demands: string[];
  agent_response_summary: string[];
  caller_pattern: {
    is_repeat: boolean;
    similar_past_sessions: string[];
  } | null;
  agent_health: {
    today_high_risk_count: number;
    filtered_abuse_count: number;
    recommended_break_minutes: number;
  };
}

export interface BackendTranscriptResponse {
  session_id: string;
  view: "raw" | "clean" | "both";
  transcript: Array<{
    seq: number;
    speaker: BackendTurnSpeaker;
    raw_text?: string;
    displayed_text?: string | null;
    timestamp: string;
  }>;
}

export interface BackendNote {
  id: string;
  session_id: string;
  agent_id: string;
  content: string;
  created_at: string;
}

export interface BackendEscalation {
  id: string;
  session_id: string;
  agent_id?: string;
  type: "SUPERVISOR_CALL" | "TERMINATE" | "LEGAL_REPORT";
  reason: string | null;
  requested_by: string;
  created_at: string;
}

export interface BackendErrorBody {
  error: {
    code: string;
    message: string;
    retry_after?: number;
  };
}

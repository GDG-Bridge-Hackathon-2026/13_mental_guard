"use client";

import type {
  AdminAnalytics,
  AgentHealth,
  AgentTurn,
  CaptionTurn,
  Escalation,
  EscalationType,
  Note,
  RecommendedReply,
  ScriptTone,
  Session,
  SessionEvent,
  SessionListItem,
  SessionSummary,
  TranscriptItem,
} from "@/types/mvp";
import type { Lang } from "@/i18n/translations";
import {
  getApiBaseUrl,
  getRuntimeApiToken,
  langToLanguageHint,
} from "@/lib/apiConfig";
import type {
  BackendAgentTurnEnvelope,
  BackendAnalysis,
  BackendErrorBody,
  BackendEscalation,
  BackendNote,
  BackendSession,
  BackendSessionSummary,
  BackendTranscriptResponse,
  BackendTurn,
  BackendTurnEnvelope,
} from "@/lib/apiTypes";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;
  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const wantsAuth = init.auth !== false;
  // Respect an explicit Authorization header from the caller (used by
  // caller-page REST fallback to send the narrowly-scoped caller-token
  // instead of the agent's Firebase token). Only fall back to the runtime
  // token resolver when the caller didn't provide one.
  if (wantsAuth && !headers.has("Authorization")) {
    const token = getRuntimeApiToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, "NETWORK_ERROR", (e as Error).message || "Network error");
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const err = (body as BackendErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code || `HTTP_${res.status}`,
      err?.message || `Request failed: ${res.status} ${res.statusText}`,
      err?.retry_after
    );
  }
  return body as T;
}

// ------ adapters: backend -> frontend ------

function adaptSession(s: BackendSession): Session {
  const status: Session["status"] =
    s.status === "ended"
      ? "ended"
      : s.status === "created" || s.status === "waiting"
      ? "created"
      : "active";
  return {
    id: s.id,
    agentId: s.agent_id,
    status,
    startedAt: s.started_at,
    endedAt: s.ended_at,
  };
}

function adaptScripts(
  scripts: BackendAnalysis["recommended_action"]["scripts"] | undefined,
  turnId: string
): RecommendedReply[] {
  if (!scripts) return [];
  const out: RecommendedReply[] = [];
  if (scripts["공감"]) out.push({ id: `${turnId}_empathy`, tone: "공감", text: scripts["공감"] });
  if (scripts["단호"]) out.push({ id: `${turnId}_firm`, tone: "단호", text: scripts["단호"] });
  if (scripts["위로"]) out.push({ id: `${turnId}_comfort`, tone: "위로", text: scripts["위로"] });
  return out;
}

export function adaptCallerCaption(
  envelope: BackendTurnEnvelope
): CaptionTurn {
  const { turn, analysis } = envelope;
  const refined =
    analysis?.refined || turn.displayed_text || turn.raw_text || "";
  return {
    id: turn.id,
    seq: turn.seq,
    speaker: "caller",
    rawText: turn.raw_text,
    cleanCaption: refined,
    coreDemand: analysis?.summary?.core_demand,
    recommendedReplies: adaptScripts(
      analysis?.recommended_action?.scripts,
      turn.id
    ),
    detectedAbuseTypes: analysis?.abuse_types ?? [],
    timestamp: turn.timestamp,
  };
}

function adaptAgentTurn(turn: BackendTurn, delivered: boolean): AgentTurn {
  return {
    id: turn.id,
    seq: turn.seq,
    speaker: "agent",
    rawText: turn.raw_text,
    deliveredToCaller: delivered,
    timestamp: turn.timestamp,
  };
}

function formatComplaintCategory(
  classification: BackendSessionSummary["final"]["classification"],
  coreDemand: string | undefined,
  lang: Lang
): string {
  const labelByLang: Record<Lang, Record<string, string>> = {
    ko: {
      A: "일반 민원",
      B: "주의 민원",
      C: "악성 민원",
      D: "심각한 악성 민원",
      E: "법적 대응 검토 민원",
    },
    ja: {
      A: "通常の苦情",
      B: "注意が必要な苦情",
      C: "悪質な苦情",
      D: "深刻な悪質苦情",
      E: "法的対応検討案件",
    },
    en: {
      A: "Standard complaint",
      B: "Caution-level complaint",
      C: "Abusive complaint",
      D: "Severely abusive complaint",
      E: "Legal-action complaint",
    },
  };
  const tier = labelByLang[lang][classification] ?? classification;
  return coreDemand ? `${tier} · ${coreDemand}` : tier;
}

function actionToNextAction(
  action: BackendSessionSummary["final"]["action"],
  lang: Lang,
  legalBasis: string[]
): string {
  const dict: Record<Lang, Record<string, string>> = {
    ko: {
      NORMAL: "정상 종료. 상담 기록을 저장합니다.",
      CAUTION: "주의 단계. 상담 기록을 저장하고 필요 시 상급자 검토를 권장합니다.",
      ESCALATE: "상급자 연결을 권장합니다. 보고서를 작성해 공유하세요.",
      TERMINATE_ALLOWED: "통화 종료 권한이 부여되었습니다. 안내 후 종료를 진행하세요.",
      LEGAL_ACTION: "법적 대응 검토 단계입니다. 기록을 보존하고 담당 부서에 즉시 보고하세요.",
    },
    ja: {
      NORMAL: "通常終了。通話記録を保存します。",
      CAUTION: "注意レベル。記録を保存し、必要に応じて上司の確認を推奨します。",
      ESCALATE: "上司への取次ぎを推奨します。報告書を作成して共有してください。",
      TERMINATE_ALLOWED: "通話終了の権限が付与されました。案内のうえ終了してください。",
      LEGAL_ACTION: "法的対応の検討段階です。記録を保存し、担当部署へ直ちに報告してください。",
    },
    en: {
      NORMAL: "Normal close. Save the conversation record.",
      CAUTION: "Caution level. Save the record and route to a supervisor if needed.",
      ESCALATE: "Escalate to a supervisor. Draft a report and share it.",
      TERMINATE_ALLOWED: "Termination authorized. Inform the caller and end the call.",
      LEGAL_ACTION: "Legal action review. Preserve the record and report to the relevant team immediately.",
    },
  };
  const base = dict[lang][action] ?? dict[lang].NORMAL;
  if (legalBasis.length === 0) return base;
  const lead = lang === "ko" ? "근거" : lang === "ja" ? "根拠" : "Basis";
  return `${base} ${lead}: ${legalBasis.join(", ")}`;
}

function composeFinalSummary(
  s: BackendSessionSummary,
  lang: Lang
): string {
  const demands = s.core_demands.slice(0, 3);
  const responses = s.agent_response_summary.slice(0, 3);
  if (lang === "ko") {
    const d = demands.length
      ? `민원인은 ${demands.join(", ")} 등을 요구했습니다.`
      : "민원인의 핵심 요구가 명확히 분류되지 않았습니다.";
    const r = responses.length
      ? `접수인은 ${responses.join("; ")} 등으로 응대했습니다.`
      : "접수인 응답은 기록되지 않았습니다.";
    return `${d} ${r}`;
  }
  if (lang === "ja") {
    const d = demands.length
      ? `市民は ${demands.join("、")} などを要望しました。`
      : "市民の中心的な要望は明確に整理されていません。";
    const r = responses.length
      ? `オペレーターは ${responses.join("; ")} の対応を行いました。`
      : "オペレーターの応答は記録されていません。";
    return `${d} ${r}`;
  }
  const d = demands.length
    ? `The citizen asked for: ${demands.join(", ")}.`
    : "No clear primary demand was extracted.";
  const r = responses.length
    ? `The agent responded with: ${responses.join("; ")}.`
    : "No agent responses were recorded.";
  return `${d} ${r}`;
}

export function adaptSessionSummary(
  s: BackendSessionSummary,
  lang: Lang,
  detectedAbuseTypes: string[] = []
): SessionSummary {
  return {
    sessionId: s.session_id,
    durationSeconds: s.duration_seconds,
    coreDemands: s.core_demands,
    agentResponses: s.agent_response_summary,
    detectedAbuseTypes,
    finalSummary: composeFinalSummary(s, lang),
    recommendedNextAction: actionToNextAction(
      s.final.action,
      lang,
      s.final.legal_basis
    ),
    complaintCategory: formatComplaintCategory(
      s.final.classification,
      s.core_demands[0],
      lang
    ),
  };
}

export function adaptTranscript(
  res: BackendTranscriptResponse
): TranscriptItem[] {
  return res.transcript.map((t) => ({
    seq: t.seq,
    // Transcript uses lowercase speakers, unlike Turn which uses UPPERCASE.
    speaker: (typeof t.speaker === "string"
      ? (t.speaker.toLowerCase() as "caller" | "agent")
      : "caller"),
    rawText: t.raw_text ?? "",
    cleanCaption: t.displayed_text ?? null,
    timestamp: t.timestamp,
  }));
}

// ------ API methods (frontend types) ------

export interface CreateSessionOptions {
  agentId?: string;
  language: Lang;
}

export async function apiCreateSession(
  opts: CreateSessionOptions
): Promise<Session> {
  const body: Record<string, unknown> = {
    channel: "text",
    mode: "demo",
    language: langToLanguageHint(opts.language),
  };
  if (opts.agentId) body.agent_id = opts.agentId;
  const res = await request<{ session: BackendSession }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return adaptSession(res.session);
}

export interface CallerToken {
  token: string;
  expiresAt: string;
  wsUrls: {
    callerAudio: string;
    callerEvents: string;
  };
}

export async function apiMintCallerToken(
  sessionId: string,
  ttlSeconds?: number
): Promise<CallerToken> {
  const body: Record<string, unknown> = {};
  if (ttlSeconds !== undefined) body.ttl_seconds = ttlSeconds;
  const res = await request<{
    token: string;
    expires_at: string;
    ws_urls: { caller_audio: string; caller_events: string };
  }>(`/api/sessions/${encodeURIComponent(sessionId)}/caller-token`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    token: res.token,
    expiresAt: res.expires_at,
    wsUrls: {
      callerAudio: res.ws_urls.caller_audio,
      callerEvents: res.ws_urls.caller_events,
    },
  };
}

export async function apiRevokeCallerToken(sessionId: string): Promise<void> {
  await request<unknown>(
    `/api/sessions/${encodeURIComponent(sessionId)}/caller-token`,
    { method: "DELETE" }
  );
}

export async function apiStartSession(sessionId: string): Promise<Session> {
  const res = await request<{ session: BackendSession }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    }
  );
  return adaptSession(res.session);
}

export async function apiPostCallerTextTurn(
  sessionId: string,
  content: string,
  lang: Lang
): Promise<{ caption: CaptionTurn; envelope: BackendTurnEnvelope }> {
  const envelope = await request<BackendTurnEnvelope>(
    `/api/sessions/${encodeURIComponent(sessionId)}/turns`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "text",
        speaker: "caller",
        content,
        language_hint: langToLanguageHint(lang),
      }),
    }
  );
  return { caption: adaptCallerCaption(envelope), envelope };
}

export async function apiPostCallerAudioTurn(
  sessionId: string,
  audio: Blob,
  durationMs: number,
  lang: Lang,
  /** Optional caller-scope token. When provided, used for Authorization
   *  instead of the runtime (Firebase / dev) token. */
  tokenOverride?: string
): Promise<{ caption: CaptionTurn; envelope: BackendTurnEnvelope }> {
  const fd = new FormData();
  // New official contract: state enums (speaker, language) are lowercase.
  fd.append("speaker", "caller");
  fd.append("audio", audio, "caller-turn.webm");
  fd.append("language_hint", langToLanguageHint(lang));
  fd.append("duration_ms", String(durationMs));

  const headers: Record<string, string> = {};
  if (tokenOverride) headers["Authorization"] = `Bearer ${tokenOverride}`;

  const envelope = await request<BackendTurnEnvelope>(
    `/api/sessions/${encodeURIComponent(sessionId)}/turns`,
    { method: "POST", body: fd, headers }
  );
  return { caption: adaptCallerCaption(envelope), envelope };
}

export async function apiPostAgentTextTurn(
  sessionId: string,
  content: string
): Promise<AgentTurn> {
  const res = await request<BackendAgentTurnEnvelope>(
    `/api/sessions/${encodeURIComponent(sessionId)}/agent-turns`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
  return adaptAgentTurn(res.turn, res.delivered_to_caller);
}

export async function apiEndSession(
  sessionId: string,
  lang: Lang,
  detectedAbuseTypes: string[]
): Promise<SessionSummary> {
  const res = await request<{ summary: BackendSessionSummary }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/end`,
    {
      method: "PATCH",
      body: JSON.stringify({ generate_summary: true, save_audio: false, reason: "normal" }),
    }
  );
  return adaptSessionSummary(res.summary, lang, detectedAbuseTypes);
}

export async function apiGetSummary(
  sessionId: string,
  lang: Lang
): Promise<SessionSummary> {
  const res = await request<{ summary: BackendSessionSummary }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/summary`,
    { method: "GET" }
  );
  return adaptSessionSummary(res.summary, lang);
}

export async function apiGetTranscript(
  sessionId: string
): Promise<TranscriptItem[]> {
  const res = await request<BackendTranscriptResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/transcript?view=both`,
    { method: "GET" }
  );
  return adaptTranscript(res);
}

export async function apiHealth(): Promise<boolean> {
  try {
    const res = await request<{ ok: boolean }>("/health", {
      method: "GET",
      auth: false,
    });
    return !!res.ok;
  } catch {
    return false;
  }
}

// ------ list / detail / events ------

export interface ListSessionsFilters {
  agentId?: string;
  from?: string;
  to?: string;
  classification?: "A" | "B" | "C" | "D" | "E";
  status?:
    | "created"
    | "waiting"
    | "active"
    | "paused"
    | "ending"
    | "ended"
    | "failed";
  minThreat?: number;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface ListSessionsResponse {
  sessions: SessionListItem[];
  total: number;
  limit: number;
  offset: number;
}

function adaptSessionListItem(s: BackendSession): SessionListItem {
  // Backend `status` is already lowercase matching `SessionListItem["status"]`.
  return {
    id: s.id,
    agentId: s.agent_id,
    status: s.status,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    totalTurns: s.total_turns,
    cumulativeThreat: s.cumulative_threat,
    finalClassification: s.final_classification,
    finalAction: s.final_action,
    coreDemands: s.core_demands ?? [],
  };
}

export async function apiListSessions(
  filters: ListSessionsFilters = {}
): Promise<ListSessionsResponse> {
  const q = new URLSearchParams();
  if (filters.agentId) q.set("agent_id", filters.agentId);
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.classification) q.set("classification", filters.classification);
  if (filters.status) q.set("status", filters.status);
  if (filters.minThreat !== undefined)
    q.set("min_threat", String(filters.minThreat));
  if (filters.limit !== undefined) q.set("limit", String(filters.limit));
  if (filters.offset !== undefined) q.set("offset", String(filters.offset));
  if (filters.sort) q.set("sort", filters.sort);

  const qs = q.toString();
  const res = await request<{
    sessions: BackendSession[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/sessions${qs ? `?${qs}` : ""}`, { method: "GET" });

  return {
    sessions: res.sessions.map(adaptSessionListItem),
    total: res.total,
    limit: res.limit,
    offset: res.offset,
  };
}

export async function apiGetSession(sessionId: string): Promise<{
  session: Session;
  turns: BackendTurn[];
  analyses: BackendAnalysis[];
}> {
  const res = await request<{
    session: BackendSession;
    turns: BackendTurn[];
    analyses: BackendAnalysis[];
  }>(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "GET" });
  return {
    session: adaptSession(res.session),
    turns: res.turns,
    analyses: res.analyses,
  };
}

export function pairTurnsToCaptionsAndAgentTurns(
  turns: BackendTurn[],
  analyses: BackendAnalysis[]
): { captions: CaptionTurn[]; agentTurns: AgentTurn[] } {
  const analysisByTurnId = new Map<string, BackendAnalysis>();
  for (const a of analyses) analysisByTurnId.set(a.turn_id, a);

  const captions: CaptionTurn[] = [];
  const agentTurns: AgentTurn[] = [];
  for (const turn of turns) {
    if (turn.speaker === "caller") {
      const envelope: BackendTurnEnvelope = {
        turn,
        analysis: analysisByTurnId.get(turn.id),
      };
      captions.push(adaptCallerCaption(envelope));
    } else if (turn.speaker === "agent") {
      agentTurns.push({
        id: turn.id,
        seq: turn.seq,
        speaker: "agent",
        rawText: turn.raw_text,
        deliveredToCaller: true,
        timestamp: turn.timestamp,
      });
    }
  }
  return { captions, agentTurns };
}

export async function apiPatchSessionStatus(
  sessionId: string,
  status:
    | "created"
    | "waiting"
    | "active"
    | "paused"
    | "ending"
    | "ended"
    | "failed"
): Promise<Session> {
  const res = await request<{ session: BackendSession }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
  return adaptSession(res.session);
}

export async function apiGetEvents(
  sessionId: string
): Promise<SessionEvent[]> {
  const res = await request<{
    events: Array<{
      id: string;
      session_id: string;
      type: string;
      payload: unknown;
      timestamp: string;
    }>;
  }>(`/api/sessions/${encodeURIComponent(sessionId)}/events`, {
    method: "GET",
  });
  return res.events.map((e) => ({
    id: e.id,
    sessionId: e.session_id,
    type: e.type,
    payload: e.payload,
    timestamp: e.timestamp,
  }));
}

// ------ scripts ------

export async function apiRegenerateScript(
  turnId: string,
  tone: ScriptTone,
  additionalContext?: string
): Promise<{ tone: ScriptTone; script: string }> {
  const body: Record<string, unknown> = { tone };
  if (additionalContext) body.additional_context = additionalContext;
  return request<{ tone: ScriptTone; script: string }>(
    `/api/turns/${encodeURIComponent(turnId)}/scripts/regenerate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

// ------ notes ------

function adaptNote(n: BackendNote): Note {
  return {
    id: n.id,
    sessionId: n.session_id,
    agentId: n.agent_id,
    content: n.content,
    createdAt: n.created_at,
  };
}

export async function apiCreateNote(
  sessionId: string,
  content: string
): Promise<{ noteId: string; createdAt: string }> {
  const res = await request<{ note_id: string; created_at: string }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
  return { noteId: res.note_id, createdAt: res.created_at };
}

export async function apiListNotes(sessionId: string): Promise<Note[]> {
  const res = await request<{ notes: BackendNote[] }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/notes`,
    { method: "GET" }
  );
  return res.notes.map(adaptNote);
}

// ------ escalations ------

function adaptEscalation(e: BackendEscalation): Escalation {
  return {
    id: e.id,
    sessionId: e.session_id,
    type: e.type,
    reason: e.reason,
    requestedBy: e.requested_by,
    createdAt: e.created_at,
  };
}

export async function apiCreateEscalation(
  sessionId: string,
  type: EscalationType,
  reason?: string
): Promise<{ escalationId: string; status: "created" }> {
  const body: Record<string, unknown> = { type };
  if (reason) body.reason = reason;
  const res = await request<{ escalation_id: string; status: "created" }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/escalations`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  return { escalationId: res.escalation_id, status: res.status };
}

export async function apiListEscalations(
  sessionId: string
): Promise<Escalation[]> {
  const res = await request<{ escalations: BackendEscalation[] }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/escalations`,
    { method: "GET" }
  );
  return res.escalations.map(adaptEscalation);
}

// ------ feedback ------

export interface FeedbackInput {
  turnId?: string;
  field: string;
  expected: string;
  actual: string;
  comment?: string;
}

export async function apiSubmitFeedback(
  sessionId: string,
  input: FeedbackInput
): Promise<{ feedbackId: string; status: "saved" }> {
  const body: Record<string, unknown> = {
    field: input.field,
    expected: input.expected,
    actual: input.actual,
  };
  if (input.turnId) body.turn_id = input.turnId;
  if (input.comment) body.comment = input.comment;

  const res = await request<{ feedback_id: string; status: "saved" }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/feedback`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  return { feedbackId: res.feedback_id, status: res.status };
}

// ------ agent health ------

export async function apiGetAgentHealth(
  agentId: string
): Promise<AgentHealth> {
  const res = await request<{
    agent_id: string;
    today: {
      sessions: number;
      high_risk_sessions: number;
      filtered_abuse_count: number;
      recommended_break_minutes: number;
    };
  }>(`/api/agents/${encodeURIComponent(agentId)}/health`, { method: "GET" });
  return {
    agentId: res.agent_id,
    today: {
      sessions: res.today.sessions,
      highRiskSessions: res.today.high_risk_sessions,
      filteredAbuseCount: res.today.filtered_abuse_count,
      recommendedBreakMinutes: res.today.recommended_break_minutes,
    },
  };
}

// ------ admin analytics ------

export interface AdminAnalyticsFilters {
  from?: string;
  to?: string;
  department?: string;
  agentId?: string;
}

export async function apiGetAdminAnalytics(
  filters: AdminAnalyticsFilters = {}
): Promise<AdminAnalytics> {
  const q = new URLSearchParams();
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.department) q.set("department", filters.department);
  if (filters.agentId) q.set("agent_id", filters.agentId);
  const qs = q.toString();
  const res = await request<{
    total_sessions: number;
    high_risk_sessions: number;
    avg_threat: number;
    filtered_expression_count: number;
    top_intents: string[];
    classification_distribution: Record<"A" | "B" | "C" | "D" | "E", number>;
  }>(`/api/admin/analytics${qs ? `?${qs}` : ""}`, { method: "GET" });

  return {
    totalSessions: res.total_sessions,
    highRiskSessions: res.high_risk_sessions,
    avgThreat: res.avg_threat,
    filteredExpressionCount: res.filtered_expression_count,
    topIntents: res.top_intents,
    classificationDistribution: res.classification_distribution,
  };
}

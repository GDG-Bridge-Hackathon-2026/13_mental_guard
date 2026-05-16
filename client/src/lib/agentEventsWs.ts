"use client";

import type {
  BackendAnalysis,
  BackendSessionUpdate,
  BackendTurn,
} from "@/lib/apiTypes";

export type AgentEventsState =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export interface AgentEventsHandlers {
  onState?: (state: AgentEventsState) => void;
  onCaptionPartial?: (payload: {
    text: string;
    turnId?: string;
    seq?: number;
  }) => void;
  onCaptionFinal?: (payload: {
    turn: BackendTurn;
    analysis?: BackendAnalysis;
    session_update?: BackendSessionUpdate;
  }) => void;
  onRiskUpdate?: (payload: {
    cumulative_threat?: number;
    threshold_triggered?: "WARNING" | "TERMINATE_ALLOWED" | null;
    trend?: "UP" | "DOWN" | "STABLE";
  }) => void;
  onThresholdWarning?: (payload: { message?: string }) => void;
  onThresholdTerminateAllowed?: (payload: { message?: string }) => void;
  onAgentReplyDelivered?: (payload: {
    turn?: BackendTurn;
    audio_url?: string | null;
  }) => void;
  onCallerAudioStarted?: (payload: {
    source: "ws" | "rest";
    expectedDurationMs: number | null;
    timestamp?: string;
  }) => void;
  onCallerAudioEnded?: (payload: {
    source: "ws" | "rest";
    turnId: string | null;
    success: boolean;
    errorCode: string | null;
    errorMessage: string | null;
    timestamp?: string;
  }) => void;
  onSessionEnded?: () => void;
  onError?: (err: { code: string; message: string }) => void;
  onUnknown?: (raw: unknown) => void;
}

interface ServerMessage {
  type?: string;
  payload?: unknown;
  error?: { code: string; message: string };
}

const DEFAULT_RECONNECT_DELAYS_MS = [500, 1000, 2000, 5000, 10000];

export class AgentEventsWs {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: AgentEventsHandlers;
  private state: AgentEventsState = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  constructor(url: string, handlers: AgentEventsHandlers) {
    this.url = url;
    this.handlers = handlers;
  }

  getState(): AgentEventsState {
    return this.state;
  }

  connect() {
    if (this.ws && this.state === "open") return;
    this.intentionallyClosed = false;
    this.setState("connecting");
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.setState("error");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState("open");
    };
    this.ws.onmessage = (e) => this.handleMessage(e.data);
    this.ws.onerror = () => {
      this.setState("error");
    };
    this.ws.onclose = () => {
      this.setState("closed");
      this.ws = null;
      if (!this.intentionallyClosed) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay =
      DEFAULT_RECONNECT_DELAYS_MS[
        Math.min(
          this.reconnectAttempts,
          DEFAULT_RECONNECT_DELAYS_MS.length - 1
        )
      ];
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyClosed) this.connect();
    }, delay);
  }

  private setState(s: AgentEventsState) {
    if (this.state === s) return;
    this.state = s;
    this.handlers.onState?.(s);
  }

  private handleMessage(data: unknown) {
    if (typeof data !== "string") return;
    let msg: ServerMessage = {};
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    const h = this.handlers;
    const type = msg.type;
    const payload = (msg.payload ?? {}) as Record<string, unknown>;

    switch (type) {
      case "caption.partial":
        h.onCaptionPartial?.({
          text: String(payload.text ?? ""),
          turnId: (payload.turn_id as string | undefined) ?? undefined,
          seq: (payload.seq as number | undefined) ?? undefined,
        });
        break;
      case "caption.final":
        h.onCaptionFinal?.(
          payload as unknown as Parameters<
            NonNullable<AgentEventsHandlers["onCaptionFinal"]>
          >[0]
        );
        break;
      case "risk.update":
        h.onRiskUpdate?.(payload as Parameters<
          NonNullable<AgentEventsHandlers["onRiskUpdate"]>
        >[0]);
        break;
      case "threshold.warning":
        h.onThresholdWarning?.({
          message: (payload.message as string | undefined) ?? undefined,
        });
        break;
      case "threshold.terminate_allowed":
        h.onThresholdTerminateAllowed?.({
          message: (payload.message as string | undefined) ?? undefined,
        });
        break;
      case "agent.reply.delivered":
      case "agent.audio.ready":
        h.onAgentReplyDelivered?.(payload as Parameters<
          NonNullable<AgentEventsHandlers["onAgentReplyDelivered"]>
        >[0]);
        break;
      case "caller.audio.started":
        h.onCallerAudioStarted?.({
          source: (payload.source as "ws" | "rest" | undefined) ?? "ws",
          expectedDurationMs:
            typeof payload.expected_duration_ms === "number"
              ? (payload.expected_duration_ms as number)
              : null,
          timestamp: payload.timestamp as string | undefined,
        });
        break;
      case "caller.audio.ended":
        h.onCallerAudioEnded?.({
          source: (payload.source as "ws" | "rest" | undefined) ?? "ws",
          turnId: (payload.turn_id as string | undefined) ?? null,
          success: payload.success !== false,
          errorCode: (payload.error_code as string | null | undefined) ?? null,
          errorMessage:
            (payload.error_message as string | null | undefined) ?? null,
          timestamp: payload.timestamp as string | undefined,
        });
        break;
      case "session.ended":
        h.onSessionEnded?.();
        break;
      case "error":
        if (msg.error) h.onError?.(msg.error);
        break;
      default:
        h.onUnknown?.(msg);
    }
  }

  close() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.setState("closed");
  }
}

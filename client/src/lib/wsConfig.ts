"use client";

/**
 * WebSocket configuration for the live caller/agent streaming flow.
 *
 * Set NEXT_PUBLIC_BACKEND_WSS_URL (e.g. "wss://mental-guard.duckdns.org") to
 * enable the WS path. When unset, the app falls back to REST upload + 3s
 * polling — useful for local dev or if the backend WS endpoints are down.
 *
 * The URL conventions follow the backend spec:
 *   - caller audio out: /ws/sessions/:id/caller-audio?token=<callerToken>
 *   - caller events in: /ws/sessions/:id/caller-events?token=<callerToken>
 *   - agent events in:  /ws/sessions/:id/agent-events?token=<agentToken>
 *
 * The caller-token API also returns explicit ws_urls; those are preferred
 * when available since they may pin a backend-side path/version. The builders
 * below are used as a fallback when the backend doesn't supply explicit URLs
 * or for the agent side (which doesn't go through caller-token).
 */

export function getBackendWssBase(): string {
  const raw = process.env.NEXT_PUBLIC_BACKEND_WSS_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

export function isWsEnabled(): boolean {
  return getBackendWssBase().length > 0;
}

export function buildCallerAudioWsUrl(
  sessionId: string,
  callerToken: string
): string {
  const base = getBackendWssBase();
  if (!base) return "";
  return `${base}/ws/sessions/${encodeURIComponent(
    sessionId
  )}/caller-audio?token=${encodeURIComponent(callerToken)}`;
}

export function buildCallerEventsWsUrl(
  sessionId: string,
  callerToken: string
): string {
  const base = getBackendWssBase();
  if (!base) return "";
  return `${base}/ws/sessions/${encodeURIComponent(
    sessionId
  )}/caller-events?token=${encodeURIComponent(callerToken)}`;
}

export function buildAgentEventsWsUrl(
  sessionId: string,
  agentToken: string
): string {
  const base = getBackendWssBase();
  if (!base) return "";
  return `${base}/ws/sessions/${encodeURIComponent(
    sessionId
  )}/agent-events?token=${encodeURIComponent(agentToken)}`;
}

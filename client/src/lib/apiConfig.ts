"use client";

import type { Lang } from "@/i18n/translations";
import {
  getCachedFirebaseToken,
  waitForFirstAuthSettled,
} from "@/lib/firebase";

// Default to empty string (same-origin). The Next.js rewrites in
// next.config.js proxy /api/* and /health to the actual backend.
// In dev, you can override this with NEXT_PUBLIC_API_BASE_URL in .env.local
// to bypass the rewrite and hit the backend directly.
const DEFAULT_BASE_URL = "";

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
}

export function isRealApiEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_USE_REAL_API;
  if (v === undefined) return true;
  return v !== "0" && v.toLowerCase() !== "false";
}

let runtimeToken: string | null = null;

export function setRuntimeApiToken(token: string | null) {
  runtimeToken = token && token.trim() ? token.trim() : null;
}

const URL_TOKEN_STORAGE_KEY = "civilrelay-token-v1";
const CALLER_TOKEN_STORAGE_KEY = "civilrelay-caller-token-v1";

/**
 * Returns the caller-scope token (issued by POST /api/sessions/:id/caller-token).
 * Use this from the caller page ONLY — never for general API calls. The
 * caller-token is narrowly scoped (caller-audio/events WS + caller turns)
 * and would be rejected on most REST endpoints.
 */
export function getCallerScopeToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CALLER_TOKEN_STORAGE_KEY);
    return stored && stored.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

export function clearCallerScopeToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CALLER_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getRuntimeApiToken(): string | null {
  // 1) Firebase Auth (preferred): set by the onIdTokenChanged listener in
  //    firebase.ts. Auto-refreshes every ~55 min while user is signed in.
  const fb = getCachedFirebaseToken();
  if (fb) return fb;

  // 2) Runtime override (e.g., captureTokenFromUrlOnce).
  if (runtimeToken) return runtimeToken;

  // 3) Persisted dev override.
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(URL_TOKEN_STORAGE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch {
      // ignore
    }
  }

  // 4) Build-time dev token fallback (for unauthenticated dev sessions).
  const envToken = process.env.NEXT_PUBLIC_DEV_TOKEN?.trim();
  return envToken || null;
}

/**
 * Token resolver that waits for Firebase Auth to settle on first call.
 * Use this when a page may have just loaded (direct entry / refresh) and
 * the sync `getRuntimeApiToken()` could return null because Firebase hasn't
 * fired its first `onIdTokenChanged` callback yet.
 */
export async function getApiTokenAsync(): Promise<string | null> {
  await waitForFirstAuthSettled();
  return getRuntimeApiToken();
}

export function captureTokenFromUrlOnce() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("t");
    if (t && t.trim()) {
      window.localStorage.setItem(URL_TOKEN_STORAGE_KEY, t.trim());
      runtimeToken = t.trim();
      url.searchParams.delete("t");
      const cleaned = url.pathname + (url.search ? url.search : "") + url.hash;
      window.history.replaceState({}, "", cleaned);
    }
  } catch {
    // ignore
  }
}

/**
 * Caller-page-only: capture `?ct=<caller_token>` from the URL once, store it
 * separately from the general Firebase/dev token, and strip it from the URL.
 */
export function captureCallerTokenFromUrlOnce() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const ct = url.searchParams.get("ct");
    if (ct && ct.trim()) {
      window.localStorage.setItem(CALLER_TOKEN_STORAGE_KEY, ct.trim());
      url.searchParams.delete("ct");
      const cleaned = url.pathname + (url.search ? url.search : "") + url.hash;
      window.history.replaceState({}, "", cleaned);
    }
  } catch {
    // ignore
  }
}

/**
 * Resolve the user's UI language to a fixed STT language code. We avoid
 * `"auto"` because the backend's auto-detect occasionally mis-routes a
 * sentence to the wrong locale. Each UI language now has a 1:1 STT model
 * backing it (ko / ja / en) so the recognized text matches the speaker's
 * expected language.
 */
export function langToLanguageHint(lang: Lang): "ko" | "ja" | "en" {
  if (lang === "ja") return "ja";
  if (lang === "en") return "en";
  return "ko";
}

interface DecodedJwt {
  user_id?: string;
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  exp?: number;
}

function base64UrlDecode(seg: string): string {
  let s = seg.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  if (typeof atob === "function") return atob(s);
  // Node fallback (SSR build time): Buffer is available in Node only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.Buffer) return g.Buffer.from(s, "base64").toString("binary");
  return "";
}

function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = decodeURIComponent(
      Array.from(base64UrlDecode(parts[1]))
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json) as DecodedJwt;
  } catch {
    return null;
  }
}

export function getTokenAgentId(): string | null {
  const token = getRuntimeApiToken();
  if (!token) return null;
  const claims = decodeJwt(token);
  return claims?.user_id || claims?.sub || null;
}

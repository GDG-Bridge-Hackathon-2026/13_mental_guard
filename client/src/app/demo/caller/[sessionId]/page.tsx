"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useI18nStore } from "@/store/useI18nStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  captureCallerTokenFromUrlOnce,
  getCallerScopeToken,
  isRealApiEnabled,
} from "@/lib/apiConfig";
import { apiPostCallerAudioTurn, ApiError } from "@/lib/apiClient";
import {
  AudioCaptureUnsupportedError,
  createAudioCapture,
  type AudioCaptureHandle,
} from "@/lib/audioCapture";
import { buildCallerAudioWsUrl, isWsEnabled } from "@/lib/wsConfig";
import { CallerAudioWs } from "@/lib/callerAudioWs";

type CallerState =
  | "permission"
  | "ready"
  | "recording"
  | "submitting"
  | "sent"
  | "error"
  | "ended";

interface SubmittedItem {
  id: string;
  refined: string | null;
  raw: string | null;
  timestamp: string;
}

export default function CallerPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);

  const [state, setState] = useState<CallerState>("permission");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedItem[]>([]);
  const [level, setLevel] = useState(0);
  const captureRef = useRef<AudioCaptureHandle | null>(null);
  const detachMeterRef = useRef<(() => void) | null>(null);
  const audioWsRef = useRef<CallerAudioWs | null>(null);
  const wsMode = isRealApiEnabled() && isWsEnabled();

  const isSecure =
    typeof window !== "undefined" &&
    (window.isSecureContext || window.location.hostname === "localhost");

  const isSafari =
    typeof navigator !== "undefined" &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent || "");

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    // The caller page uses a narrowly-scoped caller-token captured from the
    // QR URL (?ct=...). It is intentionally separated from the agent's
    // Firebase token; mixing the two would let a citizen with the QR URL
    // pretend to be the agent.
    captureCallerTokenFromUrlOnce();
  }, []);

  useEffect(() => {
    return () => {
      detachMeterRef.current?.();
      captureRef.current?.destroy();
      audioWsRef.current?.close();
    };
  }, []);

  if (!sessionId) {
    return (
      <FullScreenMessage
        title={t.caller.sessionInvalid}
        kind="error"
      />
    );
  }

  const handleAcceptCall = async () => {
    setErrorMsg(null);
    try {
      const capture = await createAudioCapture();
      captureRef.current = capture;
      const detach = capture.attachLevelMeter(setLevel);
      detachMeterRef.current = detach;
      setState("ready");
    } catch (err) {
      if (err instanceof AudioCaptureUnsupportedError) {
        setErrorMsg(t.caller.httpsWarning);
      } else if (err instanceof DOMException && err.name === "NotAllowedError") {
        setErrorMsg(t.caller.statusPermission);
      } else {
        setErrorMsg((err as Error).message || t.caller.statusError);
      }
      setState("error");
    }
  };

  const ensureAudioWs = async (): Promise<CallerAudioWs | null> => {
    if (!wsMode) return null;
    const token = getCallerScopeToken();
    if (!token) return null;
    const url = buildCallerAudioWsUrl(sessionId, token);
    if (!url) return null;

    if (audioWsRef.current) return audioWsRef.current;

    const ws = new CallerAudioWs({
      url,
      onError: (err) =>
        console.warn(`[ws] caller-audio error: ${err.code} ${err.message}`),
    });
    try {
      await ws.connect();
      audioWsRef.current = ws;
      return ws;
    } catch (err) {
      console.warn("[ws] caller-audio connect failed, falling back to REST", err);
      audioWsRef.current = null;
      return null;
    }
  };

  const handleStartTalk = async () => {
    if (!captureRef.current) return;
    const capture = captureRef.current;
    const mimeType = capture.mimeType || "audio/webm";

    if (wsMode) {
      const ws = await ensureAudioWs();
      if (ws) {
        capture.startChunked((chunk, seq) => {
          void ws.sendChunk(chunk, seq, mimeType);
        }, 300);
        setState("recording");
        return;
      }
      // fall through to REST path if WS unavailable
    }
    capture.start();
    setState("recording");
  };

  const handleStopTalk = async () => {
    if (!captureRef.current) return;
    setState("submitting");

    const capture = captureRef.current;
    const usingWs = wsMode && audioWsRef.current?.getState() === "open";

    try {
      const { blob, durationMs } = await capture.stop();

      if (usingWs && audioWsRef.current) {
        // Wait for every pending audio.chunk to finish (base64 + ws.send)
        // before emitting audio.end, otherwise STT can mis-finalize on a
        // truncated stream.
        await audioWsRef.current.flushAndEnd(lang, durationMs);
        // In WS mode the agent side receives caption events via WS; the
        // caller doesn't get the analysis envelope synchronously. Show the
        // raw transcript stub once and let polling on the agent side render
        // the final refined caption.
        setSubmitted((arr) => [
          ...arr,
          {
            id: `ws_${Date.now()}`,
            refined: null,
            raw: null,
            timestamp: new Date().toISOString(),
          },
        ]);
        setState("sent");
        return;
      }

      if (!blob.size) {
        setState("ready");
        return;
      }

      if (!isRealApiEnabled()) {
        setSubmitted((arr) => [
          ...arr,
          {
            id: `local_${Date.now()}`,
            refined: null,
            raw: "(mock mode — audio captured but not uploaded)",
            timestamp: new Date().toISOString(),
          },
        ]);
        setState("sent");
        return;
      }

      const callerToken = getCallerScopeToken();
      const { caption } = await apiPostCallerAudioTurn(
        sessionId,
        blob,
        durationMs,
        lang,
        callerToken ?? undefined
      );
      setSubmitted((arr) => [
        ...arr,
        {
          id: caption.id,
          refined: caption.cleanCaption,
          raw: caption.rawText || null,
          timestamp: caption.timestamp,
        },
      ]);
      setState("sent");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(`${err.code}: ${err.message}`);
      } else {
        setErrorMsg((err as Error).message || t.caller.statusError);
      }
      setState("error");
    }
  };

  const handleAgain = () => {
    setErrorMsg(null);
    setState("ready");
  };

  const statusLabel = (() => {
    switch (state) {
      case "permission":
        return t.caller.statusPermission;
      case "ready":
        return t.caller.statusReady;
      case "recording":
        return t.caller.statusRecording;
      case "submitting":
        return t.caller.statusProcessing;
      case "sent":
        return t.caller.sent;
      case "error":
        return t.caller.statusError;
      case "ended":
        return t.caller.statusEnded;
    }
  })();

  return (
    <main className="min-h-screen flex flex-col bg-[#0e0d0b] text-white">
      <header className="px-5 pt-5 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-white/60">
          {t.caller.headerTitle}
        </div>
        <LanguageSwitcher />
      </header>

      {!isSecure && (
        <Banner kind="warn">{t.caller.httpsWarning}</Banner>
      )}
      {isSafari && isSecure && (
        <Banner kind="info">{t.caller.safariWarning}</Banner>
      )}

      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">
          {statusLabel}
        </div>

        <CallerOrb state={state} level={level} />

        <div className="mt-6 text-sm text-white/70 max-w-xs leading-relaxed min-h-[3em]">
          {errorMsg
            ? errorMsg
            : state === "ready" || state === "sent"
            ? t.caller.helperSpeakNow
            : state === "recording"
            ? t.caller.helperTapWhenDone
            : state === "submitting"
            ? t.caller.waitingAgent
            : null}
        </div>

        {state === "sent" && submitted.length > 0 && (
          <LastTurnCard
            item={submitted[submitted.length - 1]}
            cleanLabel={t.bubble.aiRefined}
          />
        )}
      </section>

      <section className="px-6 pb-10 flex flex-col items-center gap-3">
        {state === "permission" && (
          <>
            <button
              onClick={handleAcceptCall}
              className="w-full max-w-xs py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold text-base transition"
            >
              {t.caller.grantMic}
            </button>
            <div className="text-[11px] text-white/40">
              {t.caller.grantMicHint}
            </div>
          </>
        )}

        {state === "ready" && (
          <button
            onClick={handleStartTalk}
            className="w-full max-w-xs py-4 rounded-2xl bg-white text-[#0e0d0b] hover:bg-white/90 active:bg-white/80 font-semibold text-base transition"
          >
            {t.caller.startTalk}
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={handleStopTalk}
            className="w-full max-w-xs py-4 rounded-2xl bg-red-500 hover:bg-red-400 active:bg-red-600 text-white font-semibold text-base transition"
          >
            {t.caller.stopTalk}
          </button>
        )}

        {state === "submitting" && (
          <button
            disabled
            className="w-full max-w-xs py-4 rounded-2xl bg-white/10 text-white/50 font-semibold text-base"
          >
            {t.caller.submitting}
          </button>
        )}

        {state === "sent" && (
          <button
            onClick={handleAgain}
            className="w-full max-w-xs py-4 rounded-2xl bg-white text-[#0e0d0b] hover:bg-white/90 font-semibold text-base transition"
          >
            {t.caller.again}
          </button>
        )}

        {state === "error" && (
          <button
            onClick={() => {
              setErrorMsg(null);
              setState("permission");
            }}
            className="w-full max-w-xs py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-base transition"
          >
            {t.caller.grantMic}
          </button>
        )}
      </section>

      <div className="text-center text-[10px] text-white/30 pb-4 tabular-nums">
        {sessionId}
      </div>
    </main>
  );
}

function CallerOrb({ state, level }: { state: CallerState; level: number }) {
  const pulsing = state === "recording";
  const scale = 1 + (pulsing ? level * 0.35 : 0);

  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      {pulsing && (
        <div
          className="absolute inset-0 rounded-full bg-emerald-500/20"
          style={{ transform: `scale(${1.2 + level * 0.5})` }}
        />
      )}
      <div
        className={`relative w-36 h-36 rounded-full transition-transform duration-100 ${
          state === "recording"
            ? "bg-emerald-500"
            : state === "submitting"
            ? "bg-white/15"
            : state === "sent"
            ? "bg-white/95"
            : state === "error"
            ? "bg-red-500/80"
            : "bg-white/10"
        }`}
        style={{ transform: `scale(${scale})` }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {state === "submitting" ? (
            <span className="block w-10 h-10">
              <svg
                viewBox="0 0 100 100"
                className="spinner-rotate w-10 h-10 text-white"
                aria-hidden
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const opacity = 0.12 + (i / 11) * 0.88;
                  return (
                    <rect
                      key={i}
                      x="46"
                      y="6"
                      width="8"
                      height="22"
                      rx="4"
                      fill="currentColor"
                      opacity={opacity}
                      transform={`rotate(${i * 30} 50 50)`}
                    />
                  );
                })}
              </svg>
            </span>
          ) : (
            <MicIcon
              className={
                state === "sent"
                  ? "text-[#0e0d0b]"
                  : state === "recording"
                  ? "text-white"
                  : "text-white/70"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "warn" | "info";
  children: React.ReactNode;
}) {
  const cls =
    kind === "warn"
      ? "bg-amber-500/15 border-amber-500/30 text-amber-100"
      : "bg-white/5 border-white/15 text-white/70";
  return (
    <div
      className={`mx-5 mt-3 border ${cls} rounded-xl px-3 py-2 text-[11px] leading-relaxed`}
    >
      {children}
    </div>
  );
}

function LastTurnCard({
  item,
  cleanLabel,
}: {
  item: SubmittedItem;
  cleanLabel: string;
}) {
  return (
    <div className="mt-6 w-full max-w-xs text-left">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
        {cleanLabel}
      </div>
      <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
          {item.refined ?? item.raw ?? "—"}
        </p>
      </div>
    </div>
  );
}

function FullScreenMessage({
  title,
  kind,
}: {
  title: string;
  kind: "error" | "info";
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0e0d0b] text-white px-6 text-center">
      <div>
        <div
          className={`text-2xl mb-3 ${
            kind === "error" ? "text-red-400" : "text-white"
          }`}
        >
          {title}
        </div>
      </div>
    </main>
  );
}

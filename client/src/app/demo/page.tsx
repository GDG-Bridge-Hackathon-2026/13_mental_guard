"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useI18nStore } from "@/store/useI18nStore";
import { ChatThread } from "@/components/ChatThread";
import { RecommendedReplies } from "@/components/RecommendedReplies";
import { ComplaintSidebar } from "@/components/ComplaintSidebar";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { CallSummaryDialog } from "@/components/CallSummaryDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { EscalateMenu } from "@/components/EscalateMenu";
import { CallerInviteDialog } from "@/components/CallerInviteDialog";
import { withLoading } from "@/store/useLoadingStore";
import { getMockCallerTurns } from "@/mocks/mockTurns";
import { formatDuration } from "@/lib/formatters";
import { getRuntimeApiToken, isRealApiEnabled } from "@/lib/apiConfig";
import { apiGetSession, pairTurnsToCaptionsAndAgentTurns, adaptCallerCaption, ApiError } from "@/lib/apiClient";
import { buildAgentEventsWsUrl, isWsEnabled } from "@/lib/wsConfig";
import { AgentEventsWs, type AgentEventsState } from "@/lib/agentEventsWs";

export default function AgentChatPage() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const captions = useSessionStore((s) => s.captions);
  const agentTurns = useSessionStore((s) => s.agentTurns);
  const partialCaption = useSessionStore((s) => s.partialCaption);
  const isProcessing = useSessionStore((s) => s.isProcessing);
  const currentTurnIndex = useSessionStore((s) => s.currentTurnIndex);

  const createSession = useSessionStore((s) => s.createSession);
  const startSession = useSessionStore((s) => s.startSession);
  const pushNextCallerTurn = useSessionStore((s) => s.pushNextCallerTurn);
  const sendAgentReply = useSessionStore((s) => s.sendAgentReply);
  const endSession = useSessionStore((s) => s.endSession);
  const resetDemo = useSessionStore((s) => s.resetDemo);
  const summary = useSessionStore((s) => s.summary);
  const apiMode = useSessionStore((s) => s.apiMode);
  const callerSpeaking = useSessionStore((s) => s.callerSpeaking);
  const ingestRemoteTurns = useSessionStore((s) => s.ingestRemoteTurns);
  const ingestRemoteCaption = useSessionStore((s) => s.ingestRemoteCaption);
  const setPartialCaption = useSessionStore((s) => s.setPartialCaption);
  const setCallerSpeaking = useSessionStore((s) => s.setCallerSpeaking);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const i18nHydrated = useI18nStore((s) => s.hydrated);
  const i18nHydrate = useI18nStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!i18nHydrated) i18nHydrate();
  }, [i18nHydrated, i18nHydrate]);

  const [now, setNow] = useState<number>(() => Date.now());
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [wsState, setWsState] = useState<AgentEventsState>("idle");

  const isActive = session?.status === "active";
  const isEnded = session?.status === "ended";
  const totalTurns = getMockCallerTurns(lang).length;
  const remaining = totalTurns - currentTurnIndex;
  const latestCaption = captions[captions.length - 1];
  const recommendedReplies = latestCaption?.recommendedReplies ?? [];

  useEffect(() => {
    if (!isActive) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !session) return;
    if (!isRealApiEnabled() || apiMode !== "real") return;
    if (!isWsEnabled()) return;

    const token = getRuntimeApiToken();
    if (!token) return;
    const url = buildAgentEventsWsUrl(session.id, token);
    if (!url) return;

    // Safety net: if caller.audio.started arrives but caller.audio.ended
    // never comes (server crash, WS drop, etc.), auto-clear the speaking
    // indicator after 60s so it doesn't stick forever.
    let speakingWatchdog: ReturnType<typeof setTimeout> | null = null;
    const clearWatchdog = () => {
      if (speakingWatchdog) {
        clearTimeout(speakingWatchdog);
        speakingWatchdog = null;
      }
    };

    const ws = new AgentEventsWs(url, {
      onState: (s) => setWsState(s),
      onCaptionPartial: ({ text }) => setPartialCaption(text),
      onCaptionFinal: (payload) => {
        const caption = adaptCallerCaption({
          turn: payload.turn,
          analysis: payload.analysis,
        });
        ingestRemoteCaption(caption);
        // Belt-and-suspenders: final caption implies the audio finished
        // processing, so drop the speaking flag even if caller.audio.ended
        // happens to arrive after caption.final.
        setCallerSpeaking(false);
        clearWatchdog();
      },
      onCallerAudioStarted: () => {
        setCallerSpeaking(true);
        clearWatchdog();
        speakingWatchdog = setTimeout(() => {
          setCallerSpeaking(false);
          speakingWatchdog = null;
        }, 60_000);
      },
      onCallerAudioEnded: ({ success, errorCode, errorMessage }) => {
        setCallerSpeaking(false);
        clearWatchdog();
        if (!success) {
          console.warn(
            `[ws] caller.audio.ended failed: ${errorCode ?? "?"} ${errorMessage ?? ""}`
          );
        }
      },
      onError: (e) =>
        console.warn(`[ws] agent-events error: ${e.code} ${e.message}`),
      onSessionEnded: () => {
        console.info("[ws] session.ended received");
      },
    });
    ws.connect();
    return () => {
      ws.close();
      setWsState("idle");
      setPartialCaption(null);
      setCallerSpeaking(false);
      clearWatchdog();
    };
  }, [
    isActive,
    session,
    apiMode,
    ingestRemoteCaption,
    setPartialCaption,
    setCallerSpeaking,
  ]);

  useEffect(() => {
    if (!isActive || !session) return;
    if (!isRealApiEnabled() || apiMode !== "real") return;

    let cancelled = false;
    let consecutiveFailures = 0;

    const tick = async () => {
      try {
        const { turns, analyses } = await apiGetSession(session.id);
        if (cancelled) return;
        const paired = pairTurnsToCaptionsAndAgentTurns(turns, analyses);
        ingestRemoteTurns(paired);
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures += 1;
        if (err instanceof ApiError) {
          if (err.status === 404 || err.status === 401 || err.status === 403) {
            cancelled = true;
            return;
          }
        }
        if (consecutiveFailures >= 4) {
          cancelled = true;
        }
      }
    };

    void tick();
    const interval = setInterval(() => {
      if (!cancelled) void tick();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive, session, apiMode, ingestRemoteTurns]);

  const durationLabel = useMemo(() => {
    if (!session) return "00:00";
    const started = new Date(session.startedAt).getTime();
    const end = session.endedAt ? new Date(session.endedAt).getTime() : now;
    const secs = Math.max(0, Math.floor((end - started) / 1000));
    return formatDuration(secs);
  }, [session, now]);

  const handleStartCall = async () => {
    await withLoading(async () => {
      let current = session;
      if (!current) current = await createSession();
      if (current.status !== "active") await startSession();
    }, t.loading.connecting);
    if (isRealApiEnabled() && apiMode === "real") {
      setShowInviteDialog(true);
    } else {
      setTimeout(() => pushNextCallerTurn(), 250);
    }
  };

  const handleNextTurn = () => {
    if (currentTurnIndex >= totalTurns) return;
    pushNextCallerTurn();
  };

  const handleEnd = async () => {
    const result = await withLoading(
      () => endSession(),
      t.loading.endingCall
    );
    if (result) setShowSummaryDialog(true);
  };

  const handleReset = () => {
    setShowSummaryDialog(false);
    resetDemo();
    router.push("/demo");
  };

  const handleViewFullReport = () => {
    if (!session) return;
    setShowSummaryDialog(false);
    router.push(`/demo/summary/${session.id}`);
  };

  return (
    <main className="h-screen flex flex-col bg-canvas">
      <header className="flex items-center justify-between px-6 lg:px-10 py-3.5 border-b border-line bg-panel/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center text-canvas text-xs font-semibold">
              M
            </div>
            <span className="font-semibold tracking-tight text-ink group-hover:text-ink-mute transition">
              {t.brand.name}
            </span>
          </Link>
          <span className="text-ink-dim">/</span>
          <span className="text-sm text-ink-mute">{t.nav.agentConsole}</span>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {currentUser && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-ink/[0.04] border border-line">
              <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-semibold">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-ink font-medium hidden sm:inline">
                {currentUser.name}
              </span>
            </div>
          )}
          <SessionStatusBadge status={session?.status ?? null} />
          {isActive && (
            <>
              {(callerSpeaking || isProcessing || partialCaption) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/[0.08] border border-accent/30 text-accent text-xs font-medium">
                  <span className="relative inline-flex w-2 h-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                  </span>
                  <span>{t.agent.callerSpeaking}</span>
                </div>
              )}
              <span className="text-xs text-ink-mute tabular-nums">
                {durationLabel}
              </span>
              {isRealApiEnabled() && apiMode === "real" && session && (
                <button
                  type="button"
                  onClick={() => setShowInviteDialog(true)}
                  className="btn-ghost text-xs"
                >
                  {t.qr.showAgain}
                </button>
              )}
              <EscalateMenu />
              <button onClick={handleEnd} className="btn-danger text-xs">
                {t.agent.endCall}
              </button>
            </>
          )}
          {isEnded && session && (
            <>
              {summary && (
                <button
                  onClick={() => setShowSummaryDialog(true)}
                  className="btn-ghost text-xs"
                >
                  {t.agent.summary}
                </button>
              )}
              <button
                onClick={() => router.push(`/demo/summary/${session.id}`)}
                className="btn-primary text-xs"
              >
                {t.agent.fullReport}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        <section className="flex flex-col min-h-0 border-r border-line">
          {!isActive && !isEnded && captions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-soft border border-line mb-5">
                  <span className="text-accent text-xl">●</span>
                </div>
                <h1 className="text-xl font-semibold text-ink mb-2">
                  {t.agent.waitingTitle}
                </h1>
                <p className="text-sm text-ink-mute leading-relaxed mb-6 whitespace-pre-line">
                  {t.agent.waitingBody}
                </p>
                <button
                  onClick={handleStartCall}
                  className="btn-primary px-6 py-2.5"
                >
                  {t.agent.acceptCall}
                </button>
              </div>
            </div>
          ) : (
            <ChatThread
              captions={captions}
              agentTurns={agentTurns}
              isProcessing={callerSpeaking || isProcessing || !!partialCaption}
              isStarted={!!session && session.status !== "created"}
            />
          )}

          {(isActive || isEnded) && (
            <>
              {/* Pre-scripted utterance button — only shown in mock mode
                  (no real backend / WS available). In production, captions
                  come from the citizen via WS or REST. */}
              {apiMode === "mock" && isActive && remaining > 0 && (
                <div className="px-6 lg:px-10 pt-2">
                  <div className="max-w-3xl mx-auto flex items-center justify-between text-[11px] text-ink-dim">
                    <span>{t.agent.nextRemaining(remaining, totalTurns)}</span>
                    <button
                      onClick={handleNextTurn}
                      disabled={isProcessing}
                      className="btn-quiet text-xs"
                    >
                      {t.agent.nextUtterance}
                    </button>
                  </div>
                </div>
              )}
              <RecommendedReplies
                replies={recommendedReplies}
                onSelect={sendAgentReply}
                disabled={!isActive}
                isProcessing={callerSpeaking || isProcessing || !!partialCaption}
              />
            </>
          )}

          {isEnded && session && (
            <div className="px-6 lg:px-10 pb-6 pt-1">
              <div className="max-w-3xl mx-auto flex items-center justify-between surface-flat px-4 py-3">
                <span className="text-sm text-ink-mute">
                  {t.agent.callEnded}
                </span>
                <div className="flex gap-2">
                  <button onClick={handleReset} className="btn-ghost text-xs">
                    {t.agent.newCall}
                  </button>
                  {summary && (
                    <button
                      onClick={() => setShowSummaryDialog(true)}
                      className="btn-ghost text-xs"
                    >
                      {t.agent.showSummary}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/demo/summary/${session.id}`)}
                    className="btn-primary text-xs"
                  >
                    {t.agent.viewFullReport}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <ComplaintSidebar captions={captions} durationLabel={durationLabel} />
      </div>

      {showSummaryDialog && summary && (
        <CallSummaryDialog
          summary={summary}
          captions={captions}
          agentTurns={agentTurns}
          onClose={handleReset}
          onFullReport={handleViewFullReport}
          onNewCall={handleReset}
        />
      )}

      {session && (
        <CallerInviteDialog
          sessionId={session.id}
          open={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
        />
      )}
    </main>
  );
}

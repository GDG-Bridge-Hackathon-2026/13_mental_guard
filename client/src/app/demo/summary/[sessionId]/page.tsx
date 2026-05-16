"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { useI18nStore } from "@/store/useI18nStore";
import { buildEmptySummary } from "@/mocks/mockSummary";
import { findHistorySummary } from "@/mocks/mockHistory";
import { formatDuration } from "@/lib/formatters";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { apiGetSummary, ApiError } from "@/lib/apiClient";
import { isRealApiEnabled } from "@/lib/apiConfig";
import { waitForFirstAuthSettled } from "@/lib/firebase";
import { useLoadingStore } from "@/store/useLoadingStore";
import type { SessionSummary } from "@/types/mvp";

export default function SummaryPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const storeSummary = useSessionStore((s) => s.summary);
  const resetDemo = useSessionStore((s) => s.resetDemo);
  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);

  const [fallback, setFallback] = useState<SessionSummary | null>(null);
  const [remote, setRemote] = useState<SessionSummary | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    let cancelled = false;
    if (storeSummary) {
      setRemote(null);
      setFallback(null);
      return;
    }

    const stopLoading = useLoadingStore
      .getState()
      .begin(t.loading.fetchingSummary);

    (async () => {
      if (isRealApiEnabled()) {
        try {
          // Wait for Firebase Auth to settle so the Bearer header is present
          // on direct-entry loads (e.g. user opening the link in a new tab).
          await waitForFirstAuthSettled();
          const live = await apiGetSummary(params.sessionId, lang);
          if (!cancelled) setRemote(live);
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status !== 404 && err.status !== 409) {
            console.warn(
              `[apiClient] getSummary failed (${err.status} ${err.code}): ${err.message}`
            );
          }
        }
      }
      if (!cancelled) {
        // Last-resort fallback for direct-entry/refresh: try the demo
        // history (for `hist_*` ids), otherwise show an empty summary —
        // never the hardcoded "처리 지연 항의" demo content.
        const fromHistory = findHistorySummary(params.sessionId, lang);
        setFallback(fromHistory ?? buildEmptySummary(params.sessionId, 0, lang));
      }
    })().finally(() => stopLoading());
    return () => {
      cancelled = true;
      stopLoading();
    };
  }, [storeSummary, params.sessionId, lang, t.loading.fetchingSummary]);

  const summary = storeSummary ?? remote ?? fallback;

  if (!summary) {
    return (
      <main className="min-h-screen flex items-center justify-center text-ink-mute bg-canvas">
        {t.summary.loading}
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 bg-canvas">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-xs text-ink-mute hover:text-ink">
            {t.summary.back}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-xs text-ink-dim tabular-nums">
              {summary.sessionId}
            </div>
          </div>
        </div>

        <header className="mb-8">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-2">
            {t.summary.eyebrow}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">
            {summary.complaintCategory}
          </h1>
          <p className="text-ink-mute text-sm">
            {t.summary.durationLabel(formatDuration(summary.durationSeconds))}
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Section title={t.summary.keyDemands}>
            <ol className="space-y-2.5">
              {summary.coreDemands.map((d, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <span className="text-ink-dim font-medium tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink leading-relaxed">{d}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title={t.summary.agentResponses}>
            {summary.agentResponses.length === 0 ? (
              <p className="text-sm text-ink-dim">
                {t.summary.agentResponsesEmpty}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {summary.agentResponses.map((r, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="text-ink-dim mt-0.5">·</span>
                    <span className="text-ink leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title={t.summary.detected} className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {summary.detectedAbuseTypes.map((tag, idx) => (
              <span key={idx} className="chip-soft">
                {tag}
              </span>
            ))}
          </div>
        </Section>

        <Section title={t.summary.final} className="mb-4">
          <p className="text-sm leading-relaxed text-ink">{summary.finalSummary}</p>
        </Section>

        <Section title={t.summary.nextAction} className="mb-8 border-l-2 border-l-accent">
          <p className="text-sm leading-relaxed text-ink">
            {summary.recommendedNextAction}
          </p>
        </Section>

        <div className="flex gap-3 justify-end flex-wrap">
          <button
            onClick={() => {
              resetDemo();
              router.push("/");
            }}
            className="btn-ghost"
          >
            {t.summary.startNew}
          </button>
          <button
            onClick={() =>
              router.push(`/demo/sessions/${summary.sessionId}/timeline`)
            }
            className="btn-ghost"
          >
            {t.sessions.actionTimeline}
          </button>
          <button
            onClick={() => router.push(`/demo/sessions/${summary.sessionId}`)}
            className="btn-primary"
          >
            {t.summary.viewTranscript}
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface ${className}`}>
      <div className="px-5 py-3 border-b border-line">
        <h3 className="font-semibold text-ink">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

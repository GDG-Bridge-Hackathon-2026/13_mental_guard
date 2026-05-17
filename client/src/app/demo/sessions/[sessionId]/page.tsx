"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { useI18nStore } from "@/store/useI18nStore";
import { TranscriptCompare } from "@/components/TranscriptCompare";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getMockTranscript } from "@/mocks/mockApi";
import { apiGetTranscript, ApiError } from "@/lib/apiClient";
import { isRealApiEnabled } from "@/lib/apiConfig";
import { waitForFirstAuthSettled } from "@/lib/firebase";
import { useLoadingStore } from "@/store/useLoadingStore";
import type { TranscriptItem } from "@/types/mvp";

export default function SessionDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const agentTurns = useSessionStore((s) => s.agentTurns);
  const apiMode = useSessionStore((s) => s.apiMode);
  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);

  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    let cancelled = false;
    const stopLoading = useLoadingStore
      .getState()
      .begin(t.loading.fetchingTranscript);

    (async () => {
      let tr: TranscriptItem[] | null = null;
      if (isRealApiEnabled() && apiMode === "real") {
        try {
          await waitForFirstAuthSettled();
          tr = await apiGetTranscript(params.sessionId);
        } catch (err) {
          if (err instanceof ApiError) {
            console.warn(
              `[apiClient] getTranscript failed (${err.status} ${err.code}): ${err.message} — falling back to mock`
            );
          } else {
            console.warn("[apiClient] getTranscript failed — falling back to mock", err);
          }
        }
      }
      if (!tr) tr = await getMockTranscript(params.sessionId, agentTurns, lang);
      if (!cancelled) {
        setItems(tr);
        setLoading(false);
      }
    })().finally(() => stopLoading());
    return () => {
      cancelled = true;
      stopLoading();
    };
  }, [params.sessionId, agentTurns, lang, apiMode, t.loading.fetchingTranscript]);

  return (
    <main className="min-h-screen px-6 py-8 bg-canvas">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-xs text-ink-mute hover:text-ink">
            {t.summary.back}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-xs text-ink-dim tabular-nums">
              {params.sessionId}
            </div>
          </div>
        </div>

        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-2">
            {t.transcript.eyebrow}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">
            {t.transcript.title}
          </h1>
          <p className="text-ink-mute text-sm leading-relaxed">
            {t.transcript.description}
          </p>
        </header>

        {loading ? (
          <div className="text-ink-mute text-sm py-12 text-center">
            {t.transcript.loading}
          </div>
        ) : (
          <TranscriptCompare items={items} />
        )}

        <div className="flex justify-between mt-6 gap-2 flex-wrap">
          <button
            onClick={() => router.push(`/demo/summary/${params.sessionId}`)}
            className="btn-ghost"
          >
            {t.transcript.backSummary}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() =>
                router.push(`/demo/sessions/${params.sessionId}/timeline`)
              }
              className="btn-ghost"
            >
              {t.sessions.actionTimeline}
            </button>
            <button onClick={() => router.push("/")} className="btn-primary">
              {t.transcript.startNew}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

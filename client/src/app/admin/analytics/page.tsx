"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminAnalytics } from "@/types/mvp";
import { useI18nStore } from "@/store/useI18nStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isRealApiEnabled } from "@/lib/apiConfig";
import { apiGetAdminAnalytics, ApiError } from "@/lib/apiClient";
import { waitForFirstAuthSettled } from "@/lib/firebase";
import { useLoadingStore } from "@/store/useLoadingStore";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: AdminAnalytics }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

export default function AdminAnalyticsPage() {
  const t = useI18nStore((s) => s.t);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);

  const [state, setState] = useState<State>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    let cancelled = false;
    if (!isRealApiEnabled()) {
      setState({
        kind: "error",
        message: "Real API disabled — set NEXT_PUBLIC_USE_REAL_API=1.",
      });
      return;
    }
    setState({ kind: "loading" });
    const stopLoading = useLoadingStore
      .getState()
      .begin(t.loading.fetchingAnalytics);
    (async () => {
      try {
        await waitForFirstAuthSettled();
        const data = await apiGetAdminAnalytics({});
        if (!cancelled) setState({ kind: "ok", data });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 403) {
            setState({ kind: "forbidden" });
          } else {
            setState({
              kind: "error",
              message: `${err.status} ${err.code}: ${err.message}`,
            });
          }
        } else {
          setState({
            kind: "error",
            message: (err as Error).message ?? "Unknown error",
          });
        }
      }
    })().finally(() => stopLoading());
    return () => {
      cancelled = true;
      stopLoading();
    };
  }, [nonce, t.loading.fetchingAnalytics]);

  return (
    <main className="min-h-screen bg-canvas px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-xs text-ink-mute hover:text-ink">
            ← Home
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={() => setNonce((n) => n + 1)}
              className="btn-ghost text-xs"
            >
              {t.admin.refresh}
            </button>
          </div>
        </div>

        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-2">
            {t.admin.title}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">
            {t.admin.title}
          </h1>
          <p className="text-sm text-ink-mute">{t.admin.subtitle}</p>
        </header>

        {state.kind === "loading" && (
          <p className="text-sm text-ink-mute py-12 text-center">
            {t.admin.loading}
          </p>
        )}

        {state.kind === "forbidden" && (
          <div className="surface-flat p-6 text-center">
            <p className="text-sm text-ink">{t.admin.forbidden}</p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="surface-flat p-6 text-center">
            <p className="text-sm text-ink mb-2">Failed to load.</p>
            <p className="text-xs text-ink-dim">{state.message}</p>
          </div>
        )}

        {state.kind === "ok" && <AnalyticsView data={state.data} />}
      </div>
    </main>
  );
}

function AnalyticsView({ data }: { data: AdminAnalytics }) {
  const t = useI18nStore((s) => s.t);
  const tiers: Array<"A" | "B" | "C" | "D" | "E"> = ["A", "B", "C", "D", "E"];
  const total = tiers.reduce(
    (sum, k) => sum + (data.classificationDistribution[k] || 0),
    0
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label={t.admin.totalSessions} value={data.totalSessions} />
        <StatTile
          label={t.admin.highRiskSessions}
          value={data.highRiskSessions}
          emphasize
        />
        <StatTile
          label={t.admin.avgThreat}
          value={data.avgThreat.toFixed(2)}
        />
        <StatTile
          label={t.admin.filteredCount}
          value={data.filteredExpressionCount}
        />
      </div>

      <div className="surface-flat p-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2.5">
          {t.admin.distribution}
        </div>
        <div className="space-y-1.5">
          {tiers.map((k) => {
            const n = data.classificationDistribution[k] || 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="w-5 text-xs font-medium text-ink tabular-nums">
                  {k}
                </span>
                <div className="flex-1 h-2 bg-ink/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-ink-mute tabular-nums">
                  {n}
                </span>
                <span className="w-10 text-right text-[11px] text-ink-dim tabular-nums">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="surface-flat p-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2.5">
          {t.admin.topIntents}
        </div>
        {data.topIntents.length === 0 ? (
          <p className="text-xs text-ink-dim">—</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {data.topIntents.map((intent) => (
              <span key={intent} className="chip-soft">
                {intent}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number | string;
  emphasize?: boolean;
}) {
  return (
    <div className="surface-flat p-4">
      <div
        className={`text-2xl font-semibold tabular-nums ${
          emphasize ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-dim mt-0.5">{label}</div>
    </div>
  );
}

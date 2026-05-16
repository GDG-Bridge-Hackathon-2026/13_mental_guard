"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18nStore } from "@/store/useI18nStore";
import { useAuthStore } from "@/store/useAuthStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AuthMenu } from "@/components/AuthMenu";
import {
  apiGetAgentHealth,
  apiListSessions,
  ApiError,
} from "@/lib/apiClient";
import { getTokenAgentId, isRealApiEnabled } from "@/lib/apiConfig";
import { waitForFirstAuthSettled } from "@/lib/firebase";
import { formatDuration } from "@/lib/formatters";
import { LANG_LOCALES, type Lang } from "@/i18n/translations";
import type { AgentHealth, SessionListItem } from "@/types/mvp";

function classBadgeColor(c: SessionListItem["finalClassification"]): string {
  switch (c) {
    case "A":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "B":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "C":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "D":
      return "bg-red-50 text-red-700 border-red-200";
    case "E":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-ink/5 text-ink-mute border-line";
  }
}

function durationFromIso(start: string, end: string | null): number {
  if (!end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 1000);
}

export default function MyDashboardPage() {
  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);
  const currentUser = useAuthStore((s) => s.currentUser);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const authHydrate = useAuthStore((s) => s.hydrate);

  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [recent, setRecent] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);
  useEffect(() => {
    if (!authHydrated) authHydrate();
  }, [authHydrated, authHydrate]);

  useEffect(() => {
    if (!isRealApiEnabled()) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await waitForFirstAuthSettled();
        const agentId = getTokenAgentId() ?? currentUser?.id;
        if (!agentId) {
          setLoading(false);
          return;
        }
        const [h, list] = await Promise.allSettled([
          apiGetAgentHealth(agentId),
          apiListSessions({
            agentId,
            limit: 8,
            sort: "started_at:desc",
          }),
        ]);
        if (cancelled) return;
        if (h.status === "fulfilled") setHealth(h.value);
        else if (h.reason instanceof ApiError) {
          console.warn(
            `[me] agentHealth failed (${h.reason.status}): ${h.reason.message}`
          );
        }
        if (list.status === "fulfilled") setRecent(list.value.sessions);
        else if (list.reason instanceof ApiError) {
          console.warn(
            `[me] listSessions failed (${list.reason.status}): ${list.reason.message}`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="px-6 lg:px-10 py-4 flex items-center justify-between border-b border-line/60">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center text-canvas text-xs font-semibold">
            M
          </div>
          <span className="font-semibold tracking-tight text-ink">
            {t.brand.name}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <AuthMenu />
        </div>
      </header>

      <section className="px-6 lg:px-10 py-10 max-w-4xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">
            {t.me.title}
          </h1>
          {currentUser ? (
            <p className="text-sm text-ink-mute">
              {t.me.subtitle(currentUser.name)}
            </p>
          ) : (
            <p className="text-sm text-ink-mute">{t.me.notSignedIn}</p>
          )}
        </div>

        {currentUser && (
          <>
            {/* Stats */}
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
                {t.me.today}
              </div>
              <div className="surface-flat p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat
                  label={t.me.sessionsHandled}
                  value={health?.today.sessions ?? "—"}
                />
                <Stat
                  label={t.me.highRiskSessions}
                  value={health?.today.highRiskSessions ?? "—"}
                  emphasize={(health?.today.highRiskSessions ?? 0) > 0}
                />
                <Stat
                  label={t.me.filteredAbuse}
                  value={health?.today.filteredAbuseCount ?? "—"}
                />
                <Stat
                  label={t.me.recommendedBreak}
                  value={
                    health
                      ? health.today.recommendedBreakMinutes > 0
                        ? t.me.minutes(health.today.recommendedBreakMinutes)
                        : t.me.noBreak
                      : "—"
                  }
                />
              </div>
            </div>

            {/* Recent sessions */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wider text-ink-dim">
                  {t.me.recentSessions}
                </div>
                <Link
                  href="/sessions"
                  className="text-xs text-accent hover:text-accent/80"
                >
                  {t.me.seeAll}
                </Link>
              </div>

              <div className="surface-flat overflow-hidden">
                {loading ? (
                  <div className="py-12 text-center text-sm text-ink-mute">…</div>
                ) : recent.length === 0 ? (
                  <div className="py-12 text-center text-sm text-ink-mute">
                    {t.me.emptySessions}
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {recent.map((s) => (
                      <li key={s.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-6 rounded border text-xs font-medium ${classBadgeColor(s.finalClassification)}`}
                          >
                            {s.finalClassification ?? "—"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-ink truncate">
                              {s.coreDemands[0] ?? s.id}
                            </div>
                            <div className="text-[11px] text-ink-dim tabular-nums flex gap-3 mt-0.5">
                              <span>{formatDate(s.startedAt, lang)}</span>
                              <span>
                                {durationFromIso(s.startedAt, s.endedAt) > 0
                                  ? formatDuration(
                                      durationFromIso(s.startedAt, s.endedAt)
                                    )
                                  : "—"}
                              </span>
                              <span>{s.totalTurns} turns</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <Link
                              href={`/demo/summary/${s.id}`}
                              className="btn-ghost text-[11px] px-2 py-1"
                            >
                              {t.sessions.actionSummary}
                            </Link>
                            <Link
                              href={`/demo/sessions/${s.id}/timeline`}
                              className="btn-ghost text-[11px] px-2 py-1"
                            >
                              {t.sessions.actionTimeline}
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number | string;
  emphasize?: boolean;
}) {
  return (
    <div>
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

function formatDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleString(LANG_LOCALES[lang], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

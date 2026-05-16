"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18nStore } from "@/store/useI18nStore";
import { useAuthStore } from "@/store/useAuthStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AuthMenu } from "@/components/AuthMenu";
import {
  apiListSessions,
  ApiError,
  type ListSessionsFilters,
} from "@/lib/apiClient";
import { getTokenAgentId, isRealApiEnabled } from "@/lib/apiConfig";
import { waitForFirstAuthSettled } from "@/lib/firebase";
import { formatDuration } from "@/lib/formatters";
import { LANG_LOCALES, type Lang } from "@/i18n/translations";
import type { SessionListItem } from "@/types/mvp";

type StatusFilter = "all" | "active" | "ended";
type ClassificationFilter = "all" | "A" | "B" | "C" | "D" | "E";

const PAGE_SIZE = 20;

const CATEGORY_BY_CLASS: Record<Lang, Record<string, string>> = {
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

export default function SessionsListPage() {
  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);
  const localId = useAuthStore((s) => s.currentUser?.id);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [classification, setClassification] =
    useState<ClassificationFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    setPage(0);
  }, [status, classification]);

  useEffect(() => {
    if (!isRealApiEnabled()) {
      setSessions([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const filters: ListSessionsFilters = {
      agentId: getTokenAgentId() ?? localId,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      sort: "started_at:desc",
    };
    if (status !== "all") filters.status = status;
    if (classification !== "all") filters.classification = classification;

    (async () => {
      try {
        await waitForFirstAuthSettled();
        const res = await apiListSessions(filters);
        if (cancelled) return;
        setSessions(res.sessions);
        setTotal(res.total);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(`${err.code} (${err.status})`);
        } else {
          setError((err as Error).message ?? "Failed to load sessions");
        }
        setSessions([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, classification, page, localId]);

  // Client-side search across already-fetched page (server doesn't support
  // full-text yet).
  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      s.coreDemands.some((d) => d.toLowerCase().includes(q))
    );
  }, [sessions, query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-canvas">
      <header className="px-6 lg:px-10 py-4 flex items-center justify-between border-b border-line/60 bg-panel/60 backdrop-blur sticky top-0 z-20">
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

      <section className="px-6 lg:px-10 py-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">
            {t.sessions.title}
          </h1>
          <p className="text-sm text-ink-mute">{t.sessions.subtitle}</p>
        </div>

        {!currentUser && isRealApiEnabled() && (
          <div className="surface-flat p-6 text-center text-sm text-ink-mute mb-6">
            {t.me.notSignedIn}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.sessions.searchPlaceholder}
            className="surface-flat px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:outline-none focus:border-ink/30"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="surface-flat px-3 py-2 text-sm text-ink"
          >
            <option value="all">{t.sessions.filterStatus}: {t.sessions.filterAll}</option>
            <option value="active">{t.sessions.statusActive}</option>
            <option value="ended">{t.sessions.statusEnded}</option>
          </select>
          <select
            value={classification}
            onChange={(e) =>
              setClassification(e.target.value as ClassificationFilter)
            }
            className="surface-flat px-3 py-2 text-sm text-ink"
          >
            <option value="all">{t.sessions.filterClassification}: {t.sessions.filterAll}</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
          </select>
        </div>

        {error && (
          <div className="surface-flat p-4 mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="surface-flat overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1.2fr_0.8fr_0.7fr_0.7fr_auto] gap-3 px-4 py-2 border-b border-line text-[11px] uppercase tracking-wider text-ink-dim font-medium">
            <span>{t.sessions.columnCategory}</span>
            <span>{t.sessions.columnStarted}</span>
            <span>{t.sessions.columnDuration}</span>
            <span>{t.sessions.columnTurns}</span>
            <span>{t.sessions.columnClassification}</span>
            <span className="text-right">{t.sessions.columnAction}</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-ink-mute">…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-mute">
              {t.sessions.empty}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {filteredSessions.map((s) => {
                const cls = s.finalClassification;
                const category =
                  s.coreDemands[0] ??
                  (cls ? CATEGORY_BY_CLASS[lang][cls] : "—");
                const dur = durationFromIso(s.startedAt, s.endedAt);
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1.2fr_0.8fr_0.7fr_0.7fr_auto] gap-3 px-4 py-3 items-center hover:bg-ink/[0.02] transition"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">
                        {category}
                      </div>
                      <div className="text-[11px] text-ink-dim tabular-nums">
                        {s.id}
                      </div>
                    </div>
                    <div className="text-xs text-ink-mute tabular-nums">
                      {formatDate(s.startedAt, lang)}
                    </div>
                    <div className="text-xs text-ink-mute tabular-nums">
                      {dur > 0 ? formatDuration(dur) : "—"}
                    </div>
                    <div className="text-xs text-ink-mute tabular-nums">
                      {s.totalTurns}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center justify-center w-7 h-6 rounded border text-xs font-medium ${classBadgeColor(cls)}`}
                      >
                        {cls ?? "—"}
                      </span>
                    </div>
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      <Link
                        href={`/demo/summary/${s.id}`}
                        className="btn-ghost text-[11px] px-2 py-1"
                      >
                        {t.sessions.actionSummary}
                      </Link>
                      <Link
                        href={`/demo/sessions/${s.id}`}
                        className="btn-ghost text-[11px] px-2 py-1"
                      >
                        {t.sessions.actionTranscript}
                      </Link>
                      <Link
                        href={`/demo/sessions/${s.id}/timeline`}
                        className="btn-ghost text-[11px] px-2 py-1"
                      >
                        {t.sessions.actionTimeline}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 text-xs text-ink-mute">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.sessions.pagePrev}
            </button>
            <span className="tabular-nums">
              {t.sessions.pageOf(page + 1, totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages || loading}
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.sessions.pageNext}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function formatDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleString(LANG_LOCALES[lang], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

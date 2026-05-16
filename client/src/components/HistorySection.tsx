"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMockHistory } from "@/mocks/mockHistory";
import { formatDuration } from "@/lib/formatters";
import { useI18nStore } from "@/store/useI18nStore";
import { useAuthStore } from "@/store/useAuthStore";
import { LANG_LOCALES } from "@/i18n/translations";
import { getTokenAgentId, isRealApiEnabled } from "@/lib/apiConfig";
import { apiListSessions, ApiError } from "@/lib/apiClient";
import type { Lang } from "@/i18n/translations";
import type { SessionListItem } from "@/types/mvp";

interface Props {
  userName: string;
}

interface HistoryRow {
  sessionId: string;
  endedAt: string;
  durationSeconds: number;
  category: string;
  primaryDemand: string;
  demandCount: number;
  flagCount: number;
}

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

function durationFromIso(startIso: string, endIso: string | null): number {
  if (!endIso) return 0;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 1000);
}

function adaptListItem(item: SessionListItem, lang: Lang): HistoryRow {
  const cls = item.finalClassification ?? "A";
  const category = CATEGORY_BY_CLASS[lang][cls] ?? cls;
  const primary = item.coreDemands[0] ?? "";
  return {
    sessionId: item.id,
    endedAt: item.endedAt ?? item.startedAt,
    durationSeconds: durationFromIso(item.startedAt, item.endedAt),
    category,
    primaryDemand: primary,
    demandCount: item.coreDemands.length,
    flagCount:
      item.cumulativeThreat >= 4 ? 3 : item.cumulativeThreat >= 2 ? 1 : 0,
  };
}

function mockToRows(lang: Lang): HistoryRow[] {
  return getMockHistory(lang).map((h) => ({
    sessionId: h.sessionId,
    endedAt: h.endedAt,
    durationSeconds: h.summary.durationSeconds,
    category: h.summary.complaintCategory,
    primaryDemand: h.summary.coreDemands[0] ?? "",
    demandCount: h.summary.coreDemands.length,
    flagCount: h.summary.detectedAbuseTypes.length,
  }));
}

export function HistorySection({ userName }: Props) {
  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const localId = useAuthStore((s) => s.currentUser?.id);
  const [rows, setRows] = useState<HistoryRow[]>(() => mockToRows(lang));

  useEffect(() => {
    let cancelled = false;
    if (!isRealApiEnabled()) {
      setRows(mockToRows(lang));
      return;
    }
    const effectiveAgentId = getTokenAgentId() ?? localId;
    (async () => {
      try {
        const list = await apiListSessions({
          agentId: effectiveAgentId,
          status: "ended",
          limit: 20,
          sort: "started_at:desc",
        });
        if (cancelled) return;
        if (list.sessions.length === 0) {
          setRows(mockToRows(lang));
          return;
        }
        setRows(list.sessions.map((s) => adaptListItem(s, lang)));
      } catch (err) {
        if (err instanceof ApiError) {
          console.warn(
            `[apiClient] listSessions failed (${err.status} ${err.code}): ${err.message} — falling back to mock`
          );
        }
        if (!cancelled) setRows(mockToRows(lang));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, localId]);

  return (
    <section className="px-6 py-12 lg:py-16 border-t border-line">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-1.5">
            {t.history.eyebrow}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-ink mb-1">
            {t.history.welcome(userName)}
          </h2>
          <p className="text-sm text-ink-mute">{t.history.sub}</p>
        </div>

        <div className="grid gap-2">
          {rows.map((h) => (
            <Link
              key={h.sessionId}
              href={`/demo/summary/${h.sessionId}`}
              className="group surface-flat hover:border-ink/20 hover:shadow-card transition-all p-4 flex items-center gap-4"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent-soft border border-line flex items-center justify-center text-accent text-sm font-semibold">
                {h.category.charAt(0)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-ink">
                    {h.category}
                  </span>
                  <span className="chip-soft text-[10px] py-0">
                    {t.history.demand(h.demandCount)}
                  </span>
                  {h.flagCount > 0 && (
                    <span className="chip-soft text-[10px] py-0">
                      {t.history.flag(h.flagCount)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-mute leading-relaxed line-clamp-1">
                  {h.primaryDemand}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-ink-mute tabular-nums">
                  {formatDate(h.endedAt, lang)}
                </div>
                <div className="text-[11px] text-ink-dim tabular-nums mt-0.5">
                  {formatDuration(h.durationSeconds)}
                </div>
              </div>

              <span className="text-ink-dim group-hover:text-ink transition flex-shrink-0">
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="text-[11px] text-ink-dim mt-4">{t.history.note}</p>
      </div>
    </section>
  );
}

function formatDate(iso: string, lang: keyof typeof LANG_LOCALES): string {
  return new Date(iso).toLocaleDateString(LANG_LOCALES[lang], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

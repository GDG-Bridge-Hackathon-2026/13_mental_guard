"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18nStore } from "@/store/useI18nStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AuthMenu } from "@/components/AuthMenu";
import { apiGetEvents, ApiError } from "@/lib/apiClient";
import { isRealApiEnabled } from "@/lib/apiConfig";
import { waitForFirstAuthSettled } from "@/lib/firebase";
import { LANG_LOCALES, type Lang } from "@/i18n/translations";
import type { SessionEvent } from "@/types/mvp";

type EventKind =
  | "session.status"
  | "session.ended"
  | "caption.partial"
  | "caption.final"
  | "risk.update"
  | "threshold.warning"
  | "threshold.terminate_allowed"
  | "agent.reply"
  | "agent.audio.ready"
  | "note.created"
  | "escalation.created"
  | "feedback.created"
  | string;

function eventLabel(kind: EventKind, t: ReturnType<typeof useI18nStore.getState>["t"]): string {
  switch (kind) {
    case "session.status":
      return t.timeline.sessionStatus;
    case "session.ended":
      return t.timeline.sessionEnded;
    case "caption.partial":
      return t.timeline.captionPartial;
    case "caption.final":
      return t.timeline.captionFinal;
    case "risk.update":
      return t.timeline.riskUpdate;
    case "threshold.warning":
      return t.timeline.thresholdWarning;
    case "threshold.terminate_allowed":
      return t.timeline.thresholdTerminate;
    case "agent.reply":
    case "agent.audio.ready":
      return t.timeline.agentReply;
    case "note.created":
      return t.timeline.note;
    case "escalation.created":
      return t.timeline.escalation;
    case "feedback.created":
      return t.timeline.feedback;
    default:
      return t.timeline.other;
  }
}

function eventTint(kind: EventKind): {
  bg: string;
  ring: string;
  dot: string;
} {
  switch (kind) {
    case "session.status":
    case "session.ended":
      return {
        bg: "bg-ink/[0.04]",
        ring: "ring-ink/10",
        dot: "bg-ink/40",
      };
    case "caption.partial":
    case "caption.final":
      return {
        bg: "bg-accent-soft",
        ring: "ring-accent/20",
        dot: "bg-accent",
      };
    case "risk.update":
      return {
        bg: "bg-amber-50",
        ring: "ring-amber-200",
        dot: "bg-amber-500",
      };
    case "threshold.warning":
      return {
        bg: "bg-orange-50",
        ring: "ring-orange-200",
        dot: "bg-orange-500",
      };
    case "threshold.terminate_allowed":
      return {
        bg: "bg-red-50",
        ring: "ring-red-200",
        dot: "bg-red-500",
      };
    case "agent.reply":
    case "agent.audio.ready":
      return {
        bg: "bg-ink",
        ring: "ring-ink/20",
        dot: "bg-ink",
      };
    case "escalation.created":
      return {
        bg: "bg-red-50",
        ring: "ring-red-200",
        dot: "bg-red-500",
      };
    case "note.created":
      return {
        bg: "bg-ink/[0.04]",
        ring: "ring-ink/10",
        dot: "bg-ink/40",
      };
    default:
      return {
        bg: "bg-ink/[0.03]",
        ring: "ring-ink/10",
        dot: "bg-ink/30",
      };
  }
}

function eventDetailLines(
  evt: SessionEvent,
  t: ReturnType<typeof useI18nStore.getState>["t"]
): string[] {
  const lines: string[] = [];
  const payload = (evt.payload ?? {}) as Record<string, unknown>;

  switch (evt.type) {
    case "session.status": {
      const status = payload.status as string | undefined;
      const message = payload.message as string | undefined;
      if (status) lines.push(`→ ${status}`);
      if (message) lines.push(message);
      break;
    }
    case "caption.partial": {
      const turn = payload.turn as { seq?: number } | undefined;
      const text = payload.text as string | undefined;
      if (turn?.seq !== undefined) lines.push(`seq ${turn.seq}`);
      if (text) lines.push(text);
      break;
    }
    case "caption.final": {
      const turn = payload.turn as
        | { seq?: number; displayed_text?: string | null; raw_text?: string }
        | undefined;
      const analysis = payload.analysis as
        | {
            classification?: string;
            core_demand?: string;
            threat_level?: number;
          }
        | undefined;
      if (turn?.seq !== undefined) lines.push(`seq ${turn.seq}`);
      if (turn?.displayed_text) lines.push(turn.displayed_text);
      else if (turn?.raw_text) lines.push(turn.raw_text);
      if (analysis?.classification)
        lines.push(`class ${analysis.classification}`);
      if (analysis?.threat_level !== undefined)
        lines.push(t.timeline.threatLevel(analysis.threat_level));
      if (analysis?.core_demand) lines.push(`▸ ${analysis.core_demand}`);
      break;
    }
    case "risk.update": {
      const cumulative = payload.cumulative_threat as number | undefined;
      const trend = payload.trend as string | undefined;
      const triggered = payload.threshold_triggered as string | null | undefined;
      if (cumulative !== undefined)
        lines.push(`cumulative threat ${cumulative.toFixed(2)}`);
      if (trend) lines.push(`trend ${trend}`);
      if (triggered) lines.push(`⚠ ${triggered}`);
      break;
    }
    case "threshold.warning":
    case "threshold.terminate_allowed": {
      const message = payload.message as string | undefined;
      if (message) lines.push(message);
      break;
    }
    case "escalation.created": {
      const type = payload.type as string | undefined;
      const reason = payload.reason as string | undefined;
      if (type) lines.push(type);
      if (reason) lines.push(reason);
      break;
    }
    case "note.created": {
      const content = payload.content as string | undefined;
      if (content) lines.push(content);
      break;
    }
    case "feedback.created": {
      const field = payload.field as string | undefined;
      const expected = payload.expected as string | undefined;
      const actual = payload.actual as string | undefined;
      if (field) lines.push(`field=${field}`);
      if (expected && actual) lines.push(`${actual} → ${expected}`);
      break;
    }
    case "agent.reply":
    case "agent.audio.ready": {
      const content = (payload.content || payload.text) as string | undefined;
      if (content) lines.push(content);
      break;
    }
  }

  return lines;
}

export default function TimelinePage() {
  const params = useParams<{ sessionId: string }>();
  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);

  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!isRealApiEnabled()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        await waitForFirstAuthSettled();
        const list = await apiGetEvents(params.sessionId);
        if (cancelled) return;
        list.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
        setEvents(list);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(`${err.code} (${err.status})`);
        } else {
          setError((err as Error).message ?? "Failed to load events");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

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

      <section className="px-6 lg:px-10 py-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/demo/summary/${params.sessionId}`}
            className="text-xs text-ink-mute hover:text-ink"
          >
            {t.timeline.backToSummary}
          </Link>
          <div className="text-xs text-ink-dim tabular-nums">
            {params.sessionId}
          </div>
        </div>

        <header className="mb-8">
          <div className="text-[11px] uppercase tracking-wider text-accent mb-2">
            {t.timeline.title}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">
            {t.timeline.title}
          </h1>
          <p className="text-ink-mute text-sm leading-relaxed">
            {t.timeline.subtitle}
          </p>
        </header>

        {error && (
          <div className="surface-flat p-4 mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-ink-mute">…</div>
        ) : events.length === 0 ? (
          <div className="surface-flat py-12 text-center text-sm text-ink-mute">
            {t.timeline.empty}
          </div>
        ) : (
          <ol className="relative pl-6">
            {/* vertical track */}
            <div
              className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-line"
              aria-hidden
            />
            {events.map((evt) => {
              const tint = eventTint(evt.type);
              const lines = eventDetailLines(evt, t);
              return (
                <li key={evt.id} className="relative mb-4 pl-2">
                  <span
                    className={`absolute -left-[20px] top-[7px] w-3.5 h-3.5 rounded-full ring-4 ${tint.dot} ${tint.ring}`}
                    aria-hidden
                  />
                  <div className={`${tint.bg} border border-line rounded-lg px-3.5 py-2.5`}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className="text-xs font-semibold text-ink">
                        {eventLabel(evt.type, t)}
                      </span>
                      <span className="text-[10px] text-ink-dim tabular-nums">
                        {formatDateTime(evt.timestamp, lang)}
                      </span>
                    </div>
                    {lines.length > 0 && (
                      <ul className="space-y-0.5">
                        {lines.map((line, i) => (
                          <li
                            key={i}
                            className="text-[12px] text-ink-mute leading-relaxed break-words"
                          >
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="text-[10px] text-ink-dim mt-1 tabular-nums">
                      {evt.type}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex justify-between mt-8">
          <Link
            href={`/demo/sessions/${params.sessionId}`}
            className="btn-ghost text-xs"
          >
            {t.timeline.backToTranscript}
          </Link>
          <Link
            href={`/demo/summary/${params.sessionId}`}
            className="btn-primary text-xs"
          >
            {t.timeline.backToSummary}
          </Link>
        </div>
      </section>
    </main>
  );
}

function formatDateTime(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleString(LANG_LOCALES[lang], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

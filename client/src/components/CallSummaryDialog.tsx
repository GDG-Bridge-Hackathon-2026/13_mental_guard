"use client";

import { useEffect, useMemo } from "react";
import type { AgentTurn, CaptionTurn, SessionSummary } from "@/types/mvp";
import { formatDuration, formatTime } from "@/lib/formatters";
import { useI18nStore } from "@/store/useI18nStore";

interface Props {
  summary: SessionSummary;
  captions: CaptionTurn[];
  agentTurns: AgentTurn[];
  onClose: () => void;
  onFullReport: () => void;
  onNewCall: () => void;
}

type RecapItem =
  | { kind: "caller"; turn: CaptionTurn }
  | { kind: "agent"; turn: AgentTurn };

export function CallSummaryDialog({
  summary,
  captions,
  agentTurns,
  onClose,
  onFullReport,
  onNewCall,
}: Props) {
  const t = useI18nStore((s) => s.t);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const items: RecapItem[] = useMemo(() => {
    const all: RecapItem[] = [
      ...captions.map((c) => ({ kind: "caller" as const, turn: c })),
      ...agentTurns.map((a) => ({ kind: "agent" as const, turn: a })),
    ];
    all.sort((a, b) => (a.turn.timestamp < b.turn.timestamp ? -1 : 1));
    return all;
  }, [captions, agentTurns]);

  const utteranceCount = captions.length + agentTurns.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="surface w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-summary-title"
      >
        <div className="px-6 py-4 border-b border-line flex items-start justify-between flex-shrink-0">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-accent mb-1">
              {t.dialog.ended}
            </div>
            <h2
              id="call-summary-title"
              className="text-lg font-semibold text-ink"
            >
              {summary.complaintCategory}
            </h2>
            <p className="text-xs text-ink-mute mt-0.5 tabular-nums">
              {t.dialog.duration(
                formatDuration(summary.durationSeconds),
                utteranceCount
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink p-1 -mr-1 -mt-1"
            aria-label={t.auth.closeAria}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <Section title={t.dialog.aboutTitle}>
            <p className="text-sm leading-relaxed text-ink">
              {summary.finalSummary}
            </p>
          </Section>

          <Section title={t.dialog.recapTitle(utteranceCount)}>
            {items.length === 0 ? (
              <p className="text-sm text-ink-dim italic">
                {t.dialog.recapEmpty}
              </p>
            ) : (
              <div className="space-y-2.5">
                {items.map((it, idx) =>
                  it.kind === "caller" ? (
                    <RecapBubble
                      key={`c-${it.turn.id}-${idx}`}
                      side="left"
                      label={t.bubble.citizen}
                      caption={t.bubble.aiRefined}
                      text={it.turn.cleanCaption}
                      time={it.turn.timestamp}
                    />
                  ) : (
                    <RecapBubble
                      key={`a-${it.turn.id}-${idx}`}
                      side="right"
                      label={t.bubble.you}
                      caption={t.bubble.voiceSent}
                      text={it.turn.rawText}
                      time={it.turn.timestamp}
                    />
                  )
                )}
              </div>
            )}
          </Section>

          <Section title={t.dialog.keyDemands}>
            {summary.coreDemands.length === 0 ? (
              <p className="text-sm text-ink-dim">{t.dialog.keyDemandsEmpty}</p>
            ) : (
              <ol className="space-y-2">
                {summary.coreDemands.map((d, idx) => (
                  <li key={idx} className="flex gap-2.5 text-sm">
                    <span className="text-ink-dim font-medium tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink leading-relaxed">{d}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {summary.agentResponses.length > 0 && (
            <Section title={t.dialog.yourResponses}>
              <ul className="space-y-2">
                {summary.agentResponses.map((r, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="text-ink-dim mt-0.5">·</span>
                    <span className="text-ink leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {summary.detectedAbuseTypes.length > 0 && (
            <Section title={t.dialog.detected}>
              <div className="flex flex-wrap gap-1.5">
                {summary.detectedAbuseTypes.map((tag, idx) => (
                  <span key={idx} className="chip-soft">
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          <div className="surface-flat border-l-2 border-l-accent p-4">
            <div className="text-[11px] uppercase tracking-wider text-accent mb-1.5 font-medium">
              {t.dialog.nextAction}
            </div>
            <p className="text-sm leading-relaxed text-ink">
              {summary.recommendedNextAction}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-line flex items-center justify-between gap-2 flex-shrink-0">
          <button onClick={onNewCall} className="btn-ghost text-sm">
            {t.dialog.startNewCall}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">
              {t.dialog.close}
            </button>
            <button onClick={onFullReport} className="btn-primary text-sm">
              {t.dialog.viewFullReport}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-dim font-medium mb-2">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function RecapBubble({
  side,
  label,
  caption,
  text,
  time,
}: {
  side: "left" | "right";
  label: string;
  caption: string;
  text: string;
  time: string;
}) {
  const isLeft = side === "left";
  return (
    <div
      className={
        isLeft
          ? "flex flex-col items-start max-w-[85%]"
          : "flex flex-col items-end max-w-[85%] ml-auto"
      }
    >
      <div className="flex items-baseline gap-1.5 mb-0.5 text-[10px]">
        <span className="font-medium text-ink-mute">{label}</span>
        <span className="text-ink-dim">·</span>
        <span className="text-ink-dim">{caption}</span>
        <span className="text-ink-dim">·</span>
        <span className="text-ink-dim tabular-nums">{formatTime(time)}</span>
      </div>
      <div
        className={
          isLeft
            ? "bg-bubble-incoming border border-line rounded-bubble rounded-tl-md px-3.5 py-2.5"
            : "bg-bubble-outgoing text-canvas rounded-bubble rounded-tr-md px-3.5 py-2.5"
        }
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

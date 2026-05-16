"use client";

import { useState } from "react";
import type { RecommendedReply, ScriptTone } from "@/types/mvp";
import { useI18nStore } from "@/store/useI18nStore";
import { useSessionStore } from "@/store/useSessionStore";

interface Props {
  replies: RecommendedReply[];
  onSelect: (text: string) => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

const KNOWN_TONES: ScriptTone[] = ["공감", "단호", "위로"];

export function RecommendedReplies({
  replies,
  onSelect,
  disabled,
  isProcessing,
}: Props) {
  const t = useI18nStore((s) => s.t);

  return (
    <div className="px-6 lg:px-10 pb-6 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-dim font-medium">
              {t.replies.title}
            </span>
            {isProcessing && (
              <span className="text-[11px] text-ink-dim">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            )}
          </div>
          <span className="text-[11px] text-ink-dim">{t.replies.hint}</span>
        </div>

        {replies.length === 0 ? (
          <EmptyState isProcessing={!!isProcessing} disabled={!!disabled} />
        ) : (
          <div className="grid gap-2">
            {replies.map((r, idx) => (
              <ReplyCard
                key={r.id}
                reply={r}
                index={idx}
                onSelect={onSelect}
                disabled={disabled}
              />
            ))}
          </div>
        )}

        <div className="text-[11px] text-ink-dim text-center mt-3">
          {t.replies.footnote}
        </div>
      </div>
    </div>
  );
}

function ReplyCard({
  reply,
  index,
  onSelect,
  disabled,
}: {
  reply: RecommendedReply;
  index: number;
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  const t = useI18nStore((s) => s.t);
  const regenerate = useSessionStore((s) => s.regenerateScriptForLatest);
  const letter = String.fromCharCode(65 + index);
  const [busy, setBusy] = useState(false);

  const tone = KNOWN_TONES.includes(reply.tone as ScriptTone)
    ? (reply.tone as ScriptTone)
    : null;

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tone || busy || disabled) return;
    setBusy(true);
    try {
      await regenerate(tone);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`group surface-flat hover:border-ink/20 hover:shadow-card transition-all flex items-start gap-3 p-4 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-ink/5 group-hover:bg-accent/10 group-hover:text-accent text-ink-mute flex items-center justify-center text-xs font-semibold tabular-nums transition">
        {letter}
      </div>

      <button
        type="button"
        onClick={() => onSelect(reply.text)}
        disabled={disabled}
        className="flex-1 min-w-0 text-left disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="chip-soft text-[10px] py-0">{reply.tone}</span>
        </div>
        <p className="text-sm leading-relaxed text-ink">{reply.text}</p>
      </button>

      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 self-stretch">
        <button
          type="button"
          onClick={() => onSelect(reply.text)}
          disabled={disabled}
          className="flex items-center gap-1.5 text-ink-dim hover:text-accent transition text-xs whitespace-nowrap disabled:cursor-not-allowed"
        >
          <VoiceIcon />
          <span>{t.replies.sendAsVoice}</span>
        </button>
        {tone && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={disabled || busy}
            className="text-[10px] text-ink-dim hover:text-ink transition disabled:cursor-not-allowed flex items-center gap-1"
          >
            <RefreshIcon spinning={busy} />
            <span>{busy ? t.actions.regenerating : t.actions.regenerate}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  isProcessing,
  disabled,
}: {
  isProcessing: boolean;
  disabled: boolean;
}) {
  const t = useI18nStore((s) => s.t);
  if (disabled) {
    return (
      <div className="surface-flat p-5 text-center">
        <p className="text-sm text-ink-mute">{t.replies.emptyDisabled}</p>
      </div>
    );
  }
  if (isProcessing) {
    return (
      <div className="surface-flat p-5 text-center">
        <p className="text-sm text-ink-mute">{t.replies.emptyProcessing}</p>
      </div>
    );
  }
  return (
    <div className="surface-flat p-5 text-center">
      <p className="text-sm text-ink-mute">{t.replies.emptyIdle}</p>
    </div>
  );
}

function VoiceIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : undefined}
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

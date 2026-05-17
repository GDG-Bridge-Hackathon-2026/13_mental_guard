"use client";

import { useState } from "react";
import { formatTime } from "@/lib/formatters";
import { useI18nStore } from "@/store/useI18nStore";
import { useSessionStore } from "@/store/useSessionStore";

interface IncomingProps {
  variant: "incoming";
  text: string;
  rawText?: string;
  timestamp: string;
  seq?: number;
  turnId?: string;
}

interface OutgoingProps {
  variant: "outgoing";
  text: string;
  timestamp: string;
}

interface SystemProps {
  variant: "system";
  text: string;
}

type Props = IncomingProps | OutgoingProps | SystemProps;

export function ChatMessage(props: Props) {
  const t = useI18nStore((s) => s.t);

  if (props.variant === "system") {
    return (
      <div className="flex justify-center py-2">
        <span className="chip-soft text-[11px]">{props.text}</span>
      </div>
    );
  }

  if (props.variant === "incoming") {
    return (
      <div className="flex gap-3 max-w-[78%]">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-soft border border-line flex items-center justify-center text-accent text-[11px] font-semibold">
          C
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-medium text-ink">
              {t.bubble.citizen}
            </span>
            <span className="chip-soft text-[10px] py-0">{t.bubble.aiRefined}</span>
            <span className="text-[10px] text-ink-dim">
              {formatTime(props.timestamp)}
            </span>
          </div>
          <div className="bg-bubble-incoming border border-line rounded-bubble rounded-tl-md px-4 py-3 shadow-bubble">
            <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap">
              {props.text}
            </p>
          </div>
          {props.turnId && (
            <FeedbackControls
              turnId={props.turnId}
              caption={props.text}
              rawText={props.rawText}
            />
          )}
        </div>
      </div>
    );
  }

  // outgoing
  return (
    <div className="flex flex-col items-end gap-1 max-w-[78%] ml-auto">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-ink-dim">
          {formatTime(props.timestamp)}
        </span>
        <span className="chip-soft text-[10px] py-0">{t.bubble.voiceSent}</span>
        <span className="text-xs font-medium text-ink">{t.bubble.myReply}</span>
      </div>
      <div className="bg-bubble-outgoing text-canvas rounded-bubble rounded-tr-md px-4 py-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{props.text}</p>
      </div>
    </div>
  );
}

function FeedbackControls({
  turnId,
  caption,
  rawText,
}: {
  turnId: string;
  caption: string;
  rawText?: string;
}) {
  const t = useI18nStore((s) => s.t);
  const submitFeedback = useSessionStore((s) => s.submitTurnFeedback);
  const recorded = useSessionStore((s) =>
    s.feedbackTurnIds.has(turnId)
  );
  const [mode, setMode] = useState<"idle" | "correcting">("idle");
  const [correction, setCorrection] = useState("");
  const [busy, setBusy] = useState(false);

  if (recorded) {
    return (
      <div className="mt-1.5 text-[10px] text-ink-dim">
        {t.actions.feedbackSaved}
      </div>
    );
  }

  const sendApproval = async () => {
    if (busy) return;
    setBusy(true);
    await submitFeedback({
      turnId,
      field: "refined",
      expected: caption,
      actual: caption,
      comment: "approved",
    });
    setBusy(false);
  };

  const submitCorrection = async () => {
    if (busy || !correction.trim()) return;
    setBusy(true);
    await submitFeedback({
      turnId,
      field: "refined",
      expected: correction.trim(),
      actual: caption,
      comment: rawText ? `raw=${rawText}` : "",
    });
    setBusy(false);
    setMode("idle");
    setCorrection("");
  };

  if (mode === "correcting") {
    return (
      <div className="mt-1.5 space-y-1.5 max-w-md">
        <textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          rows={2}
          placeholder={t.actions.feedbackCorrectionPlaceholder}
          className="w-full text-xs px-2 py-1.5 rounded-md border border-line bg-canvas focus:outline-none focus:border-ink/40 resize-none"
          maxLength={2000}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              setCorrection("");
            }}
            disabled={busy}
            className="btn-quiet text-[10px] px-2 py-0.5"
          >
            {t.actions.cancel}
          </button>
          <button
            type="button"
            onClick={submitCorrection}
            disabled={busy || !correction.trim()}
            className="btn-primary text-[10px] px-2 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.actions.feedbackSubmit}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={sendApproval}
        disabled={busy}
        aria-label={t.actions.feedbackHelpful}
        title={t.actions.feedbackHelpful}
        className="text-ink-dim hover:text-accent transition disabled:opacity-40"
      >
        <ThumbsUpIcon />
      </button>
      <button
        type="button"
        onClick={() => setMode("correcting")}
        disabled={busy}
        aria-label={t.actions.feedbackWrong}
        title={t.actions.feedbackWrong}
        className="text-ink-dim hover:text-accent transition disabled:opacity-40"
      >
        <ThumbsDownIcon />
      </button>
    </div>
  );
}

function ThumbsUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

export function TypingBubble() {
  const t = useI18nStore((s) => s.t);
  return (
    <div className="flex gap-3 max-w-[78%]">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-soft border border-line flex items-center justify-center text-accent text-[11px] font-semibold">
        C
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-medium text-ink">{t.bubble.citizen}</span>
          <span className="chip-soft text-[10px] py-0">{t.bubble.refining}</span>
        </div>
        <div className="inline-block bg-bubble-incoming border border-line rounded-bubble rounded-tl-md px-4 py-3 shadow-bubble">
          <span className="text-ink-mute">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        </div>
      </div>
    </div>
  );
}

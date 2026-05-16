"use client";

import { useEffect, useRef, useState } from "react";
import type { EscalationType } from "@/types/mvp";
import { useI18nStore } from "@/store/useI18nStore";
import { useSessionStore } from "@/store/useSessionStore";

interface Props {
  disabled?: boolean;
}

const TYPES: EscalationType[] = ["SUPERVISOR_CALL", "TERMINATE", "LEGAL_REPORT"];

export function EscalateMenu({ disabled }: Props) {
  const t = useI18nStore((s) => s.t);
  const record = useSessionStore((s) => s.recordEscalation);
  const escalations = useSessionStore((s) => s.escalations);

  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<EscalationType | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<EscalationType | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !activeType) return;
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveType(null);
        setReason("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, activeType]);

  const labelFor = (type: EscalationType) => {
    if (type === "SUPERVISOR_CALL") return t.actions.escalateSupervisor;
    if (type === "TERMINATE") return t.actions.escalateTerminate;
    return t.actions.escalateLegal;
  };

  const handleSubmit = async () => {
    if (!activeType || busy) return;
    setBusy(true);
    const res = await record(activeType, reason.trim() || undefined);
    setBusy(false);
    if (res) {
      setFlash(activeType);
      setTimeout(() => setFlash(null), 2200);
    }
    setActiveType(null);
    setReason("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t.actions.escalateMenu}
        {escalations.length > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-semibold tabular-nums">
            {escalations.length}
          </span>
        )}
      </button>

      {open && !activeType && (
        <div className="absolute right-0 top-full mt-1 w-52 z-30 surface-flat shadow-card p-1">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              className="block w-full text-left px-3 py-2 text-xs rounded-md hover:bg-ink/[0.04] text-ink transition"
            >
              {labelFor(type)}
            </button>
          ))}
        </div>
      )}

      {activeType && (
        <div className="absolute right-0 top-full mt-1 w-72 z-30 surface-flat shadow-card p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-dim font-medium">
            {labelFor(activeType)}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.actions.escalateReasonPlaceholder}
            rows={3}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-line bg-canvas focus:outline-none focus:border-ink/40 resize-none"
            maxLength={2000}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveType(null);
                setReason("");
              }}
              className="btn-quiet text-xs"
              disabled={busy}
            >
              {t.actions.cancel}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="btn-primary text-xs"
            >
              {busy ? t.actions.notesSaving : t.actions.escalateSubmit}
            </button>
          </div>
        </div>
      )}

      {flash && (
        <div className="absolute right-0 top-full mt-1 w-56 z-20 surface-flat shadow-card px-3 py-2 text-[11px] text-ink">
          {t.actions.escalateRecorded} · {labelFor(flash)}
        </div>
      )}
    </div>
  );
}

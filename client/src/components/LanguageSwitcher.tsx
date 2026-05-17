"use client";

import { useEffect, useRef, useState } from "react";
import { useI18nStore } from "@/store/useI18nStore";
import { LANG_LABELS, SUPPORTED_LANGS } from "@/i18n/translations";
import type { Lang } from "@/i18n/translations";

export function LanguageSwitcher() {
  const lang = useI18nStore((s) => s.lang);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);
  const setLang = useI18nStore((s) => s.setLang);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hydrated) {
    return <div className="h-8 w-20" aria-hidden />;
  }

  const choose = (next: Lang) => {
    setLang(next);
    setOpen(false);
  };

  const current = LANG_LABELS[lang];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-panel hover:border-ink/20 transition text-xs font-medium text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <GlobeIcon />
        <span className="tabular-nums">{current.code}</span>
        <span className="text-ink-dim text-[10px]">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1.5 min-w-[150px] surface shadow-card py-1 z-30"
        >
          {SUPPORTED_LANGS.map((code) => {
            const info = LANG_LABELS[code];
            const active = code === lang;
            return (
              <li key={code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => choose(code)}
                  className={
                    "w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition " +
                    (active
                      ? "bg-accent-soft text-accent"
                      : "text-ink hover:bg-ink/[0.04]")
                  }
                >
                  <span className="flex flex-col">
                    <span className="font-medium leading-tight">
                      {info.native}
                    </span>
                    <span className="text-[10px] text-ink-dim leading-tight">
                      {info.label}
                    </span>
                  </span>
                  <span className="text-[10px] text-ink-dim tabular-nums">
                    {info.code}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GlobeIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useI18nStore } from "@/store/useI18nStore";
import { AuthDialog } from "./AuthDialog";

export function AuthMenu() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const t = useI18nStore((s) => s.t);

  const [mode, setMode] = useState<"login" | "signup" | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!hydrated) {
    return <div className="h-9 w-40" aria-hidden />;
  }

  if (currentUser) {
    const initial = currentUser.name.charAt(0).toUpperCase();
    return (
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink/[0.04] border border-line hover:border-ink/20 transition"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {currentUser.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUser.photoURL}
              alt=""
              className="w-6 h-6 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[11px] font-semibold">
              {initial}
            </div>
          )}
          <span className="text-sm text-ink font-medium hidden sm:inline">
            {currentUser.name}
          </span>
          <ChevronIcon open={open} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1.5 w-52 z-30 surface-flat shadow-card py-1"
          >
            <div className="px-3 py-2 border-b border-line">
              <div className="text-xs text-ink-dim truncate">
                {currentUser.email}
              </div>
            </div>
            <MenuLink href="/me" label={t.nav.me} onClick={() => setOpen(false)} />
            <MenuLink
              href="/sessions"
              label={t.nav.sessions}
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href="/settings"
              label={t.nav.settings}
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href="/about"
              label={t.nav.about}
              onClick={() => setOpen(false)}
            />
            <div className="border-t border-line my-1" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="block w-full text-left px-3 py-2 text-xs text-ink hover:bg-ink/[0.04] transition"
            >
              {t.nav.logout}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Link
          href="/about"
          className="btn-quiet text-sm"
        >
          {t.nav.about}
        </Link>
        <button
          onClick={() => setMode("login")}
          className="btn-primary text-sm"
        >
          {t.nav.loginSignup}
        </button>
      </div>
      {mode && (
        <AuthDialog
          mode={mode}
          onClose={() => setMode(null)}
          onSwitch={(m) => setMode(m)}
        />
      )}
    </>
  );
}

function MenuLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block px-3 py-2 text-xs text-ink hover:bg-ink/[0.04] transition"
    >
      {label}
    </Link>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-ink-dim transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

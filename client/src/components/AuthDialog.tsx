"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useI18nStore } from "@/store/useI18nStore";

interface Props {
  mode: "login" | "signup";
  onClose: () => void;
  onSwitch: (mode: "login" | "signup") => void;
}

export function AuthDialog({ mode, onClose }: Props) {
  const loginGoogle = useAuthStore((s) => s.loginGoogle);
  const authError = useAuthStore((s) => s.authError);
  const t = useI18nStore((s) => s.t);

  const [submitting, setSubmitting] = useState(false);

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

  const isSignup = mode === "signup";

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const user = await loginGoogle();
      if (user) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="surface w-full max-w-md p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
      >
        <div className="flex items-start justify-between mb-1">
          <h2 id="auth-dialog-title" className="text-xl font-semibold text-ink">
            {isSignup ? t.auth.createAccount : t.auth.welcomeBack}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink p-1 -mr-1 -mt-1"
            aria-label={t.auth.closeAria}
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-ink-mute mb-5">
          Sign in with your Google account to access the agent console. Your
          name and profile photo will be shown to your team.
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-3 border border-line rounded-xl px-4 py-3 bg-panel hover:border-ink/30 hover:shadow-card transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          <span className="text-sm font-medium text-ink">
            {submitting ? "..." : "Continue with Google"}
          </span>
        </button>

        {authError && (
          <p className="text-[11px] text-red-600 mt-3 leading-relaxed break-words">
            {authError}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.04l3.007-2.333z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96l3.007 2.333C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

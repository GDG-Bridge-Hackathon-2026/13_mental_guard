"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useI18nStore } from "@/store/useI18nStore";
import { AuthMenu } from "@/components/AuthMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { HistorySection } from "@/components/HistorySection";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AgentHealthCard } from "@/components/AgentHealthCard";

export default function LandingPage() {
  const router = useRouter();
  const resetDemo = useSessionStore((s) => s.resetDemo);
  const currentUser = useAuthStore((s) => s.currentUser);
  const t = useI18nStore((s) => s.t);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  // Tracks whether the user pressed "Open Agent Console" while signed out.
  // When they then complete sign-in via the prompt, we auto-navigate to /demo.
  const [pendingEnter, setPendingEnter] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (pendingEnter && currentUser) {
      setPendingEnter(false);
      resetDemo();
      router.push("/demo");
    }
  }, [pendingEnter, currentUser, resetDemo, router]);

  const enterDemo = () => {
    resetDemo();
    router.push("/demo");
  };

  const handleSignedOutCta = () => {
    setShowLoginPrompt(true);
  };

  const handleStartLogin = () => {
    setShowLoginPrompt(false);
    setPendingEnter(true);
    setAuthMode("login");
  };

  const closeAuthDialog = () => {
    setAuthMode(null);
    // Drop the pending intent if user dismisses without signing in.
    if (!currentUser) setPendingEnter(false);
  };

  return (
    <main className="min-h-screen flex flex-col bg-canvas">
      <header className="px-6 lg:px-10 py-4 flex items-center justify-between border-b border-line/60">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center text-canvas text-xs font-semibold">
              M
            </div>
            <span className="font-semibold tracking-tight">{t.brand.name}</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <AuthMenu />
        </div>
      </header>

      {currentUser ? (
        <section className="px-6 py-12 lg:py-16 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="chip-soft mb-5">{t.landing.chip}</div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-4 text-ink">
              {t.landing.headlineLine1}
              <br />
              {t.landing.headlineLine2 && <>{t.landing.headlineLine2} </>}
              <span className="text-accent">{t.landing.headlineAccent}</span>
              {t.landing.headlineLine2 ? "." : ""}
            </h1>
            <p className="text-ink-mute leading-relaxed mb-7">
              {t.landing.subtitleSignedIn}
            </p>
            <div className="flex justify-center">
              <button
                onClick={enterDemo}
                className="btn-primary px-6 py-3 text-base"
              >
                {t.landing.cta}
              </button>
            </div>
            <AgentHealthCard />
          </div>
        </section>
      ) : (
        <section className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
          <div className="max-w-2xl">
            <div className="chip-soft mb-6">{t.landing.chip}</div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-5 text-ink">
              {t.landing.headlineLine1}
              <br />
              {t.landing.headlineLine2 && <>{t.landing.headlineLine2} </>}
              <span className="text-accent">{t.landing.headlineAccent}</span>
              {t.landing.headlineLine2 ? "." : ""}
            </h1>
            <p className="text-ink-mute leading-relaxed mb-10">
              {t.landing.subtitleSignedOut}
            </p>
            <div className="flex justify-center">
              <button
                onClick={handleSignedOutCta}
                className="btn-primary px-6 py-3 text-base"
              >
                {t.landing.cta}
              </button>
            </div>
            <div className="mt-8 text-xs text-ink-dim">
              {t.landing.signInHint}
            </div>
          </div>
        </section>
      )}

      {currentUser && <HistorySection userName={currentUser.name} />}

      {currentUser && <div className="flex-1" />}

      {showLoginPrompt && (
        <LoginRequiredDialog
          title={t.landing.loginRequiredTitle}
          body={t.landing.loginRequiredBody}
          loginLabel={t.landing.loginRequiredCta}
          cancelLabel={t.landing.loginRequiredCancel}
          onLogin={handleStartLogin}
          onClose={() => setShowLoginPrompt(false)}
        />
      )}

      {authMode && (
        <AuthDialog
          mode={authMode}
          onClose={closeAuthDialog}
          onSwitch={(m) => setAuthMode(m)}
        />
      )}
    </main>
  );
}

function LoginRequiredDialog({
  title,
  body,
  loginLabel,
  cancelLabel,
  onLogin,
  onClose,
}: {
  title: string;
  body: string;
  loginLabel: string;
  cancelLabel: string;
  onLogin: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="surface w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
      >
        <h2
          id="login-required-title"
          className="text-base font-semibold text-ink mb-1.5"
        >
          {title}
        </h2>
        <p className="text-sm text-ink-mute leading-relaxed mb-5">{body}</p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            {cancelLabel}
          </button>
          <button type="button" onClick={onLogin} className="btn-primary text-sm">
            {loginLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useI18nStore } from "@/store/useI18nStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AuthMenu } from "@/components/AuthMenu";
import { LANG_LABELS, SUPPORTED_LANGS, type Lang } from "@/i18n/translations";

export default function SettingsPage() {
  const t = useI18nStore((s) => s.t);
  const lang = useI18nStore((s) => s.lang);
  const setLang = useI18nStore((s) => s.setLang);
  const i18nHydrated = useI18nStore((s) => s.hydrated);
  const i18nHydrate = useI18nStore((s) => s.hydrate);

  const currentUser = useAuthStore((s) => s.currentUser);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const authHydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!i18nHydrated) i18nHydrate();
  }, [i18nHydrated, i18nHydrate]);
  useEffect(() => {
    if (!authHydrated) authHydrate();
  }, [authHydrated, authHydrate]);

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

      <section className="px-6 lg:px-10 py-10 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-6">
          {t.settings.title}
        </h1>

        {!currentUser ? (
          <div className="surface p-6">
            <h2 className="text-base font-semibold text-ink mb-1">
              {t.settings.notSignedInTitle}
            </h2>
            <p className="text-sm text-ink-mute mb-4">
              {t.settings.notSignedInBody}
            </p>
            <Link href="/" className="btn-primary text-sm">
              {t.summary.back.replace("← ", "")}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account */}
            <div className="surface">
              <div className="px-5 py-3 border-b border-line">
                <h2 className="font-semibold text-ink">
                  {t.settings.accountTitle}
                </h2>
              </div>
              <div className="px-5 py-4 flex items-center gap-4">
                {currentUser.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.photoURL}
                    alt=""
                    className="w-14 h-14 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center text-xl font-semibold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink-dim">
                    {t.settings.accountSignedInAs}
                  </div>
                  <div className="text-base font-semibold text-ink truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-xs text-ink-mute truncate mt-0.5">
                    {currentUser.email}
                  </div>
                  <div className="text-[10px] text-ink-dim mt-1 tabular-nums truncate">
                    {t.settings.accountUserId}: {currentUser.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="surface">
              <div className="px-5 py-3 border-b border-line">
                <h2 className="font-semibold text-ink">
                  {t.settings.languageTitle}
                </h2>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-ink-mute mb-3">
                  {t.settings.languageHint}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SUPPORTED_LANGS.map((code) => {
                    const info = LANG_LABELS[code];
                    const active = code === lang;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setLang(code as Lang)}
                        className={
                          "surface-flat px-3 py-2.5 text-left transition " +
                          (active
                            ? "border-accent/40 bg-accent/[0.06]"
                            : "hover:border-ink/20")
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-ink">
                              {info.native}
                            </div>
                            <div className="text-[10px] text-ink-dim">
                              {info.label}
                            </div>
                          </div>
                          <span className="text-[10px] text-ink-dim tabular-nums">
                            {info.code}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Session */}
            <div className="surface">
              <div className="px-5 py-3 border-b border-line">
                <h2 className="font-semibold text-ink">
                  {t.settings.sessionTitle}
                </h2>
              </div>
              <div className="px-5 py-4 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-mute leading-relaxed">
                  {t.settings.sessionLogoutDescription}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                  }}
                  className="btn-danger text-sm whitespace-nowrap"
                >
                  {t.settings.sessionLogout}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

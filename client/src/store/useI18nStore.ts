"use client";

import { create } from "zustand";
import { DICTIONARIES } from "@/i18n/dictionaries";
import type { Dictionary, Lang } from "@/i18n/translations";
import { SUPPORTED_LANGS } from "@/i18n/translations";

const STORAGE_KEY = "mentalguard-lang-v1";
const DEFAULT_LANG: Lang = "ko";

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LANGS as string[]).includes(stored)) {
      return stored as Lang;
    }
    const nav = window.navigator?.language?.toLowerCase() ?? "";
    if (nav.startsWith("ko")) return "ko";
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("en")) return "en";
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

interface I18nStore {
  lang: Lang;
  hydrated: boolean;
  t: Dictionary;
  hydrate: () => void;
  setLang: (lang: Lang) => void;
}

export const useI18nStore = create<I18nStore>((set) => ({
  lang: DEFAULT_LANG,
  hydrated: false,
  t: DICTIONARIES[DEFAULT_LANG],

  hydrate: () => {
    const lang = detectInitialLang();
    set({ lang, t: DICTIONARIES[lang], hydrated: true });
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  },

  setLang: (lang) => {
    set({ lang, t: DICTIONARIES[lang] });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* ignore */
      }
      document.documentElement.lang = lang;
    }
  },
}));

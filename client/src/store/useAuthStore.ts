"use client";

import { create } from "zustand";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  ensureFirebaseInitialized,
  getFirebaseAuth,
  googleProvider,
  isFirebaseConfigured,
} from "@/lib/firebase";

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
}

interface AuthStore {
  currentUser: DemoUser | null;
  hydrated: boolean;
  authError: string | null;
  hydrate: () => void;
  loginGoogle: () => Promise<DemoUser | null>;
  logout: () => Promise<void>;
}

const LEGACY_STORAGE_KEY = "mentalguard-auth-v1";

function adaptFirebaseUser(user: User): DemoUser {
  const fallbackName = user.email?.split("@")[0] || "User";
  const displayName = user.displayName?.trim() || fallbackName;
  return {
    id: user.uid,
    email: user.email ?? "",
    name: displayName,
    photoURL: user.photoURL ?? undefined,
  };
}

function clearLegacyAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

let authListenerAttached = false;

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: null,
  hydrated: false,
  authError: null,

  hydrate: () => {
    if (typeof window === "undefined") {
      set({ hydrated: true });
      return;
    }

    // One-time migration: nuke pre-Firebase fake auth so users don't see a
    // ghost "logged in" state from a previous demo session.
    clearLegacyAuthStorage();

    if (!isFirebaseConfigured()) {
      // Firebase not configured (dev mode without keys). Mark as hydrated
      // with no user; the app falls back to dev token for API calls.
      set({ hydrated: true });
      return;
    }

    ensureFirebaseInitialized();
    const auth = getFirebaseAuth();
    if (!auth) {
      set({ hydrated: true });
      return;
    }

    if (authListenerAttached) return;
    authListenerAttached = true;

    onAuthStateChanged(auth, (user) => {
      set({
        currentUser: user ? adaptFirebaseUser(user) : null,
        hydrated: true,
        authError: null,
      });
    });
  },

  loginGoogle: async () => {
    if (!isFirebaseConfigured()) {
      const msg = "Firebase is not configured";
      set({ authError: msg });
      return null;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      set({ authError: "Firebase auth unavailable" });
      return null;
    }
    try {
      set({ authError: null });
      const result = await signInWithPopup(auth, googleProvider);
      return adaptFirebaseUser(result.user);
    } catch (err) {
      const message = (err as Error).message || "Google login failed";
      set({ authError: message });
      // eslint-disable-next-line no-console
      console.warn("[auth] signInWithPopup failed", err);
      return null;
    }
  },

  logout: async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      set({ currentUser: null });
      return;
    }
    try {
      await signOut(auth);
      // onAuthStateChanged will fire and update currentUser → null.
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[auth] signOut failed", err);
    }
  },
}));

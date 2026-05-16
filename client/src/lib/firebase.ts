"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onIdTokenChanged,
  type Auth,
  type User,
} from "firebase/auth";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
  measurementId?: string;
}

function readConfig(): FirebaseConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

let app: FirebaseApp | null = null;
let cachedToken: string | null = null;
let cachedUser: User | null = null;
let initialized = false;
let firstAuthSettled = false;
const firstAuthWaiters: Array<() => void> = [];

function resolveFirstAuth() {
  if (firstAuthSettled) return;
  firstAuthSettled = true;
  while (firstAuthWaiters.length) {
    const fn = firstAuthWaiters.shift();
    fn?.();
  }
}

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Initialize Firebase + start the token listener. Safe to call multiple times.
 * Must be called from a client-side context (window must be available).
 */
export function ensureFirebaseInitialized(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (initialized) return app;
  initialized = true;

  const config = readConfig();
  if (!config) return null;

  app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);

  // onIdTokenChanged fires on:
  //   - sign-in / sign-out
  //   - automatic token refresh (every ~55 min while user is active)
  // Keeping `cachedToken` updated means getRuntimeApiToken() can stay sync.
  onIdTokenChanged(auth, async (user) => {
    cachedUser = user;
    if (user) {
      try {
        cachedToken = await user.getIdToken();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[firebase] getIdToken failed", err);
        cachedToken = null;
      }
    } else {
      cachedToken = null;
    }
    resolveFirstAuth();
  });

  return app;
}

/**
 * Resolve once Firebase Auth has fired its first `onIdTokenChanged` callback
 * — either with a signed-in user or with `null`. This is the safe gate to use
 * before reading `getCachedFirebaseToken()` on pages a user can hit directly
 * (e.g. `/demo/summary/[id]` via QR or shared link).
 *
 * If Firebase isn't configured at build time, resolves immediately.
 */
export function waitForFirstAuthSettled(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!isFirebaseConfigured()) return Promise.resolve();
  ensureFirebaseInitialized();
  if (firstAuthSettled) return Promise.resolve();
  return new Promise<void>((resolve) => {
    firstAuthWaiters.push(resolve);
  });
}

export function getFirebaseApp(): FirebaseApp | null {
  return ensureFirebaseInitialized();
}

export function getFirebaseAuth(): Auth | null {
  const a = ensureFirebaseInitialized();
  return a ? getAuth(a) : null;
}

export function getCachedFirebaseToken(): string | null {
  return cachedToken;
}

export function getCachedFirebaseUser(): User | null {
  return cachedUser;
}

export const googleProvider = new GoogleAuthProvider();

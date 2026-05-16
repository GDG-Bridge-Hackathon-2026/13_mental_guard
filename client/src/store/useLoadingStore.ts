"use client";

import { create } from "zustand";

interface LoadingState {
  count: number;
  message: string | null;
  begin: (message?: string) => () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  count: 0,
  message: null,
  begin: (message) => {
    set((s) => ({
      count: s.count + 1,
      message: message ?? s.message,
    }));
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      set((s) => {
        const next = Math.max(0, s.count - 1);
        return { count: next, message: next === 0 ? null : s.message };
      });
    };
  },
}));

export async function withLoading<T>(
  fn: () => Promise<T>,
  message?: string
): Promise<T> {
  const stop = useLoadingStore.getState().begin(message);
  try {
    return await fn();
  } finally {
    stop();
  }
}

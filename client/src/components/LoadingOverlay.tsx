"use client";

import { useEffect, useState } from "react";
import { useLoadingStore } from "@/store/useLoadingStore";

// Tiny delay before showing so quick (<150ms) calls don't flash the overlay.
const REVEAL_DELAY_MS = 120;

export function LoadingOverlay() {
  const active = useLoadingStore((s) => s.count > 0);
  const message = useLoadingStore((s) => s.message);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [active]);

  if (!active || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-canvas/55 backdrop-blur-sm"
    >
      <Spinner size={64} />
      {message && (
        <div className="text-xs text-ink-mute font-medium tracking-wide">
          {message}
        </div>
      )}
    </div>
  );
}

export function Spinner({ size = 48 }: { size?: number }) {
  const bars = 12;
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size }}
      className="spinner-rotate text-ink"
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => {
        const opacity = 0.12 + (i / (bars - 1)) * 0.88;
        return (
          <rect
            key={i}
            x="46"
            y="6"
            width="8"
            height="22"
            rx="4"
            fill="currentColor"
            opacity={opacity}
            transform={`rotate(${(i * 360) / bars} 50 50)`}
          />
        );
      })}
    </svg>
  );
}

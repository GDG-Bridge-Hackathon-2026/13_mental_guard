"use client";

import { useEffect, useState } from "react";
import type { AgentHealth } from "@/types/mvp";
import { useI18nStore } from "@/store/useI18nStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getTokenAgentId, isRealApiEnabled } from "@/lib/apiConfig";
import { apiGetAgentHealth, ApiError } from "@/lib/apiClient";

export function AgentHealthCard() {
  const t = useI18nStore((s) => s.t);
  const localId = useAuthStore((s) => s.currentUser?.id);
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "ok">(
    "idle"
  );

  useEffect(() => {
    if (!isRealApiEnabled()) {
      setState("idle");
      return;
    }
    const effectiveAgentId = getTokenAgentId() ?? localId;
    if (!effectiveAgentId) {
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const h = await apiGetAgentHealth(effectiveAgentId);
        if (!cancelled) {
          setHealth(h);
          setState("ok");
        }
      } catch (err) {
        if (err instanceof ApiError && err.status !== 404) {
          console.warn(
            `[apiClient] agentHealth failed (${err.status} ${err.code}): ${err.message}`
          );
        }
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localId]);

  if (state !== "ok" || !health) return null;

  const { today } = health;
  const hasAny =
    today.sessions > 0 ||
    today.highRiskSessions > 0 ||
    today.filteredAbuseCount > 0;

  return (
    <div className="mt-8 max-w-2xl mx-auto">
      <div className="text-[11px] uppercase tracking-wider text-accent mb-2">
        {t.health.title}
      </div>
      <div className="surface-flat p-4 grid grid-cols-3 gap-3">
        <Stat label={t.health.sessions} value={today.sessions} />
        <Stat
          label={t.health.highRisk}
          value={today.highRiskSessions}
          emphasize={today.highRiskSessions > 0}
        />
        <Stat label={t.health.filtered} value={today.filteredAbuseCount} />
      </div>
      <p className="text-[11px] text-ink-dim mt-2 text-center">
        {hasAny ? t.health.recommendedBreak(today.recommendedBreakMinutes) : t.health.empty}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`text-2xl font-semibold tabular-nums ${
          emphasize ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-dim mt-0.5">{label}</div>
    </div>
  );
}

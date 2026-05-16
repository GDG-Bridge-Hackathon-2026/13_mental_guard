"use client";

import type { SessionStatus } from "@/types/mvp";
import { useI18nStore } from "@/store/useI18nStore";

interface Props {
  status: SessionStatus | null;
}

export function SessionStatusBadge({ status }: Props) {
  const t = useI18nStore((s) => s.t);

  if (!status || status === "created") {
    return <span className="chip-soft">{t.status.standby}</span>;
  }
  if (status === "active") {
    return (
      <span className="chip border-accent/25 bg-accent/8 text-accent gap-1.5">
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-60" />
          <span className="relative rounded-full w-1.5 h-1.5 bg-accent" />
        </span>
        {t.status.onCall}
      </span>
    );
  }
  return <span className="chip-soft">{t.status.ended}</span>;
}

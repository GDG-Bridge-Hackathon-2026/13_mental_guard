"use client";

import type { CaptionTurn } from "@/types/mvp";
import { useI18nStore } from "@/store/useI18nStore";
import { NotesPanel } from "./NotesPanel";

interface Props {
  captions: CaptionTurn[];
  durationLabel: string;
}

export function ComplaintSidebar({ captions, durationLabel }: Props) {
  const t = useI18nStore((s) => s.t);

  const demands: string[] = [];
  const seenDemands = new Set<string>();
  const abuseTypes = new Set<string>();

  captions.forEach((c) => {
    if (c.coreDemand && !seenDemands.has(c.coreDemand)) {
      seenDemands.add(c.coreDemand);
      demands.push(c.coreDemand);
    }
    c.detectedAbuseTypes?.forEach((tag) => abuseTypes.add(tag));
  });

  const turnCount = captions.length;

  return (
    <aside className="flex flex-col gap-4 p-5 lg:p-6 h-full overflow-y-auto">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
          {t.sidebar.callInfo}
        </div>
        <div className="surface-flat p-4 space-y-3">
          <Stat label={t.sidebar.duration} value={durationLabel} />
          <div className="h-px bg-line" />
          <Stat label={t.sidebar.utterances} value={`${turnCount}`} />
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
          {t.sidebar.keyPoints}
        </div>
        <div className="surface-flat p-4">
          {demands.length === 0 ? (
            <p className="text-xs text-ink-dim leading-relaxed">
              {t.sidebar.keyPointsEmpty}
            </p>
          ) : (
            <ol className="space-y-2.5">
              {demands.map((d, idx) => (
                <li key={idx} className="flex gap-2.5 text-sm">
                  <span className="text-ink-dim font-medium tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink leading-relaxed">{d}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {abuseTypes.size > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
            {t.sidebar.detectedExpressions}
          </div>
          <div className="surface-flat p-4">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(abuseTypes).map((tag) => (
                <span key={tag} className="chip-soft">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <NotesPanel />

      <div className="mt-auto pt-4 border-t border-line">
        <p className="text-[11px] text-ink-dim leading-relaxed">
          {t.sidebar.footer}
        </p>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-mute">{label}</span>
      <span className="text-sm font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}

"use client";

import type { TranscriptItem } from "@/types/mvp";
import { formatTime } from "@/lib/formatters";
import { useI18nStore } from "@/store/useI18nStore";

interface Props {
  items: TranscriptItem[];
}

export function TranscriptCompare({ items }: Props) {
  const t = useI18nStore((s) => s.t);

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <h3 className="font-semibold text-ink">{t.transcript.compareHeader}</h3>
        <span className="text-xs text-ink-mute">
          {t.transcript.compareSubtitle}
        </span>
      </div>

      <div className="grid grid-cols-2">
        <div className="px-5 py-3 text-xs uppercase tracking-wider text-ink-dim font-medium border-b border-r border-line bg-canvas/60">
          {t.transcript.rawCol}
        </div>
        <div className="px-5 py-3 text-xs uppercase tracking-wider text-ink-dim font-medium border-b border-line bg-canvas/60">
          {t.transcript.refinedCol}
        </div>

        {items.map((item, idx) => (
          <RowPair
            key={`${item.speaker}-${item.seq}-${item.timestamp}`}
            item={item}
            isLast={idx === items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function RowPair({ item, isLast }: { item: TranscriptItem; isLast: boolean }) {
  const t = useI18nStore((s) => s.t);
  const isCaller = item.speaker === "caller";
  const borderCls = isLast ? "" : "border-b border-line";
  return (
    <>
      <div className={`px-5 py-4 border-r border-line ${borderCls}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={
              isCaller
                ? "chip-soft"
                : "chip border-ink/10 bg-ink/5 text-ink-mute"
            }
          >
            {isCaller ? t.transcript.citizen : t.transcript.agent}
          </span>
          <span className="text-[10px] text-ink-dim">
            {formatTime(item.timestamp)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink-mute">{item.rawText}</p>
      </div>

      <div className={`px-5 py-4 ${borderCls}`}>
        <div className="text-[10px] text-accent mb-1.5 font-medium uppercase tracking-wider">
          {t.transcript.refinedTag}
        </div>
        <p className="text-sm leading-relaxed text-ink">
          {item.cleanCaption ?? (
            <span className="text-ink-dim italic">{t.transcript.noRefined}</span>
          )}
        </p>
      </div>
    </>
  );
}

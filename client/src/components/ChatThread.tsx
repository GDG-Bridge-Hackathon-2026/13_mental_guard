"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AgentTurn, CaptionTurn } from "@/types/mvp";
import { ChatMessage, TypingBubble } from "./ChatMessage";
import { useI18nStore } from "@/store/useI18nStore";

interface Props {
  captions: CaptionTurn[];
  agentTurns: AgentTurn[];
  isProcessing: boolean;
  isStarted: boolean;
}

type Item =
  | { kind: "caller"; turn: CaptionTurn }
  | { kind: "agent"; turn: AgentTurn };

export function ChatThread({ captions, agentTurns, isProcessing, isStarted }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useI18nStore((s) => s.t);

  const items: Item[] = useMemo(() => {
    const all: Item[] = [
      ...captions.map((c) => ({ kind: "caller" as const, turn: c })),
      ...agentTurns.map((a) => ({ kind: "agent" as const, turn: a })),
    ];
    all.sort((a, b) => (a.turn.timestamp < b.turn.timestamp ? -1 : 1));
    return all;
  }, [captions, agentTurns]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items.length, isProcessing]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 scroll-fade"
    >
      <div className="max-w-3xl mx-auto space-y-5">
        {!isStarted && items.length === 0 && <EmptyState />}

        {isStarted && items.length === 0 && !isProcessing && (
          <ChatMessage
            variant="system"
            text={t.agent.callConnected}
          />
        )}

        {items.map((item, idx) => {
          if (item.kind === "caller") {
            return (
              <ChatMessage
                key={`c-${item.turn.id}-${idx}`}
                variant="incoming"
                text={item.turn.cleanCaption}
                rawText={item.turn.rawText}
                timestamp={item.turn.timestamp}
                seq={item.turn.seq}
                turnId={item.turn.id}
              />
            );
          }
          return (
            <ChatMessage
              key={`a-${item.turn.id}-${idx}`}
              variant="outgoing"
              text={item.turn.rawText}
              timestamp={item.turn.timestamp}
            />
          );
        })}

        {isProcessing && <TypingBubble />}
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useI18nStore((s) => s.t);
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-soft border border-line mb-4">
        <span className="text-accent text-lg">●</span>
      </div>
      <h3 className="text-base font-semibold text-ink mb-1">
        {t.agent.emptyTitle}
      </h3>
      <p className="text-sm text-ink-mute leading-relaxed max-w-sm mx-auto whitespace-pre-line">
        {t.agent.emptyBody}
      </p>
    </div>
  );
}

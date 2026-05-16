import type { CaptionTurn, DemoEvent } from "@/types/mvp";

export interface StreamHandle {
  stop: () => void;
}

interface RunOpts {
  sessionId: string;
  turn: CaptionTurn;
  onEvent: (e: DemoEvent) => void;
  partialDelayMs?: number;
  finalDelayMs?: number;
  partialText?: string;
}

export function emitSingleTurn({
  sessionId,
  turn,
  onEvent,
  partialDelayMs = 150,
  finalDelayMs = 1500,
  partialText = "Generating refined caption...",
}: RunOpts): StreamHandle {
  const timers: ReturnType<typeof setTimeout>[] = [];

  timers.push(
    setTimeout(() => {
      onEvent({
        type: "caption.partial",
        sessionId,
        payload: { text: partialText },
        timestamp: new Date().toISOString(),
      });
    }, partialDelayMs)
  );

  timers.push(
    setTimeout(() => {
      onEvent({
        type: "caption.final",
        sessionId,
        payload: turn,
        timestamp: new Date().toISOString(),
      });
    }, finalDelayMs)
  );

  return {
    stop: () => timers.forEach((t) => clearTimeout(t)),
  };
}

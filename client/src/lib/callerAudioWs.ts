"use client";

import type { Lang } from "@/i18n/translations";
import { langToLanguageHint } from "@/lib/apiConfig";

export type CallerWsState =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export interface CallerAudioWsOptions {
  url: string;
  onState?: (state: CallerWsState) => void;
  onError?: (err: { code: string; message: string }) => void;
  onAck?: (seq: number) => void;
}

interface PendingChunk {
  seq: number;
  mimeType: string;
  base64: string;
  timestamp: string;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Avoid String.fromCharCode max-stack issues on large blobs by chunking.
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK))
    );
  }
  return btoa(bin);
}

export class CallerAudioWs {
  private ws: WebSocket | null = null;
  private state: CallerWsState = "idle";
  private buffer: PendingChunk[] = [];
  /** In-flight sendChunk promises. `flushAndEnd` awaits these before
   *  sending `audio.end` so the backend doesn't see end-before-final-chunk. */
  private pending: Set<Promise<void>> = new Set();
  private opts: CallerAudioWsOptions;

  constructor(opts: CallerAudioWsOptions) {
    this.opts = opts;
  }

  getState(): CallerWsState {
    return this.state;
  }

  connect(): Promise<void> {
    if (this.ws && this.state === "open") return Promise.resolve();
    this.setState("connecting");

    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        this.ws = new WebSocket(this.opts.url);
      } catch (e) {
        this.setState("error");
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        this.setState("open");
        this.flushBuffer();
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      this.ws.onmessage = (e) => this.handleServerMessage(e.data);
      this.ws.onerror = () => {
        this.setState("error");
        if (!settled) {
          settled = true;
          reject(new Error("WebSocket error"));
        }
      };
      this.ws.onclose = () => {
        this.setState("closed");
      };
    });
  }

  private setState(s: CallerWsState) {
    if (this.state === s) return;
    this.state = s;
    this.opts.onState?.(s);
  }

  private handleServerMessage(data: unknown) {
    if (typeof data !== "string") return;
    let msg: { type?: string; seq?: number; error?: { code: string; message: string } } = {};
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.type === "audio.received" && typeof msg.seq === "number") {
      this.opts.onAck?.(msg.seq);
    } else if (msg.type === "error" && msg.error) {
      this.opts.onError?.(msg.error);
    }
  }

  private flushBuffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const item of this.buffer) {
      this.ws.send(
        JSON.stringify({
          type: "audio.chunk",
          seq: item.seq,
          mime_type: item.mimeType,
          data: item.base64,
          timestamp: item.timestamp,
        })
      );
    }
    this.buffer = [];
  }

  sendChunk(chunk: Blob, seq: number, mimeType: string): Promise<void> {
    const p = (async () => {
      const base64 = await blobToBase64(chunk);
      const item: PendingChunk = {
        seq,
        mimeType,
        base64,
        timestamp: new Date().toISOString(),
      };
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "audio.chunk",
            seq: item.seq,
            mime_type: item.mimeType,
            data: item.base64,
            timestamp: item.timestamp,
          })
        );
      } else {
        // Buffer until socket opens.
        this.buffer.push(item);
      }
    })();
    this.pending.add(p);
    p.finally(() => this.pending.delete(p));
    return p;
  }

  /**
   * Wait for every in-flight `sendChunk` (and any newly-added ones that
   * appear while we're waiting), then send `audio.end`. Use this from the
   * caller page on stop so the backend never sees `audio.end` before the
   * final `audio.chunk` arrives.
   */
  async flushAndEnd(lang: Lang, durationMs: number): Promise<void> {
    // Drain the in-flight set. We loop because a chunk added late (e.g. the
    // MediaRecorder's final ondataavailable firing right before onstop) may
    // schedule a new promise while we're already awaiting.
    while (this.pending.size > 0) {
      await Promise.allSettled([...this.pending]);
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "audio.end",
          language_hint: langToLanguageHint(lang),
          duration_ms: durationMs,
        })
      );
    }
  }

  /** Raw end without flush. Kept for backwards compat / explicit use. */
  sendEnd(lang: Lang, durationMs: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: "audio.end",
        language_hint: langToLanguageHint(lang),
        duration_ms: durationMs,
      })
    );
  }

  close() {
    this.buffer = [];
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.setState("closed");
  }
}

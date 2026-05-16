"use client";

export interface AudioCaptureHandle {
  start: () => void;
  /**
   * Start in chunked mode for WS streaming. `onChunk` fires every `chunkMs`
   * with an audio Blob slice (whatever MediaRecorder emits via ondataavailable).
   * Call `stop()` when the utterance ends — it returns a final summary blob
   * combining all chunks, plus the duration. While in chunked mode, callers
   * may discard the returned blob; the per-chunk callback is the data path.
   */
  startChunked: (
    onChunk: (chunk: Blob, seq: number) => void,
    chunkMs?: number
  ) => void;
  stop: () => Promise<{ blob: Blob; durationMs: number; mimeType: string }>;
  destroy: () => void;
  isRecording: () => boolean;
  attachLevelMeter: (cb: (level: number) => void) => () => void;
  mimeType: string;
}

export class AudioCaptureUnsupportedError extends Error {
  constructor() {
    super("MediaRecorder is not supported in this browser");
    this.name = "AudioCaptureUnsupportedError";
  }
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      // ignore
    }
  }
  return "";
}

export async function createAudioCapture(): Promise<AudioCaptureHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new AudioCaptureUnsupportedError();
  }
  if (typeof MediaRecorder === "undefined") {
    throw new AudioCaptureUnsupportedError();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = pickMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  let chunks: BlobPart[] = [];
  let startedAt = 0;
  let isRecording = false;
  let chunkSeq = 0;
  let chunkCallback: ((chunk: Blob, seq: number) => void) | null = null;
  let pendingStop: {
    resolve: (v: { blob: Blob; durationMs: number; mimeType: string }) => void;
    reject: (e: Error) => void;
  } | null = null;

  recorder.ondataavailable = (e) => {
    if (!e.data || e.data.size === 0) return;
    chunks.push(e.data);
    if (chunkCallback) {
      chunkSeq += 1;
      try {
        chunkCallback(e.data, chunkSeq);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("audioCapture chunk callback failed", err);
      }
    }
  };

  recorder.onstop = () => {
    const effectiveMime = recorder.mimeType || mimeType || "audio/webm";
    const blob = new Blob(chunks, { type: effectiveMime });
    const durationMs = Math.max(0, Date.now() - startedAt);
    chunks = [];
    chunkCallback = null;
    isRecording = false;
    if (pendingStop) {
      pendingStop.resolve({ blob, durationMs, mimeType: effectiveMime });
      pendingStop = null;
    }
  };

  recorder.onerror = (e) => {
    if (pendingStop) {
      pendingStop.reject(new Error("MediaRecorder error"));
      pendingStop = null;
    }
    isRecording = false;
    // eslint-disable-next-line no-console
    console.error("MediaRecorder error", e);
  };

  // Web Audio level meter (optional)
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  function ensureAnalyser() {
    if (audioCtx) return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    audioCtx = new Ctor();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
  }

  return {
    mimeType,
    start: () => {
      if (isRecording) return;
      chunks = [];
      chunkSeq = 0;
      chunkCallback = null;
      startedAt = Date.now();
      isRecording = true;
      recorder.start();
    },
    startChunked: (onChunk, chunkMs = 300) => {
      if (isRecording) return;
      chunks = [];
      chunkSeq = 0;
      chunkCallback = onChunk;
      startedAt = Date.now();
      isRecording = true;
      recorder.start(chunkMs);
    },
    stop: () => {
      if (!isRecording) {
        return Promise.resolve({
          blob: new Blob([], { type: mimeType || "audio/webm" }),
          durationMs: 0,
          mimeType: mimeType || "audio/webm",
        });
      }
      return new Promise((resolve, reject) => {
        pendingStop = { resolve, reject };
        recorder.stop();
      });
    },
    isRecording: () => isRecording,
    destroy: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // ignore
      }
      stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch {
          // ignore
        }
      }
    },
    attachLevelMeter: (cb) => {
      ensureAnalyser();
      if (!analyser) return () => {};
      const data = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      let stopped = false;
      const tick = () => {
        if (stopped || !analyser) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        cb(Math.min(1, rms * 2.4));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        stopped = true;
        cancelAnimationFrame(raf);
      };
    },
  };
}

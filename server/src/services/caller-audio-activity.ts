import { emitTransient } from '../events.js';

export type CallerAudioSource = 'ws' | 'rest';

export function emitCallerAudioStarted(
  sessionId: string,
  opts: { source: CallerAudioSource; expectedDurationMs?: number }
) {
  emitTransient(sessionId, 'caller.audio.started', {
    source: opts.source,
    expected_duration_ms: opts.expectedDurationMs ?? null,
    timestamp: new Date().toISOString(),
  });
}

export function emitCallerAudioEnded(
  sessionId: string,
  opts: {
    source: CallerAudioSource;
    turnId?: string;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
  }
) {
  emitTransient(sessionId, 'caller.audio.ended', {
    source: opts.source,
    turn_id: opts.turnId ?? null,
    success: opts.success,
    error_code: opts.errorCode ?? null,
    error_message: opts.errorMessage ?? null,
    timestamp: new Date().toISOString(),
  });
}

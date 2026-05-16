// 세션 이벤트 pub/sub + DB 영속화.
// - emit: SessionEvent 테이블에 insert + 메모리 버스에 publish
// - subscribe: WS handler가 채널 구독 (sessionId 단위)

import { EventEmitter } from 'node:events';
import { EventType, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { newEventId } from './ids.js';

// 명세상 wire 포맷은 dot.case ('caption.final'). DB enum은 SCREAMING_SNAKE.
const EVENT_WIRE: Record<EventType, string> = {
  CAPTION_PARTIAL: 'caption.partial',
  CAPTION_FINAL: 'caption.final',
  RISK_UPDATE: 'risk.update',
  SUMMARY_UPDATE: 'summary.update',
  THRESHOLD_WARNING: 'threshold.warning',
  THRESHOLD_TERMINATE_ALLOWED: 'threshold.terminate_allowed',
  AGENT_AUDIO_READY: 'agent.audio.ready',
  SESSION_STATUS: 'session.status',
  SESSION_PAUSED: 'session.paused',
  SESSION_ENDED: 'session.ended',
  ERROR: 'error',
};

export interface WireEvent {
  id: string;
  session_id: string;
  type: string;
  payload: unknown;
  timestamp: string;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

const channelKey = (sessionId: string) => `session:${sessionId}`;

/**
 * 이벤트를 영속화 + 버스에 발행.
 * 메모리 전용 (휘발) 이벤트라면 persist: false.
 */
export async function emit(
  sessionId: string,
  type: EventType,
  payload: unknown,
  options: { persist?: boolean } = {}
): Promise<WireEvent> {
  const persist = options.persist ?? true;

  let id: string;
  let timestamp: Date;

  if (persist) {
    const row = await prisma.sessionEvent.create({
      data: {
        id: newEventId(),
        sessionId,
        type,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
      },
    });
    id = row.id;
    timestamp = row.timestamp;
  } else {
    id = newEventId();
    timestamp = new Date();
  }

  const wire: WireEvent = {
    id,
    session_id: sessionId,
    type: EVENT_WIRE[type],
    payload,
    timestamp: timestamp.toISOString(),
  };
  bus.emit(channelKey(sessionId), wire);
  return wire;
}

/**
 * 세션 채널 구독. 반환되는 unsubscribe()를 호출해 해제.
 */
export function subscribe(
  sessionId: string,
  listener: (event: WireEvent) => void
): () => void {
  const key = channelKey(sessionId);
  bus.on(key, listener);
  return () => bus.off(key, listener);
}
// Turn 생성 비즈니스 로직.
//
// caller 턴:
//   - audio면 GCS 업로드 + GCP STT로 transcript 생성 (또는 호출자가 transcript 전달 — WS 경로)
//   - ML /analyze 호출 → Analysis 생성
//   - displayed_text = analysis.refined, is_filtered 결정
//   - delivery_method: caption_relay→CAPTION, text_only→TEXT
//   - threshold 평가, agent-events로 caption.final/risk.update/threshold.* 발행
//
// agent 턴:
//   - audio면 GCS 업로드 (STT는 선택 — 기록용)
//   - Analysis 만들지 않음
//   - delivery_method: caption_relay→AUDIO, text_only→TEXT
//   - caller-events로 agent.audio.ready 발행 (음성일 때)

import { prisma } from '../prisma.js';
import { newTurnId, newAnalysisId } from '../ids.js';
import { ApiError } from '../errors.js';
import { getSession } from './sessions.js';
import { analyzeTurn } from '../ml/analyze-turn.js';
import { transcribeAudio } from '../stt.js';
import { uploadAudio, uploadTranscript } from '../storage.js';
import { emit } from '../events.js';
import {
  evaluateThreshold,
  incrementDistribution,
  rollingAverage,
  type ThresholdEvent,
} from '../thresholds.js';
import {
  Classification,
  TurnSource,
  Speaker,
  DeliveryMethod,
  SessionMode,
  EventType,
  Prisma,
  type Language,
  type Session,
  type Turn,
  type Analysis,
} from '@prisma/client';
import type {
  ClassificationDistribution,
  AnalysisMetrics,
} from '../types.js';

// ── caller ───────────────────────────────────────────────────────────────

interface CallerTextInput {
  type: 'text';
  content: string;
  language_hint: Language;
}

interface CallerVoiceInput {
  type: 'voice';
  audio: Buffer;
  mime: string;
  language_hint: Language;
  duration_ms?: number;
  /** WS 경로처럼 외부에서 이미 STT가 끝났을 때 */
  prerecorded_text?: string;
  prerecorded_confidence?: number;
}

export interface AddCallerTurnResult {
  turn: Turn;
  analysis: Analysis;
  session_update: {
    total_turns: number;
    cumulative_threat: number;
    classification_distribution: ClassificationDistribution;
    threshold_triggered: ThresholdEvent;
  };
}

export async function addCallerTurn(
  sessionId: string,
  input: CallerTextInput | CallerVoiceInput
): Promise<AddCallerTurnResult> {
  const startedAt = Date.now();
  const session = await getSession(sessionId);
  if (session.endedAt) {
    throw new ApiError(409, 'SESSION_ALREADY_ENDED', 'session already ended');
  }

  const turnId = newTurnId();
  let rawText: string;
  let audioUrl: string | null = null;
  let sttUrl: string | null = null;
  let durationMs: number | null = null;
  let sttConfidence: number | null = null;
  let source: TurnSource;

  if (input.type === 'voice') {
    source = TurnSource.VOICE;
    audioUrl = await uploadAudio(input.audio, sessionId, turnId, input.mime);
    if (input.prerecorded_text !== undefined) {
      rawText = input.prerecorded_text;
      sttConfidence = input.prerecorded_confidence ?? null;
    } else {
      const stt = await transcribeAudio(input.audio, { language_hint: input.language_hint });
      rawText = stt.text;
      sttConfidence = stt.confidence;
    }
    // STT transcript를 stt/ 경로에 별도 저장 (실패해도 무시)
    if (rawText) sttUrl = await uploadTranscript(rawText, sessionId, turnId);
    durationMs = input.duration_ms ?? null;
  } else {
    source = TurnSource.TEXT;
    rawText = input.content;
  }

  const seq = session.totalTurns + 1;

  // 직전 5턴
  const recentDesc = await prisma.turn.findMany({
    where: { sessionId, speaker: Speaker.CALLER },
    orderBy: { seq: 'desc' },
    take: 5,
    include: { analysis: true },
  });
  const recentAsc = [...recentDesc].reverse();
  const recentThreats = recentAsc
    .map((t) => (t.analysis?.metrics as AnalysisMetrics | undefined)?.threat_level)
    .filter((x): x is number => typeof x === 'number');

  const analysis = await analyzeTurn(rawText, {
    recent_threats: recentThreats,
    cumulative_threat: session.cumulativeThreat,
    total_turns: session.totalTurns,
    language: session.language,
  });

  // 누적 통계
  const distribution =
    session.classificationDistribution as unknown as ClassificationDistribution;
  const newDistribution = incrementDistribution(distribution, analysis.classification);
  const newCumThreat = rollingAverage(
    session.cumulativeThreat,
    session.totalTurns,
    analysis.metrics.threat_level
  );
  const newFactual = rollingAverage(
    session.factualRatioAvg,
    session.totalTurns,
    analysis.metrics.factual_ratio
  );
  const newRepetition = rollingAverage(
    session.repetitionAvg,
    session.totalTurns,
    analysis.metrics.repetition_score
  );

  const deliveryMethod =
    session.mode === SessionMode.TEXT_ONLY ? DeliveryMethod.TEXT : DeliveryMethod.CAPTION;
  const isFiltered = analysis.removed_expressions.length > 0;
  const latencyMs = Date.now() - startedAt;

  const [turn, analysisRow] = await prisma.$transaction([
    prisma.turn.create({
      data: {
        id: turnId,
        sessionId,
        seq,
        speaker: Speaker.CALLER,
        source,
        deliveryMethod,
        rawText,
        rawAudioUrl: audioUrl,
        sttUrl,
        displayedText: analysis.refined,
        isFiltered,
        durationMs,
        sttConfidence,
        latencyMs,
      },
    }),
    prisma.analysis.create({
      data: {
        id: newAnalysisId(),
        turnId,
        refined: analysis.refined,
        metrics: analysis.metrics as unknown as Prisma.InputJsonValue,
        summary: analysis.summary as unknown as Prisma.InputJsonValue,
        classification: analysis.classification,
        preservedFacts: analysis.preserved_facts as unknown as Prisma.InputJsonValue,
        removedExpressions: analysis.removed_expressions as unknown as Prisma.InputJsonValue,
        abuseTypes: analysis.abuse_types as unknown as Prisma.InputJsonValue,
        confidence: analysis.confidence,
        recommendedAction: analysis.recommended_action as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: {
        totalTurns: seq,
        cumulativeThreat: newCumThreat,
        factualRatioAvg: newFactual,
        repetitionAvg: newRepetition,
        classificationDistribution: newDistribution as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  // threshold
  const recentClassifications = recentAsc
    .map((t) => t.analysis?.classification)
    .filter((c): c is Classification => !!c);
  recentClassifications.push(analysis.classification);
  const threshold = evaluateThreshold(newCumThreat, recentClassifications);

  // 이벤트 발행 (영속화는 events.ts가 처리)
  await emit(sessionId, EventType.CAPTION_FINAL, {
    turn,
    analysis: {
      threat_level: analysis.metrics.threat_level,
      emotion: analysis.metrics.emotion,
      core_demand: analysis.summary.core_demand,
      classification: analysis.classification,
      recommended_action: analysis.recommended_action,
    },
  });
  await emit(sessionId, EventType.RISK_UPDATE, {
    cumulative_threat: newCumThreat,
    trend: analysis.metrics.trend,
    threshold_triggered: threshold,
  });
  if (threshold === 'WARNING') {
    await emit(sessionId, EventType.THRESHOLD_WARNING, {
      level: 'WARNING',
      message: '위험도가 높아졌습니다. 상급자 호출을 고려하세요.',
      reason: 'cumulative_threat >= 4.0',
    });
  } else if (threshold === 'TERMINATE_ALLOWED') {
    await emit(sessionId, EventType.THRESHOLD_TERMINATE_ALLOWED, {
      level: 'TERMINATE_ALLOWED',
      message: '응대 종료가 허용됩니다.',
      reason: 'cumulative_threat >= 4.5 OR last 3 turns all D',
    });
  }

  return {
    turn,
    analysis: analysisRow,
    session_update: {
      total_turns: seq,
      cumulative_threat: newCumThreat,
      classification_distribution: newDistribution,
      threshold_triggered: threshold,
    },
  };
}

// ── agent ────────────────────────────────────────────────────────────────

interface AgentTextInput {
  type: 'text';
  content: string;
}

interface AgentVoiceInput {
  type: 'voice';
  audio: Buffer;
  mime: string;
  duration_ms?: number;
  /** STT를 돌릴지 (기록용 transcript) */
  with_stt?: boolean;
}

export interface AddAgentTurnResult {
  turn: Turn;
  delivered_to_caller: boolean;
  playback_event_id: string | null;
}

export async function addAgentTurn(
  sessionId: string,
  input: AgentTextInput | AgentVoiceInput
): Promise<AddAgentTurnResult> {
  const startedAt = Date.now();
  const session = await getSession(sessionId);
  if (session.endedAt) {
    throw new ApiError(409, 'SESSION_ALREADY_ENDED', 'session already ended');
  }

  const turnId = newTurnId();
  let rawText = '';
  let audioUrl: string | null = null;
  let sttUrl: string | null = null;
  let durationMs: number | null = null;
  let sttConfidence: number | null = null;
  let source: TurnSource;

  if (input.type === 'voice') {
    source = TurnSource.VOICE;
    audioUrl = await uploadAudio(input.audio, sessionId, turnId, input.mime);
    durationMs = input.duration_ms ?? null;
    if (input.with_stt !== false) {
      try {
        const stt = await transcribeAudio(input.audio);
        rawText = stt.text;
        sttConfidence = stt.confidence;
        if (rawText) sttUrl = await uploadTranscript(rawText, sessionId, turnId);
      } catch (e) {
        // 접수인 발화는 정제 대상이 아니므로 STT 실패해도 turn은 저장
        console.warn('[addAgentTurn] STT failed (non-fatal)', String(e));
      }
    }
  } else {
    source = TurnSource.TEXT;
    rawText = input.content;
  }

  const seq = session.totalTurns + 1;
  const deliveryMethod =
    session.mode === SessionMode.TEXT_ONLY
      ? DeliveryMethod.TEXT
      : input.type === 'voice'
        ? DeliveryMethod.AUDIO
        : DeliveryMethod.TEXT;

  const latencyMs = Date.now() - startedAt;

  const [turn] = await prisma.$transaction([
    prisma.turn.create({
      data: {
        id: turnId,
        sessionId,
        seq,
        speaker: Speaker.AGENT,
        source,
        deliveryMethod,
        rawText,
        rawAudioUrl: audioUrl,
        sttUrl,
        displayedText: null,
        isFiltered: false,
        durationMs,
        sttConfidence,
        latencyMs,
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { totalTurns: seq },
    }),
  ]);

  let playbackEventId: string | null = null;
  if (input.type === 'voice' && audioUrl) {
    const wire = await emit(sessionId, EventType.AGENT_AUDIO_READY, {
      turn_id: turnId,
      audio_url: audioUrl,
    });
    playbackEventId = wire.id;
  }

  return {
    turn,
    delivered_to_caller: input.type === 'voice',
    playback_event_id: playbackEventId,
  };
}
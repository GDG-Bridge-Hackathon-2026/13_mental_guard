// Turn 생성 비즈니스 로직.
//
// caller 턴: STT(이미 됐을 수도) → ML 분석 → displayed_text 설정 → 이벤트 발행
// agent 턴: 저장 + (음성이면) agent.audio.ready 이벤트

import { prisma } from '../prisma.js';
import { newTurnId, newAnalysisId } from '../ids.js';
import { ApiError } from '../errors.js';
import { J } from '../utils/json.js';
import { getSession } from './sessions.js';
import { analyzeTurn } from '../ml/analyze-turn.js';
import { transcribeAudio } from '../stt.js';
import { uploadAudio, uploadTranscript } from '../storage.js';
import { emit } from '../events.js';
import { toAnalysisDto, toTurnDto } from '../api-dto.js';
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
  type Language,
  type Session,
  type Turn,
  type Analysis,
} from '@prisma/client';
import type {
  ClassificationDistribution,
  AnalysisMetrics,
} from '../types.js';

// ── 공통 헬퍼 ──────────────────────────────────────────────────────────────

interface AudioMaterials {
  audioUrl: string | null;
  sttUrl: string | null;
  rawText: string;
  sttConfidence: number | null;
}

/**
 * 음성 버퍼를 받아 GCS 업로드 + (필요시) STT + transcript 업로드까지.
 * caller/agent 공통.
 */
async function uploadAndTranscribe(opts: {
  sessionId: string;
  turnId: string;
  audio: Buffer;
  mime: string;
  languageHint?: Language;
  runStt: boolean;
  durationMs?: number;
  prerecorded?: { text: string; confidence: number | null };
}): Promise<AudioMaterials> {
  const { sessionId, turnId, audio, mime, languageHint, runStt, durationMs, prerecorded } = opts;

  const audioUrl = await uploadAudio(audio, sessionId, turnId, mime);

  if (prerecorded) {
    const sttUrl = prerecorded.text
      ? await uploadTranscript(prerecorded.text, sessionId, turnId)
      : null;
    return { audioUrl, sttUrl, rawText: prerecorded.text, sttConfidence: prerecorded.confidence };
  }

  if (!runStt) {
    return { audioUrl, sttUrl: null, rawText: '', sttConfidence: null };
  }

  try {
    const stt = await transcribeAudio(audio, { language_hint: languageHint, duration_ms: durationMs });
    const sttUrl = stt.text ? await uploadTranscript(stt.text, sessionId, turnId) : null;
    return { audioUrl, sttUrl, rawText: stt.text, sttConfidence: stt.confidence };
  } catch (e) {
    // agent 발화는 STT 실패해도 turn은 저장 (caller는 호출자가 처리)
    console.warn('[uploadAndTranscribe] STT failed (non-fatal)', String(e));
    return { audioUrl, sttUrl: null, rawText: '', sttConfidence: null };
  }
}

function deliveryFor(mode: SessionMode, speaker: Speaker, source: TurnSource): DeliveryMethod {
  if (mode === SessionMode.TEXT_ONLY) return DeliveryMethod.TEXT;
  if (speaker === Speaker.CALLER) return DeliveryMethod.CAPTION;
  // agent
  return source === TurnSource.VOICE ? DeliveryMethod.AUDIO : DeliveryMethod.TEXT;
}

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
  const session = await assertActiveSession(sessionId);

  const turnId = newTurnId();
  let rawText: string;
  let audioUrl: string | null = null;
  let sttUrl: string | null = null;
  let durationMs: number | null = null;
  let sttConfidence: number | null = null;
  let source: TurnSource;

  if (input.type === 'voice') {
    source = TurnSource.VOICE;
    const mat = await uploadAndTranscribe({
      sessionId,
      turnId,
      audio: input.audio,
      mime: input.mime,
      languageHint: input.language_hint,
      runStt: input.prerecorded_text === undefined,
      durationMs: input.duration_ms,
      prerecorded:
        input.prerecorded_text !== undefined
          ? { text: input.prerecorded_text, confidence: input.prerecorded_confidence ?? null }
          : undefined,
    });
    audioUrl = mat.audioUrl;
    sttUrl = mat.sttUrl;
    rawText = mat.rawText;
    sttConfidence = mat.sttConfidence;
    durationMs = input.duration_ms ?? null;
  } else {
    source = TurnSource.TEXT;
    rawText = input.content;
  }

  const seq = session.totalTurns + 1;

  // 직전 5턴 (caller만)
  const recentCallerTurns = await prisma.turn.findMany({
    where: { sessionId, speaker: Speaker.CALLER },
    orderBy: { seq: 'desc' },
    take: 5,
    include: { analysis: true },
  });
  const recentAsc = [...recentCallerTurns].reverse();
  const recentThreats = recentAsc
    .map((t) => (t.analysis?.metrics as AnalysisMetrics | undefined)?.threat_level)
    .filter((x): x is number => typeof x === 'number');

  const analysis = await analyzeTurn(
    rawText,
    {
      recent_threats: recentThreats,
      cumulative_threat: session.cumulativeThreat,
      total_turns: session.totalTurns,
      language: session.language,
    },
    sessionId
  );

  // 누적 통계
  const distribution = session.classificationDistribution as unknown as ClassificationDistribution;
  const newDistribution = incrementDistribution(distribution, analysis.classification);
  const newCumThreat = rollingAverage(session.cumulativeThreat, session.totalTurns, analysis.metrics.threat_level);
  const newFactual = rollingAverage(session.factualRatioAvg, session.totalTurns, analysis.metrics.factual_ratio);
  const newRepetition = rollingAverage(session.repetitionAvg, session.totalTurns, analysis.metrics.repetition_score);

  const deliveryMethod = deliveryFor(session.mode, Speaker.CALLER, source);
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
        metrics: J(analysis.metrics),
        summary: J(analysis.summary),
        classification: analysis.classification,
        preservedFacts: J(analysis.preserved_facts),
        removedExpressions: J(analysis.removed_expressions),
        abuseTypes: J(analysis.abuse_types),
        confidence: analysis.confidence,
        recommendedAction: J(analysis.recommended_action),
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: {
        totalTurns: seq,
        cumulativeThreat: newCumThreat,
        factualRatioAvg: newFactual,
        repetitionAvg: newRepetition,
        classificationDistribution: J(newDistribution),
      },
    }),
  ]);

  // threshold
  const recentClassifications = recentAsc
    .map((t) => t.analysis?.classification)
    .filter((c): c is Classification => !!c);
  recentClassifications.push(analysis.classification);
  const threshold = evaluateThreshold(newCumThreat, recentClassifications);

  const sessionUpdate = {
    total_turns: seq,
    cumulative_threat: newCumThreat,
    classification_distribution: newDistribution,
    threshold_triggered: threshold,
  };

  await emit(sessionId, EventType.CAPTION_FINAL, {
    turn: toTurnDto(turn),
    analysis: toAnalysisDto(analysisRow),
    session_update: sessionUpdate,
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
    session_update: sessionUpdate,
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
  const session = await assertActiveSession(sessionId);

  const turnId = newTurnId();
  let rawText = '';
  let audioUrl: string | null = null;
  let sttUrl: string | null = null;
  let durationMs: number | null = null;
  let sttConfidence: number | null = null;
  let source: TurnSource;

  if (input.type === 'voice') {
    source = TurnSource.VOICE;
    const mat = await uploadAndTranscribe({
      sessionId,
      turnId,
      audio: input.audio,
      mime: input.mime,
      runStt: input.with_stt !== false,
      durationMs: input.duration_ms,
    });
    audioUrl = mat.audioUrl;
    sttUrl = mat.sttUrl;
    rawText = mat.rawText;
    sttConfidence = mat.sttConfidence;
    durationMs = input.duration_ms ?? null;
  } else {
    source = TurnSource.TEXT;
    rawText = input.content;
  }

  const seq = session.totalTurns + 1;
  const deliveryMethod = deliveryFor(session.mode, Speaker.AGENT, source);
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

// ── 내부 ─────────────────────────────────────────────────────────────────

async function assertActiveSession(sessionId: string): Promise<Session> {
  const session = await getSession(sessionId);
  if (session.endedAt) {
    throw new ApiError(409, 'SESSION_ALREADY_ENDED', 'session already ended');
  }
  return session;
}

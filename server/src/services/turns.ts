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
  Language,
  Prisma,
  type Session,
  type Turn,
  type Analysis,
} from '@prisma/client';
import type {
  ClassificationDistribution,
  AnalysisMetrics,
} from '../types.js';

interface AudioMaterials {
  audioUrl: string | null;
  sttUrl: string | null;
  rawText: string;
  sttConfidence: number | null;
}

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
    console.warn('[uploadAndTranscribe] STT failed (non-fatal)', {
      session_id: sessionId,
      turn_id: turnId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { audioUrl, sttUrl: null, rawText: '', sttConfidence: null };
  }
}

function deliveryFor(mode: SessionMode, speaker: Speaker, source: TurnSource): DeliveryMethod {
  if (mode === SessionMode.TEXT_ONLY) return DeliveryMethod.TEXT;
  if (speaker === Speaker.CALLER) return DeliveryMethod.CAPTION;
  return source === TurnSource.VOICE ? DeliveryMethod.AUDIO : DeliveryMethod.TEXT;
}

function languageForStt(sessionLanguage: Language, requestHint: Language): Language {
  return sessionLanguage === Language.AUTO ? requestHint : sessionLanguage;
}

async function getLockedActiveSession(
  tx: Prisma.TransactionClient,
  sessionId: string
): Promise<Session> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "sessions" WHERE id = ${sessionId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', `session ${sessionId} not found`);
  }

  const session = await tx.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', `session ${sessionId} not found`);
  if (session.endedAt) {
    throw new ApiError(409, 'SESSION_ALREADY_ENDED', 'session already ended');
  }
  return session;
}

function emptyCallerTranscript(language: Language): string {
  if (language === Language.EN) {
    return 'Speech recognition returned no transcript. Please review the original audio.';
  }
  if (language === Language.JA) {
    return '音声認識結果が空です。元の音声を確認してください。';
  }
  return '음성 인식 결과가 비어 있습니다. 원본 음성을 확인해 주세요.';
}

function normalizeCallerTranscript(
  text: string,
  language: Language,
  context: { sessionId: string; turnId: string }
): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;

  console.warn('[turns] caller voice STT produced empty transcript', {
    session_id: context.sessionId,
    turn_id: context.turnId,
    language,
  });
  return emptyCallerTranscript(language);
}

async function emitTurnEvent(
  sessionId: string,
  type: EventType,
  payload: unknown
): Promise<string | null> {
  try {
    const wire = await emit(sessionId, type, payload);
    return wire.id;
  } catch (e) {
    console.warn('[turns] event emit failed (non-fatal)', {
      session_id: sessionId,
      type,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

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
  const initialSession = await assertActiveSession(sessionId);

  const turnId = newTurnId();
  let rawText: string;
  let audioUrl: string | null = null;
  let sttUrl: string | null = null;
  let durationMs: number | null = null;
  let sttConfidence: number | null = null;
  let source: TurnSource;

  if (input.type === 'voice') {
    source = TurnSource.VOICE;
    const sttLanguage = languageForStt(initialSession.language, input.language_hint);
    const mat = await uploadAndTranscribe({
      sessionId,
      turnId,
      audio: input.audio,
      mime: input.mime,
      languageHint: sttLanguage,
      runStt: input.prerecorded_text === undefined,
      durationMs: input.duration_ms,
      prerecorded:
        input.prerecorded_text !== undefined
          ? { text: input.prerecorded_text, confidence: input.prerecorded_confidence ?? null }
          : undefined,
    });
    audioUrl = mat.audioUrl;
    sttUrl = mat.sttUrl;
    rawText = normalizeCallerTranscript(mat.rawText, sttLanguage, { sessionId, turnId });
    sttConfidence = mat.sttConfidence;
    durationMs = input.duration_ms ?? null;
  } else {
    source = TurnSource.TEXT;
    rawText = input.content;
  }

  const analysisSession = await assertActiveSession(sessionId);
  const recentCallerTurns = await prisma.turn.findMany({
    where: { sessionId, speaker: Speaker.CALLER },
    orderBy: { seq: 'desc' },
    take: 5,
    include: { analysis: true },
  });
  const recentThreats = [...recentCallerTurns]
    .reverse()
    .map((t) => (t.analysis?.metrics as AnalysisMetrics | undefined)?.threat_level)
    .filter((x): x is number => typeof x === 'number');

  const analysis = await analyzeTurn(
    rawText,
    {
      recent_threats: recentThreats,
      cumulative_threat: analysisSession.cumulativeThreat,
      total_turns: analysisSession.totalTurns,
      language: analysisSession.language,
    },
    sessionId
  );

  const latencyMs = Date.now() - startedAt;
  const { turn, analysisRow, sessionUpdate, threshold } = await prisma.$transaction(async (tx) => {
    const lockedSession = await getLockedActiveSession(tx, sessionId);
    const seq = lockedSession.totalTurns + 1;
    const distribution = lockedSession.classificationDistribution as unknown as ClassificationDistribution;
    const newDistribution = incrementDistribution(distribution, analysis.classification);
    const newCumThreat = rollingAverage(
      lockedSession.cumulativeThreat,
      lockedSession.totalTurns,
      analysis.metrics.threat_level
    );
    const newFactual = rollingAverage(
      lockedSession.factualRatioAvg,
      lockedSession.totalTurns,
      analysis.metrics.factual_ratio
    );
    const newRepetition = rollingAverage(
      lockedSession.repetitionAvg,
      lockedSession.totalTurns,
      analysis.metrics.repetition_score
    );

    const turn = await tx.turn.create({
      data: {
        id: turnId,
        sessionId,
        seq,
        speaker: Speaker.CALLER,
        source,
        deliveryMethod: deliveryFor(lockedSession.mode, Speaker.CALLER, source),
        rawText,
        rawAudioUrl: audioUrl,
        sttUrl,
        displayedText: analysis.refined,
        isFiltered: analysis.removed_expressions.length > 0,
        durationMs,
        sttConfidence,
        latencyMs,
      },
    });
    const analysisRow = await tx.analysis.create({
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
    });
    await tx.session.update({
      where: { id: sessionId },
      data: {
        totalTurns: seq,
        cumulativeThreat: newCumThreat,
        factualRatioAvg: newFactual,
        repetitionAvg: newRepetition,
        classificationDistribution: J(newDistribution),
      },
    });

    const recentForThreshold = await tx.turn.findMany({
      where: { sessionId, speaker: Speaker.CALLER },
      orderBy: { seq: 'desc' },
      take: 3,
      include: { analysis: true },
    });
    const recentClassifications = recentForThreshold
      .reverse()
      .map((t) => t.analysis?.classification)
      .filter((c): c is Classification => !!c);
    const threshold = evaluateThreshold(newCumThreat, recentClassifications);
    const sessionUpdate = {
      total_turns: seq,
      cumulative_threat: newCumThreat,
      classification_distribution: newDistribution,
      threshold_triggered: threshold,
    };

    return { turn, analysisRow, sessionUpdate, threshold };
  });

  await emitTurnEvent(sessionId, EventType.CAPTION_FINAL, {
    turn: toTurnDto(turn),
    analysis: toAnalysisDto(analysisRow),
    session_update: sessionUpdate,
  });
  await emitTurnEvent(sessionId, EventType.RISK_UPDATE, {
    cumulative_threat: sessionUpdate.cumulative_threat,
    trend: analysis.metrics.trend,
    threshold_triggered: threshold,
  });
  if (threshold === 'WARNING') {
    await emitTurnEvent(sessionId, EventType.THRESHOLD_WARNING, {
      level: 'WARNING',
      message: '위험도가 높아졌습니다. 상급자 호출을 고려하세요.',
      reason: 'cumulative_threat >= 4.0',
    });
  } else if (threshold === 'TERMINATE_ALLOWED') {
    await emitTurnEvent(sessionId, EventType.THRESHOLD_TERMINATE_ALLOWED, {
      level: 'TERMINATE_ALLOWED',
      message: '상담 종료가 허용됩니다.',
      reason: 'cumulative_threat >= 4.5 OR last 3 turns all D',
    });
  }

  return {
    turn,
    analysis: analysisRow,
    session_update: sessionUpdate,
  };
}

interface AgentTextInput {
  type: 'text';
  content: string;
}

interface AgentVoiceInput {
  type: 'voice';
  audio: Buffer;
  mime: string;
  duration_ms?: number;
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
  await assertActiveSession(sessionId);

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
    rawText = mat.rawText.trim();
    sttConfidence = mat.sttConfidence;
    durationMs = input.duration_ms ?? null;
  } else {
    source = TurnSource.TEXT;
    rawText = input.content;
  }

  const latencyMs = Date.now() - startedAt;
  const turn = await prisma.$transaction(async (tx) => {
    const lockedSession = await getLockedActiveSession(tx, sessionId);
    const seq = lockedSession.totalTurns + 1;
    const turn = await tx.turn.create({
      data: {
        id: turnId,
        sessionId,
        seq,
        speaker: Speaker.AGENT,
        source,
        deliveryMethod: deliveryFor(lockedSession.mode, Speaker.AGENT, source),
        rawText,
        rawAudioUrl: audioUrl,
        sttUrl,
        displayedText: null,
        isFiltered: false,
        durationMs,
        sttConfidence,
        latencyMs,
      },
    });
    await tx.session.update({
      where: { id: sessionId },
      data: { totalTurns: seq },
    });
    return turn;
  });

  let playbackEventId: string | null = null;
  if (input.type === 'voice' && audioUrl) {
    playbackEventId = await emitTurnEvent(sessionId, EventType.AGENT_AUDIO_READY, {
      turn_id: turnId,
      audio_url: audioUrl,
    });
  }

  return {
    turn,
    delivered_to_caller: input.type === 'voice',
    playback_event_id: playbackEventId,
  };
}

async function assertActiveSession(sessionId: string): Promise<Session> {
  const session = await getSession(sessionId);
  if (session.endedAt) {
    throw new ApiError(409, 'SESSION_ALREADY_ENDED', 'session already ended');
  }
  return session;
}

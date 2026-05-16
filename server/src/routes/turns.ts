import { Router, type Request } from 'express';
import multer from 'multer';
import { requireAuthOrCallerToken } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { CreateTurnTextSchema, CreateTurnVoiceSchema } from '../schemas.js';
import { addCallerTurn, addAgentTurn } from '../services/turns.js';
import { ApiError } from '../errors.js';
import { Speaker } from '@prisma/client';
import { toAnalysisDto, toTurnDto } from '../api-dto.js';
import {
  emitCallerAudioEnded,
  emitCallerAudioStarted,
} from '../services/caller-audio-activity.js';

export const turnsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function assertCallerTokenTurnAllowed(req: Request, speaker: Speaker) {
  if (!req.callerAuth) return;
  if (speaker !== Speaker.CALLER) {
    throw new ApiError(403, 'FORBIDDEN', 'caller token can only create caller turns');
  }
}

function authScope(req: Request): 'caller-token' | 'firebase' | 'unknown' {
  if (req.callerAuth) return 'caller-token';
  if (req.user) return 'firebase';
  return 'unknown';
}

function logTurnSuccess(
  req: Request,
  startedAt: number,
  meta: {
    type: 'text' | 'voice';
    speaker: Speaker;
    turnId: string;
    seq: number;
    rawTextLength: number;
    displayedTextLength?: number;
    hasAnalysis: boolean;
    fileSize?: number;
  }
) {
  console.info('[turn-api] success', {
    session_id: req.params.id,
    auth_scope: authScope(req),
    type: meta.type,
    speaker: meta.speaker,
    turn_id: meta.turnId,
    seq: meta.seq,
    raw_text_length: meta.rawTextLength,
    displayed_text_length: meta.displayedTextLength ?? null,
    has_analysis: meta.hasAnalysis,
    file_size: meta.fileSize ?? null,
    latency_ms: Date.now() - startedAt,
  });
}

function logTurnFailure(
  req: Request,
  startedAt: number,
  err: unknown,
  meta: { type?: 'text' | 'voice'; speaker?: Speaker; fileSize?: number }
) {
  console.warn('[turn-api] failed', {
    session_id: req.params.id,
    auth_scope: authScope(req),
    type: meta.type ?? null,
    speaker: meta.speaker ?? null,
    file_size: meta.fileSize ?? null,
    latency_ms: Date.now() - startedAt,
    status: err instanceof ApiError ? err.status : null,
    code: err instanceof ApiError ? err.code : null,
    error: err instanceof Error ? err.message : String(err),
  });
}

// POST /api/sessions/:id/turns
turnsRouter.post(
  '/sessions/:id/turns',
  requireAuthOrCallerToken,
  loadSession,
  upload.single('audio'),
  ah(async (req, res) => {
    const startedAt = Date.now();
    const isMultipart = req.is('multipart/form-data');
    const logMeta: { type?: 'text' | 'voice'; speaker?: Speaker; fileSize?: number } = {
      type: isMultipart ? 'voice' : 'text',
      fileSize: req.file?.size,
    };
    let callerAudioActivityStarted = false;

    try {
      if (isMultipart) {
        const parsed = CreateTurnVoiceSchema.parse({
          type: 'voice',
          speaker: req.body.speaker,
          language_hint: req.body.language_hint,
          duration_ms: req.body.duration_ms,
        });
        logMeta.speaker = parsed.speaker;
        logMeta.fileSize = req.file?.size;
        if (!req.file) throw new ApiError(400, 'INVALID_INPUT', 'audio file required');
        if (req.file.size === 0) throw new ApiError(400, 'INVALID_INPUT', 'audio file is empty');
        assertCallerTokenTurnAllowed(req, parsed.speaker);

        if (parsed.speaker === Speaker.AGENT) {
          const result = await addAgentTurn(req.params.id, {
            type: 'voice',
            audio: req.file.buffer,
            mime: req.file.mimetype,
            duration_ms: parsed.duration_ms,
          });
          logTurnSuccess(req, startedAt, {
            type: 'voice',
            speaker: parsed.speaker,
            turnId: result.turn.id,
            seq: result.turn.seq,
            rawTextLength: result.turn.rawText.length,
            hasAnalysis: false,
            fileSize: req.file.size,
          });
          res.json({
            turn: toTurnDto(result.turn),
            delivered_to_caller: result.delivered_to_caller,
            playback_event_id: result.playback_event_id,
          });
        } else {
          emitCallerAudioStarted(req.params.id, {
            source: 'rest',
            expectedDurationMs: parsed.duration_ms,
          });
          callerAudioActivityStarted = true;
          const result = await addCallerTurn(req.params.id, {
            type: 'voice',
            audio: req.file.buffer,
            mime: req.file.mimetype,
            language_hint: parsed.language_hint,
            duration_ms: parsed.duration_ms,
          });
          logTurnSuccess(req, startedAt, {
            type: 'voice',
            speaker: parsed.speaker,
            turnId: result.turn.id,
            seq: result.turn.seq,
            rawTextLength: result.turn.rawText.length,
            displayedTextLength: result.turn.displayedText?.length ?? 0,
            hasAnalysis: true,
            fileSize: req.file.size,
          });
          emitCallerAudioEnded(req.params.id, {
            source: 'rest',
            turnId: result.turn.id,
            success: true,
          });
          callerAudioActivityStarted = false;
          res.json({
            turn: toTurnDto(result.turn),
            analysis: toAnalysisDto(result.analysis),
            session_update: result.session_update,
          });
        }
      } else {
        const parsed = CreateTurnTextSchema.parse(req.body);
        logMeta.speaker = parsed.speaker;
        assertCallerTokenTurnAllowed(req, parsed.speaker);
        if (parsed.speaker === Speaker.AGENT) {
          const result = await addAgentTurn(req.params.id, {
            type: 'text',
            content: parsed.content,
          });
          logTurnSuccess(req, startedAt, {
            type: 'text',
            speaker: parsed.speaker,
            turnId: result.turn.id,
            seq: result.turn.seq,
            rawTextLength: result.turn.rawText.length,
            hasAnalysis: false,
          });
          res.json({
            turn: toTurnDto(result.turn),
            delivered_to_caller: result.delivered_to_caller,
            playback_event_id: result.playback_event_id,
          });
        } else {
          const result = await addCallerTurn(req.params.id, {
            type: 'text',
            content: parsed.content,
            language_hint: parsed.language_hint,
          });
          logTurnSuccess(req, startedAt, {
            type: 'text',
            speaker: parsed.speaker,
            turnId: result.turn.id,
            seq: result.turn.seq,
            rawTextLength: result.turn.rawText.length,
            displayedTextLength: result.turn.displayedText?.length ?? 0,
            hasAnalysis: true,
          });
          res.json({
            turn: toTurnDto(result.turn),
            analysis: toAnalysisDto(result.analysis),
            session_update: result.session_update,
          });
        }
      }
    } catch (err) {
      if (callerAudioActivityStarted) {
        emitCallerAudioEnded(req.params.id, {
          source: 'rest',
          success: false,
          errorCode: err instanceof ApiError ? err.code : 'INTERNAL',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
      logTurnFailure(req, startedAt, err, logMeta);
      throw err;
    }
  })
);

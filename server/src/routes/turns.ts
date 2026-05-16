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

// POST /api/sessions/:id/turns
turnsRouter.post(
  '/sessions/:id/turns',
  requireAuthOrCallerToken,
  loadSession,
  upload.single('audio'),
  ah(async (req, res) => {
    const isMultipart = req.is('multipart/form-data');

    if (isMultipart) {
      const parsed = CreateTurnVoiceSchema.parse({
        type: 'voice',
        speaker: req.body.speaker,
        language_hint: req.body.language_hint,
        duration_ms: req.body.duration_ms,
      });
      if (!req.file) throw new ApiError(400, 'INVALID_INPUT', 'audio file required');
      assertCallerTokenTurnAllowed(req, parsed.speaker);

      if (parsed.speaker === Speaker.AGENT) {
        const result = await addAgentTurn(req.params.id, {
          type: 'voice',
          audio: req.file.buffer,
          mime: req.file.mimetype,
          duration_ms: parsed.duration_ms,
        });
        res.json({
          turn: toTurnDto(result.turn),
          delivered_to_caller: result.delivered_to_caller,
          playback_event_id: result.playback_event_id,
        });
      } else {
        const result = await addCallerTurn(req.params.id, {
          type: 'voice',
          audio: req.file.buffer,
          mime: req.file.mimetype,
          language_hint: parsed.language_hint,
          duration_ms: parsed.duration_ms,
        });
        res.json({
          turn: toTurnDto(result.turn),
          analysis: toAnalysisDto(result.analysis),
          session_update: result.session_update,
        });
      }
    } else {
      const parsed = CreateTurnTextSchema.parse(req.body);
      assertCallerTokenTurnAllowed(req, parsed.speaker);
      if (parsed.speaker === Speaker.AGENT) {
        const result = await addAgentTurn(req.params.id, {
          type: 'text',
          content: parsed.content,
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
        res.json({
          turn: toTurnDto(result.turn),
          analysis: toAnalysisDto(result.analysis),
          session_update: result.session_update,
        });
      }
    }
  })
);

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { CreateAgentTurnTextSchema, CreateAgentTurnVoiceSchema } from '../schemas.js';
import { addAgentTurn } from '../services/turns.js';
import { ApiError } from '../errors.js';
import { toTurnDto } from '../api-dto.js';

export const agentTurnsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /api/sessions/:id/agent-turns
agentTurnsRouter.post(
  '/sessions/:id/agent-turns',
  requireAuth,
  loadSession,
  upload.single('audio'),
  ah(async (req, res) => {
    if (req.is('multipart/form-data')) {
      const parsed = CreateAgentTurnVoiceSchema.parse({ duration_ms: req.body.duration_ms });
      if (!req.file) throw new ApiError(400, 'INVALID_INPUT', 'audio file required');
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
      const parsed = CreateAgentTurnTextSchema.parse(req.body);
      const result = await addAgentTurn(req.params.id, {
        type: 'text',
        content: parsed.content,
      });
      res.json({
        turn: toTurnDto(result.turn),
        delivered_to_caller: result.delivered_to_caller,
        playback_event_id: result.playback_event_id,
      });
    }
  })
);

// POST /api/sessions/:id/agent-audio
agentTurnsRouter.post(
  '/sessions/:id/agent-audio',
  requireAuth,
  loadSession,
  upload.single('audio'),
  ah(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'INVALID_INPUT', 'audio file required');
    const parsed = CreateAgentTurnVoiceSchema.parse({ duration_ms: req.body.duration_ms });
    const result = await addAgentTurn(req.params.id, {
      type: 'voice',
      audio: req.file.buffer,
      mime: req.file.mimetype,
      duration_ms: parsed.duration_ms,
    });
    res.json({
      turn_id: result.turn.id,
      audio_url: result.turn.rawAudioUrl,
      playback_event_id: result.playback_event_id,
    });
  })
);

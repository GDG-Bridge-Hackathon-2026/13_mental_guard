import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { CreateAgentTurnTextSchema, CreateAgentTurnVoiceSchema } from '../schemas.js';
import { addAgentTurn } from '../services/turns.js';
import { assertSessionAccess, getSession } from '../services/sessions.js';
import { ApiError } from '../errors.js';

export const agentTurnsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /api/sessions/:id/agent-turns
agentTurnsRouter.post(
  '/sessions/:id/agent-turns',
  requireAuth,
  upload.single('audio'),
  async (req, res, next) => {
    try {
      const s = await getSession(req.params.id);
      assertSessionAccess(s, req.user!);

      if (req.is('multipart/form-data')) {
        const parsed = CreateAgentTurnVoiceSchema.parse({
          duration_ms: req.body.duration_ms,
        });
        if (!req.file) throw new ApiError(400, 'INVALID_INPUT', 'audio file required');
        const result = await addAgentTurn(req.params.id, {
          type: 'voice',
          audio: req.file.buffer,
          mime: req.file.mimetype,
          duration_ms: parsed.duration_ms,
        });
        res.json(result);
      } else {
        const parsed = CreateAgentTurnTextSchema.parse(req.body);
        const result = await addAgentTurn(req.params.id, {
          type: 'text',
          content: parsed.content,
        });
        res.json(result);
      }
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/sessions/:id/agent-audio — 음성만, playback_event_id 강조
agentTurnsRouter.post(
  '/sessions/:id/agent-audio',
  requireAuth,
  upload.single('audio'),
  async (req, res, next) => {
    try {
      const s = await getSession(req.params.id);
      assertSessionAccess(s, req.user!);
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
    } catch (e) {
      next(e);
    }
  }
);
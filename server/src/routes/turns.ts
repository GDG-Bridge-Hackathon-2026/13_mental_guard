import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { CreateTurnTextSchema, CreateTurnVoiceSchema } from '../schemas.js';
import { addCallerTurn, addAgentTurn } from '../services/turns.js';
import { ApiError } from '../errors.js';
import { Speaker } from '@prisma/client';

export const turnsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /api/sessions/:id/turns
turnsRouter.post(
  '/sessions/:id/turns',
  requireAuth,
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

      if (parsed.speaker === Speaker.AGENT) {
        const result = await addAgentTurn(req.params.id, {
          type: 'voice',
          audio: req.file.buffer,
          mime: req.file.mimetype,
          duration_ms: parsed.duration_ms,
        });
        res.json(result);
      } else {
        const result = await addCallerTurn(req.params.id, {
          type: 'voice',
          audio: req.file.buffer,
          mime: req.file.mimetype,
          language_hint: parsed.language_hint,
          duration_ms: parsed.duration_ms,
        });
        res.json(result);
      }
    } else {
      const parsed = CreateTurnTextSchema.parse(req.body);
      if (parsed.speaker === Speaker.AGENT) {
        const result = await addAgentTurn(req.params.id, {
          type: 'text',
          content: parsed.content,
        });
        res.json(result);
      } else {
        const result = await addCallerTurn(req.params.id, {
          type: 'text',
          content: parsed.content,
          language_hint: parsed.language_hint,
        });
        res.json(result);
      }
    }
  })
);

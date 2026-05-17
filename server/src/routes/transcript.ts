import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { TranscriptQuerySchema } from '../schemas.js';
import { getTranscript } from '../services/transcript.js';

export const transcriptRouter = Router();

// GET /api/sessions/:id/transcript?view=raw|clean|both
transcriptRouter.get(
  '/sessions/:id/transcript',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    const { view } = TranscriptQuerySchema.parse(req.query);
    const t = await getTranscript(req.params.id, view);
    const { agentId: _, ...payload } = t;
    res.json(payload);
  })
);

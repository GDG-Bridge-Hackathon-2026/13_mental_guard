import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { TranscriptQuerySchema } from '../schemas.js';
import { getTranscript } from '../services/transcript.js';
import { assertSessionAccess } from '../services/sessions.js';

export const transcriptRouter = Router();

// GET /api/sessions/:id/transcript?view=raw|clean|both
transcriptRouter.get('/sessions/:id/transcript', requireAuth, async (req, res, next) => {
  try {
    const { view } = TranscriptQuerySchema.parse(req.query);
    const t = await getTranscript(req.params.id, view);
    assertSessionAccess({ agentId: t.agentId }, req.user!);
    const { agentId: _, ...payload } = t;
    res.json(payload);
  } catch (e) {
    next(e);
  }
});
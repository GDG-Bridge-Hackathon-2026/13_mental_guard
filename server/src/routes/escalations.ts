import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CreateEscalationSchema } from '../schemas.js';
import { createEscalation, listEscalations } from '../services/escalations.js';
import { assertSessionAccess, getSession } from '../services/sessions.js';

export const escalationsRouter = Router();

// POST /api/sessions/:id/escalations
escalationsRouter.post('/sessions/:id/escalations', requireAuth, async (req, res, next) => {
  try {
    const body = CreateEscalationSchema.parse(req.body);
    const s = await getSession(req.params.id);
    assertSessionAccess(s, req.user!);
    const escalation = await createEscalation({
      sessionId: req.params.id,
      type: body.type,
      reason: body.reason,
      requestedBy: req.user!.id,
    });
    res.status(201).json({ escalation_id: escalation.id, status: 'created' });
  } catch (e) {
    next(e);
  }
});

// GET /api/sessions/:id/escalations
escalationsRouter.get('/sessions/:id/escalations', requireAuth, async (req, res, next) => {
  try {
    const s = await getSession(req.params.id);
    assertSessionAccess(s, req.user!);
    const escalations = await listEscalations(req.params.id);
    res.json({ escalations });
  } catch (e) {
    next(e);
  }
});
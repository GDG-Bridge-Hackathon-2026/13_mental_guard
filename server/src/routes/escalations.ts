import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { CreateEscalationSchema } from '../schemas.js';
import { createEscalation, listEscalations } from '../services/escalations.js';

export const escalationsRouter = Router();

// POST /api/sessions/:id/escalations
escalationsRouter.post(
  '/sessions/:id/escalations',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    const body = CreateEscalationSchema.parse(req.body);
    const escalation = await createEscalation({
      sessionId: req.params.id,
      type: body.type,
      reason: body.reason,
      requestedBy: req.user!.id,
    });
    res.status(201).json({ escalation_id: escalation.id, status: 'created' });
  })
);

// GET /api/sessions/:id/escalations
escalationsRouter.get(
  '/sessions/:id/escalations',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    const escalations = await listEscalations(req.params.id);
    res.json({ escalations });
  })
);

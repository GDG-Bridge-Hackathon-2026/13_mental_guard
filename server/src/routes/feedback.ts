import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { CreateFeedbackSchema } from '../schemas.js';
import { createFeedback } from '../services/feedback.js';

export const feedbackRouter = Router();

// POST /api/sessions/:id/feedback
feedbackRouter.post(
  '/sessions/:id/feedback',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    const body = CreateFeedbackSchema.parse(req.body);
    const fb = await createFeedback({
      sessionId: req.params.id,
      turnId: body.turn_id,
      field: body.field,
      expected: body.expected,
      actual: body.actual,
      comment: body.comment,
    });
    res.status(201).json({ feedback_id: fb.id, status: 'saved' });
  })
);

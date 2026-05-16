import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CreateFeedbackSchema } from '../schemas.js';
import { createFeedback } from '../services/feedback.js';
import { assertSessionAccess, getSession } from '../services/sessions.js';

export const feedbackRouter = Router();

// POST /api/sessions/:id/feedback
feedbackRouter.post('/sessions/:id/feedback', requireAuth, async (req, res, next) => {
  try {
    const body = CreateFeedbackSchema.parse(req.body);
    const s = await getSession(req.params.id);
    assertSessionAccess(s, req.user!);
    const fb = await createFeedback({
      sessionId: req.params.id,
      turnId: body.turn_id,
      field: body.field,
      expected: body.expected,
      actual: body.actual,
      comment: body.comment,
    });
    res.status(201).json({ feedback_id: fb.id, status: 'saved' });
  } catch (e) {
    next(e);
  }
});
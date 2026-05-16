import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { RegenerateScriptSchema } from '../schemas.js';
import { prisma } from '../prisma.js';
import { regenerateScript } from '../ml/regenerate-script.js';
import { assertSessionAccess } from '../services/sessions.js';
import { ApiError } from '../errors.js';

export const scriptsRouter = Router();

// POST /api/turns/:turnId/scripts/regenerate
scriptsRouter.post(
  '/turns/:turnId/scripts/regenerate',
  requireAuth,
  async (req, res, next) => {
    try {
      const body = RegenerateScriptSchema.parse(req.body);
      const turn = await prisma.turn.findUnique({
        where: { id: req.params.turnId },
        include: { session: { select: { agentId: true } } },
      });
      if (!turn) throw new ApiError(404, 'TURN_NOT_FOUND', `turn ${req.params.turnId} not found`);
      assertSessionAccess(turn.session, req.user!);

      const script = await regenerateScript(
        {
          turn_id: turn.id,
          raw_text: turn.rawText,
          tone: body.tone,
          additional_context: body.additional_context,
        },
        turn.sessionId
      );
      res.json({ script, tone: body.tone });
    } catch (e) {
      next(e);
    }
  }
);
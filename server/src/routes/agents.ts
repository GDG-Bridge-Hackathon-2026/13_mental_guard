import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAgentTodayHealth } from '../services/analytics.js';
import { ApiError } from '../errors.js';

export const agentsRouter = Router();

// GET /api/agents/:agentId/health
agentsRouter.get('/agents/:agentId/health', requireAuth, async (req, res, next) => {
  try {
    if (req.user!.role === 'AGENT' && req.params.agentId !== req.user!.id) {
      throw new ApiError(403, 'FORBIDDEN', 'other agents not visible');
    }
    const health = await getAgentTodayHealth(req.params.agentId);
    res.json(health);
  } catch (e) {
    next(e);
  }
});
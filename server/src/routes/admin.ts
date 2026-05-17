import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah } from '../utils/async-handler.js';
import { AdminAnalyticsQuerySchema } from '../schemas.js';
import { getAdminAnalytics } from '../services/analytics.js';

export const adminRouter = Router();

// GET /api/admin/analytics — SUPERVISOR/ADMIN only
adminRouter.get(
  '/admin/analytics',
  requireAuth,
  requireRole('SUPERVISOR', 'ADMIN'),
  ah(async (req, res) => {
    const q = AdminAnalyticsQuerySchema.parse(req.query);
    const result = await getAdminAnalytics({
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      agentId: q.agent_id,
    });
    res.json(result);
  })
);

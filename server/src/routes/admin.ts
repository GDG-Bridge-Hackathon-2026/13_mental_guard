import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AdminAnalyticsQuerySchema } from '../schemas.js';
import { getAdminAnalytics } from '../services/analytics.js';

export const adminRouter = Router();

// GET /api/admin/analytics — SUPERVISOR/ADMIN only
adminRouter.get(
  '/admin/analytics',
  requireAuth,
  requireRole('SUPERVISOR', 'ADMIN'),
  async (req, res, next) => {
    try {
      const q = AdminAnalyticsQuerySchema.parse(req.query);
      const result = await getAdminAnalytics({
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        agentId: q.agent_id,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);
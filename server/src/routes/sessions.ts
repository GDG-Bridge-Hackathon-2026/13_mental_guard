import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  CreateSessionSchema,
  ListSessionsQuerySchema,
  PatchStatusSchema,
  EndSessionSchema,
} from '../schemas.js';
import {
  assertSessionAccess,
  createSession,
  getSession,
  getSessionWithTurns,
  listSessions,
  updateStatus,
} from '../services/sessions.js';
import { endSession, getCachedSummary } from '../services/summary.js';
import { listEvents } from '../services/events.js';
import { ApiError } from '../errors.js';

export const sessionsRouter = Router();

const SORT_FIELDS: Record<string, string> = {
  started_at: 'startedAt',
  ended_at: 'endedAt',
  cumulative_threat: 'cumulativeThreat',
  total_turns: 'totalTurns',
};

// POST /api/sessions
sessionsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = CreateSessionSchema.parse(req.body);
    const session = await createSession({
      agentId: req.user!.id,
      callerId: body.caller_id ?? null,
      channel: body.channel,
      language: body.language,
      mode: body.mode,
      metadata: body.metadata,
    });
    res.status(201).json({ session });
  } catch (e) {
    next(e);
  }
});

// GET /api/sessions
sessionsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = ListSessionsQuerySchema.parse(req.query);
    const [sortFieldRaw, sortDir] = q.sort.split(':') as [string, 'asc' | 'desc'];
    const sortField = SORT_FIELDS[sortFieldRaw];
    if (!sortField) {
      throw new ApiError(400, 'INVALID_INPUT', `invalid sort field: ${sortFieldRaw}`);
    }
    const agentId = req.user!.role === 'AGENT' ? req.user!.id : q.agent_id;

    const { sessions, total } = await listSessions({
      agentId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      classification: q.classification,
      status: q.status,
      minThreat: q.min_threat,
      limit: q.limit,
      offset: q.offset,
      sortField,
      sortDir,
    });
    res.json({ sessions, total, limit: q.limit, offset: q.offset });
  } catch (e) {
    next(e);
  }
});

// GET /api/sessions/:id
sessionsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const s = await getSessionWithTurns(req.params.id);
    assertSessionAccess(s, req.user!);
    const { turns, ...session } = s;
    const turnsOnly = turns.map(({ analysis, ...t }) => t);
    const analyses = turns.map((t) => t.analysis).filter((a) => a !== null);
    res.json({ session, turns: turnsOnly, analyses });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/sessions/:id/status
sessionsRouter.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const body = PatchStatusSchema.parse(req.body);
    const s = await getSession(req.params.id);
    assertSessionAccess(s, req.user!);
    const session = await updateStatus(req.params.id, body.status);
    res.json({ session });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/sessions/:id/end
sessionsRouter.patch('/:id/end', requireAuth, async (req, res, next) => {
  try {
    EndSessionSchema.parse(req.body ?? {});
    const head = await getSession(req.params.id);
    assertSessionAccess(head, req.user!);
    const summary = await endSession(req.params.id);
    res.json({ summary });
  } catch (e) {
    next(e);
  }
});

// GET /api/sessions/:id/summary
sessionsRouter.get('/:id/summary', requireAuth, async (req, res, next) => {
  try {
    const { summary, agentId } = await getCachedSummary(req.params.id);
    assertSessionAccess({ agentId }, req.user!);
    res.json({ summary });
  } catch (e) {
    next(e);
  }
});

// GET /api/sessions/:id/events
sessionsRouter.get('/:id/events', requireAuth, async (req, res, next) => {
  try {
    const s = await getSession(req.params.id);
    assertSessionAccess(s, req.user!);
    const events = await listEvents(req.params.id);
    res.json({ events });
  } catch (e) {
    next(e);
  }
});
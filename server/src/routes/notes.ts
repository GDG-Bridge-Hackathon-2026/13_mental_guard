import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CreateNoteSchema } from '../schemas.js';
import { createNote, listNotes } from '../services/notes.js';
import { assertSessionAccess, getSession } from '../services/sessions.js';

export const notesRouter = Router();

// POST /api/sessions/:id/notes
notesRouter.post('/sessions/:id/notes', requireAuth, async (req, res, next) => {
  try {
    const body = CreateNoteSchema.parse(req.body);
    const s = await getSession(req.params.id);
    assertSessionAccess(s, req.user!);
    const note = await createNote({
      sessionId: req.params.id,
      agentId: req.user!.id,
      content: body.content,
    });
    res.status(201).json({ note_id: note.id, created_at: note.createdAt.toISOString() });
  } catch (e) {
    next(e);
  }
});

// GET /api/sessions/:id/notes
notesRouter.get('/sessions/:id/notes', requireAuth, async (req, res, next) => {
  try {
    const s = await getSession(req.params.id);
    assertSessionAccess(s, req.user!);
    const notes = await listNotes(req.params.id);
    res.json({ notes });
  } catch (e) {
    next(e);
  }
});
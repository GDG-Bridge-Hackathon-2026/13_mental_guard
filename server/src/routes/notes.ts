import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadSession } from '../middleware/session-access.js';
import { ah } from '../utils/async-handler.js';
import { CreateNoteSchema } from '../schemas.js';
import { createNote, listNotes } from '../services/notes.js';

export const notesRouter = Router();

// POST /api/sessions/:id/notes
notesRouter.post(
  '/sessions/:id/notes',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    const body = CreateNoteSchema.parse(req.body);
    const note = await createNote({
      sessionId: req.params.id,
      agentId: req.user!.id,
      content: body.content,
    });
    res.status(201).json({ note_id: note.id, created_at: note.createdAt.toISOString() });
  })
);

// GET /api/sessions/:id/notes
notesRouter.get(
  '/sessions/:id/notes',
  requireAuth,
  loadSession,
  ah(async (req, res) => {
    const notes = await listNotes(req.params.id);
    res.json({ notes });
  })
);

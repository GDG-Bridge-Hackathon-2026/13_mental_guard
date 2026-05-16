"use client";

import { useEffect, useState } from "react";
import { useI18nStore } from "@/store/useI18nStore";
import { useSessionStore } from "@/store/useSessionStore";

export function NotesPanel() {
  const t = useI18nStore((s) => s.t);
  const sessionId = useSessionStore((s) => s.session?.id);
  const apiMode = useSessionStore((s) => s.apiMode);
  const notes = useSessionStore((s) => s.notes);
  const addNote = useSessionStore((s) => s.addNote);
  const refreshNotes = useSessionStore((s) => s.refreshNotes);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionId && apiMode === "real") {
      void refreshNotes();
    }
  }, [sessionId, apiMode, refreshNotes]);

  if (!sessionId) return null;

  const handleAdd = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true);
    const note = await addNote(draft);
    setBusy(false);
    if (note) setDraft("");
  };

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
        {t.actions.notesTitle}
      </div>
      <div className="surface-flat p-4 space-y-3">
        <div className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-xs text-ink-dim leading-relaxed">
              {t.actions.notesEmpty}
            </p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="text-xs leading-relaxed text-ink border-l-2 border-l-accent/40 pl-2.5"
                >
                  <div className="whitespace-pre-wrap">{n.content}</div>
                  <div className="text-[10px] text-ink-dim mt-0.5 tabular-nums">
                    {formatTime(n.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.actions.notesPlaceholder}
            rows={2}
            maxLength={5000}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-line bg-canvas focus:outline-none focus:border-ink/40 resize-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !draft.trim()}
              className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? t.actions.notesSaving : t.actions.notesAdd}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

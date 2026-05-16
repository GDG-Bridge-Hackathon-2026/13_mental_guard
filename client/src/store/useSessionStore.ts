"use client";

import { create } from "zustand";
import type {
  AgentTurn,
  CaptionTurn,
  Escalation,
  EscalationType,
  Note,
  RecommendedReply,
  ScriptTone,
  Session,
  SessionSummary,
} from "@/types/mvp";
import {
  createMockSession,
  endMockSession,
  sendMockAgentReply,
  startMockSession,
} from "@/mocks/mockApi";
import { buildEmptySummary, buildLocalSummary } from "@/mocks/mockSummary";
import { getMockCallerTurns } from "@/mocks/mockTurns";
import { emitSingleTurn } from "@/lib/demoStream";
import { useI18nStore } from "@/store/useI18nStore";
import { useAuthStore } from "@/store/useAuthStore";
import { DICTIONARIES } from "@/i18n/dictionaries";
import { isRealApiEnabled } from "@/lib/apiConfig";
import {
  apiCreateEscalation,
  apiCreateNote,
  apiCreateSession,
  apiEndSession,
  apiListEscalations,
  apiListNotes,
  apiPostAgentTextTurn,
  apiPostCallerTextTurn,
  apiRegenerateScript,
  apiStartSession,
  apiSubmitFeedback,
  ApiError,
  type FeedbackInput,
} from "@/lib/apiClient";

interface SessionStore {
  session: Session | null;
  captions: CaptionTurn[];
  agentTurns: AgentTurn[];
  summary: SessionSummary | null;
  partialCaption: string | null;
  currentTurnIndex: number;
  isProcessing: boolean;
  /** True between caller.audio.started and caller.audio.ended events.
   *  Set independently from partialCaption so the agent header chip
   *  stays visible even when STT doesn't emit interim transcripts
   *  (REST fallback, batch mode, chunk delays). */
  callerSpeaking: boolean;
  apiMode: "real" | "mock";
  lastError: string | null;

  notes: Note[];
  notesLoading: boolean;
  escalations: Escalation[];
  feedbackTurnIds: Set<string>;

  createSession: () => Promise<Session>;
  startSession: () => Promise<void>;
  pushNextCallerTurn: () => void;
  sendAgentReply: (text: string) => Promise<void>;
  endSession: () => Promise<SessionSummary | null>;
  resetDemo: () => void;

  ingestRemoteTurns: (input: {
    captions: CaptionTurn[];
    agentTurns: AgentTurn[];
  }) => { newCaptions: number; newAgentTurns: number };

  setPartialCaption: (text: string | null) => void;
  setCallerSpeaking: (active: boolean) => void;
  ingestRemoteCaption: (caption: CaptionTurn) => void;

  regenerateScriptForLatest: (
    tone: ScriptTone,
    additionalContext?: string
  ) => Promise<RecommendedReply | null>;
  addNote: (content: string) => Promise<Note | null>;
  refreshNotes: () => Promise<void>;
  recordEscalation: (
    type: EscalationType,
    reason?: string
  ) => Promise<Escalation | null>;
  refreshEscalations: () => Promise<void>;
  submitTurnFeedback: (
    input: FeedbackInput
  ) => Promise<boolean>;
}

function logRealApiFailure(op: string, err: unknown) {
  if (err instanceof ApiError) {
    console.warn(
      `[apiClient] ${op} failed (${err.status} ${err.code}): ${err.message} — falling back to mock`
    );
  } else {
    console.warn(`[apiClient] ${op} failed — falling back to mock`, err);
  }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  captions: [],
  agentTurns: [],
  summary: null,
  partialCaption: null,
  currentTurnIndex: 0,
  isProcessing: false,
  callerSpeaking: false,
  apiMode: isRealApiEnabled() ? "real" : "mock",
  lastError: null,

  notes: [],
  notesLoading: false,
  escalations: [],
  feedbackTurnIds: new Set<string>(),

  createSession: async () => {
    const lang = useI18nStore.getState().lang;
    const agentId = useAuthStore.getState().currentUser?.id;
    let session: Session | null = null;

    if (isRealApiEnabled()) {
      try {
        session = await apiCreateSession({ agentId, language: lang });
        set({ apiMode: "real", lastError: null });
      } catch (err) {
        logRealApiFailure("createSession", err);
        set({
          apiMode: "mock",
          lastError: err instanceof ApiError ? err.message : "createSession failed",
        });
      }
    }
    if (!session) {
      session = await createMockSession();
      set({ apiMode: "mock" });
    }

    set({
      session,
      captions: [],
      agentTurns: [],
      summary: null,
      partialCaption: null,
      currentTurnIndex: 0,
      isProcessing: false,
    });
    return session;
  },

  startSession: async () => {
    const { session, apiMode } = get();
    if (!session) return;

    if (apiMode === "real") {
      try {
        const updated = await apiStartSession(session.id);
        set({ session: updated, lastError: null });
        return;
      } catch (err) {
        logRealApiFailure("startSession", err);
        set({
          apiMode: "mock",
          lastError: err instanceof ApiError ? err.message : "startSession failed",
        });
      }
    }
    const updated = await startMockSession(session);
    set({ session: updated });
  },

  pushNextCallerTurn: () => {
    const { currentTurnIndex, session, apiMode } = get();
    if (!session) return;
    const lang = useI18nStore.getState().lang;
    const turns = getMockCallerTurns(lang);
    if (currentTurnIndex >= turns.length) return;

    const turn = turns[currentTurnIndex];
    const partialText = DICTIONARIES[lang].bubble.refining + "...";
    set({ isProcessing: true, partialCaption: partialText });

    if (apiMode === "real") {
      (async () => {
        try {
          const { caption } = await apiPostCallerTextTurn(
            session.id,
            turn.rawText,
            lang
          );
          set((s) => ({
            captions: [...s.captions, caption],
            partialCaption: null,
            isProcessing: false,
            currentTurnIndex: s.currentTurnIndex + 1,
            lastError: null,
          }));
        } catch (err) {
          logRealApiFailure("postCallerTurn", err);
          set({
            apiMode: "mock",
            lastError:
              err instanceof ApiError ? err.message : "postCallerTurn failed",
          });
          emitSingleTurn({
            sessionId: session.id,
            turn,
            partialText,
            onEvent: (event) => {
              if (event.type === "caption.partial") {
                const payload = event.payload as { text: string };
                set({ partialCaption: payload.text, isProcessing: true });
              } else if (event.type === "caption.final") {
                const payload = event.payload as CaptionTurn;
                set((s) => ({
                  captions: [
                    ...s.captions,
                    { ...payload, timestamp: event.timestamp },
                  ],
                  partialCaption: null,
                  isProcessing: false,
                  currentTurnIndex: s.currentTurnIndex + 1,
                }));
              }
            },
          });
        }
      })();
      return;
    }

    set({ isProcessing: true, partialCaption: null });
    emitSingleTurn({
      sessionId: session.id,
      turn,
      partialText,
      onEvent: (event) => {
        if (event.type === "caption.partial") {
          const payload = event.payload as { text: string };
          set({ partialCaption: payload.text, isProcessing: true });
        } else if (event.type === "caption.final") {
          const payload = event.payload as CaptionTurn;
          set((s) => ({
            captions: [
              ...s.captions,
              { ...payload, timestamp: event.timestamp },
            ],
            partialCaption: null,
            isProcessing: false,
            currentTurnIndex: s.currentTurnIndex + 1,
          }));
        }
      },
    });
  },

  sendAgentReply: async (text: string) => {
    const { session, apiMode } = get();
    if (!session) return;

    if (apiMode === "real") {
      try {
        const turn = await apiPostAgentTextTurn(session.id, text);
        set((s) => ({ agentTurns: [...s.agentTurns, turn], lastError: null }));
        return;
      } catch (err) {
        logRealApiFailure("postAgentTurn", err);
        set({
          apiMode: "mock",
          lastError:
            err instanceof ApiError ? err.message : "postAgentTurn failed",
        });
      }
    }
    const turn = await sendMockAgentReply(session.id, text);
    set((s) => ({ agentTurns: [...s.agentTurns, turn] }));
  },

  endSession: async () => {
    const { session, captions, agentTurns, apiMode } = get();
    if (!session) return null;
    const lang = useI18nStore.getState().lang;

    const startedAtMs = new Date(session.startedAt).getTime();
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - startedAtMs) / 1000)
    );

    // Empty conversation — skip the API entirely and build a local
    // "no conversation" summary. This avoids the hardcoded mock content
    // leaking when the backend has nothing real to summarize.
    if (captions.length === 0 && agentTurns.length === 0) {
      const empty = buildEmptySummary(session.id, durationSeconds, lang);
      set((s) => ({
        summary: empty,
        session: s.session
          ? {
              ...s.session,
              status: "ended",
              endedAt: new Date().toISOString(),
            }
          : s.session,
      }));
      return empty;
    }

    let summary: SessionSummary | null = null;

    if (apiMode === "real") {
      try {
        const abuseTypes = Array.from(
          new Set(
            captions.flatMap((c) => c.detectedAbuseTypes ?? []).filter(Boolean)
          )
        );
        summary = await apiEndSession(session.id, lang, abuseTypes);
        set({ lastError: null });
      } catch (err) {
        logRealApiFailure("endSession", err);
        set({
          apiMode: "mock",
          lastError:
            err instanceof ApiError ? err.message : "endSession failed",
        });
      }
    }

    if (!summary) {
      // Conversation exists but API didn't return a summary — build one
      // from the local store rather than the hardcoded demo content.
      summary = buildLocalSummary(
        session.id,
        durationSeconds,
        captions,
        agentTurns,
        lang
      );
    }

    set((s) => ({
      summary,
      session: s.session
        ? {
            ...s.session,
            status: "ended",
            endedAt: new Date().toISOString(),
          }
        : s.session,
    }));
    return summary;
  },

  resetDemo: () => {
    set({
      session: null,
      captions: [],
      agentTurns: [],
      summary: null,
      partialCaption: null,
      currentTurnIndex: 0,
      isProcessing: false,
      callerSpeaking: false,
      apiMode: isRealApiEnabled() ? "real" : "mock",
      lastError: null,
      notes: [],
      notesLoading: false,
      escalations: [],
      feedbackTurnIds: new Set<string>(),
    });
  },

  setPartialCaption: (text) => {
    set({ partialCaption: text, isProcessing: !!text });
  },

  setCallerSpeaking: (active) => {
    set({ callerSpeaking: active });
  },

  ingestRemoteCaption: (caption) => {
    set((s) => {
      if (s.captions.some((c) => c.id === caption.id)) {
        return { partialCaption: null, isProcessing: false };
      }
      return {
        captions: [...s.captions, caption].sort((a, b) => a.seq - b.seq),
        currentTurnIndex: s.currentTurnIndex + 1,
        partialCaption: null,
        isProcessing: false,
      };
    });
  },

  ingestRemoteTurns: ({ captions: incoming, agentTurns: incomingAgent }) => {
    const state = get();
    const existingCaptionIds = new Set(state.captions.map((c) => c.id));
    const existingAgentIds = new Set(state.agentTurns.map((a) => a.id));

    const newCaptions = incoming.filter((c) => !existingCaptionIds.has(c.id));
    const newAgentTurns = incomingAgent.filter(
      (a) => !existingAgentIds.has(a.id)
    );

    if (newCaptions.length === 0 && newAgentTurns.length === 0) {
      return { newCaptions: 0, newAgentTurns: 0 };
    }

    set((s) => ({
      captions: [...s.captions, ...newCaptions].sort((a, b) => a.seq - b.seq),
      agentTurns: [...s.agentTurns, ...newAgentTurns].sort(
        (a, b) => a.seq - b.seq
      ),
      currentTurnIndex: s.currentTurnIndex + newCaptions.length,
    }));
    return {
      newCaptions: newCaptions.length,
      newAgentTurns: newAgentTurns.length,
    };
  },

  regenerateScriptForLatest: async (tone, additionalContext) => {
    const { captions, apiMode } = get();
    const latest = captions[captions.length - 1];
    if (!latest) return null;

    if (apiMode === "real") {
      try {
        const { script } = await apiRegenerateScript(
          latest.id,
          tone,
          additionalContext
        );
        const replaced: RecommendedReply = {
          id: `${latest.id}_${tone}_${Date.now()}`,
          tone,
          text: script,
        };
        set((s) => ({
          captions: s.captions.map((c) =>
            c.id === latest.id
              ? {
                  ...c,
                  recommendedReplies: replaceTone(c.recommendedReplies, replaced),
                }
              : c
          ),
          lastError: null,
        }));
        return replaced;
      } catch (err) {
        logRealApiFailure("regenerateScript", err);
        set({
          apiMode: "mock",
          lastError:
            err instanceof ApiError ? err.message : "regenerateScript failed",
        });
      }
    }
    // mock fallback: rotate text
    const fallback: RecommendedReply = {
      id: `${latest.id}_${tone}_${Date.now()}`,
      tone,
      text: synthesizeMockScript(tone, latest, additionalContext),
    };
    set((s) => ({
      captions: s.captions.map((c) =>
        c.id === latest.id
          ? {
              ...c,
              recommendedReplies: replaceTone(c.recommendedReplies, fallback),
            }
          : c
      ),
    }));
    return fallback;
  },

  addNote: async (content) => {
    const { session, apiMode } = get();
    if (!session) return null;
    const agentId = useAuthStore.getState().currentUser?.id ?? "agent_demo";
    const trimmed = content.trim();
    if (!trimmed) return null;

    if (apiMode === "real") {
      try {
        const { noteId, createdAt } = await apiCreateNote(session.id, trimmed);
        const note: Note = {
          id: noteId,
          sessionId: session.id,
          agentId,
          content: trimmed,
          createdAt,
        };
        set((s) => ({ notes: [...s.notes, note], lastError: null }));
        return note;
      } catch (err) {
        logRealApiFailure("createNote", err);
        set({
          apiMode: "mock",
          lastError: err instanceof ApiError ? err.message : "createNote failed",
        });
      }
    }
    const note: Note = {
      id: `local_note_${Date.now()}`,
      sessionId: session.id,
      agentId,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ notes: [...s.notes, note] }));
    return note;
  },

  refreshNotes: async () => {
    const { session, apiMode } = get();
    if (!session || apiMode !== "real") return;
    set({ notesLoading: true });
    try {
      const notes = await apiListNotes(session.id);
      set({ notes, notesLoading: false, lastError: null });
    } catch (err) {
      logRealApiFailure("listNotes", err);
      set({
        notesLoading: false,
        apiMode: "mock",
        lastError: err instanceof ApiError ? err.message : "listNotes failed",
      });
    }
  },

  recordEscalation: async (type, reason) => {
    const { session, apiMode } = get();
    if (!session) return null;
    const agentId = useAuthStore.getState().currentUser?.id ?? "agent_demo";

    if (apiMode === "real") {
      try {
        const { escalationId } = await apiCreateEscalation(
          session.id,
          type,
          reason
        );
        const esc: Escalation = {
          id: escalationId,
          sessionId: session.id,
          type,
          reason: reason ?? null,
          requestedBy: agentId,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          escalations: [...s.escalations, esc],
          lastError: null,
        }));
        return esc;
      } catch (err) {
        logRealApiFailure("createEscalation", err);
        set({
          apiMode: "mock",
          lastError:
            err instanceof ApiError ? err.message : "createEscalation failed",
        });
      }
    }
    const esc: Escalation = {
      id: `local_esc_${Date.now()}`,
      sessionId: session.id,
      type,
      reason: reason ?? null,
      requestedBy: agentId,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ escalations: [...s.escalations, esc] }));
    return esc;
  },

  refreshEscalations: async () => {
    const { session, apiMode } = get();
    if (!session || apiMode !== "real") return;
    try {
      const escalations = await apiListEscalations(session.id);
      set({ escalations, lastError: null });
    } catch (err) {
      logRealApiFailure("listEscalations", err);
      set({
        apiMode: "mock",
        lastError:
          err instanceof ApiError ? err.message : "listEscalations failed",
      });
    }
  },

  submitTurnFeedback: async (input) => {
    const { session, apiMode } = get();
    if (!session) return false;

    if (apiMode === "real") {
      try {
        await apiSubmitFeedback(session.id, input);
        set((s) => {
          if (!input.turnId) return { lastError: null };
          const next = new Set(s.feedbackTurnIds);
          next.add(input.turnId);
          return { feedbackTurnIds: next, lastError: null };
        });
        return true;
      } catch (err) {
        logRealApiFailure("submitFeedback", err);
        set({
          apiMode: "mock",
          lastError:
            err instanceof ApiError ? err.message : "submitFeedback failed",
        });
        return false;
      }
    }
    set((s) => {
      if (!input.turnId) return {};
      const next = new Set(s.feedbackTurnIds);
      next.add(input.turnId);
      return { feedbackTurnIds: next };
    });
    return true;
  },
}));

function replaceTone(
  list: RecommendedReply[] | undefined,
  next: RecommendedReply
): RecommendedReply[] {
  const arr = list ? [...list] : [];
  const idx = arr.findIndex((r) => r.tone === next.tone);
  if (idx >= 0) {
    arr[idx] = next;
  } else {
    arr.push(next);
  }
  return arr;
}

function synthesizeMockScript(
  tone: ScriptTone,
  caption: CaptionTurn,
  additionalContext?: string
): string {
  const ctx = additionalContext ? ` (${additionalContext})` : "";
  if (tone === "공감")
    return `말씀 주신 ${caption.coreDemand ?? "내용"}에 대해 충분히 이해합니다${ctx}. 빠르게 도와드릴 수 있도록 한 번 더 정리해 드리겠습니다.`;
  if (tone === "단호")
    return `요청하신 부분은 ${caption.coreDemand ?? "건"}으로 확인했습니다${ctx}. 다만 처리 절차상 추가 정보 확인이 먼저 필요합니다.`;
  return `많이 답답하셨겠습니다${ctx}. 함께 차근차근 풀어보겠습니다. 우선 ${caption.coreDemand ?? "현재 상황"}부터 확인해 드릴게요.`;
}

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { registerHealth } from './health.js';
import { registerSessions } from './sessions.js';
import { registerTurns } from './turns.js';
import { registerAgent } from './agent.js';
import { registerTranscript } from './transcript.js';
import { registerScripts } from './scripts.js';
import { registerNotes } from './notes.js';
import { registerEscalations } from './escalations.js';
import { registerFeedback } from './feedback.js';
import { registerAgents } from './agents.js';
import { registerAdmin } from './admin.js';
import { registerCallerToken } from './caller-token.js';

export function registerPaths(registry: OpenAPIRegistry) {
  registerHealth(registry);
  registerSessions(registry);
  registerCallerToken(registry);
  registerTurns(registry);
  registerAgent(registry);
  registerTranscript(registry);
  registerScripts(registry);
  registerNotes(registry);
  registerEscalations(registry);
  registerFeedback(registry);
  registerAgents(registry);
  registerAdmin(registry);
}

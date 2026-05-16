import http from 'node:http';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './env.js';
import { errorHandler } from './errors.js';
import { sessionsRouter } from './routes/sessions.js';
import { turnsRouter } from './routes/turns.js';
import { agentTurnsRouter } from './routes/agent-turns.js';
import { transcriptRouter } from './routes/transcript.js';
import { scriptsRouter } from './routes/scripts.js';
import { escalationsRouter } from './routes/escalations.js';
import { notesRouter } from './routes/notes.js';
import { feedbackRouter } from './routes/feedback.js';
import { agentsRouter } from './routes/agents.js';
import { adminRouter } from './routes/admin.js';
import { callerTokenRouter } from './routes/caller-token.js';
import { attachWebSocket } from './ws/index.js';
import { getOpenApiDocument } from './openapi/document.js';

const allowedOrigins: string[] | '*' =
  env.CORS_ORIGINS === '*'
    ? '*'
    : env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

const app = express();
app.set('trust proxy', true); // X-Forwarded-Proto/Host 활용 (TLS reverse proxy 뒤일 때)
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// OpenAPI / Swagger UI
const openApiDoc = getOpenApiDocument();
app.get('/openapi.json', (_req, res) => res.json(openApiDoc));
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDoc, { customSiteTitle: 'CivilRelay AI API' })
);

app.use('/api/sessions', sessionsRouter);
app.use('/api', turnsRouter);
app.use('/api', agentTurnsRouter);
app.use('/api', transcriptRouter);
app.use('/api', scriptsRouter);
app.use('/api', escalationsRouter);
app.use('/api', notesRouter);
app.use('/api', feedbackRouter);
app.use('/api', agentsRouter);
app.use('/api', adminRouter);
app.use('/api', callerTokenRouter);

app.use(errorHandler);

const server = http.createServer(app);
attachWebSocket(server, { allowedOrigins });

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[docs]   http://localhost:${env.PORT}/docs`);
  // eslint-disable-next-line no-console
  console.log(`[cors]   origins=${env.CORS_ORIGINS}`);
});

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
import { attachWebSocket } from './ws/index.js';
import { getOpenApiDocument } from './openapi/document.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// OpenAPI / Swagger UI
const openApiDoc = getOpenApiDocument();
app.get('/openapi.json', (_req, res) => res.json(openApiDoc));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc, {
  customSiteTitle: 'CivilRelay AI API',
}));

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

app.use(errorHandler);

const server = http.createServer(app);
attachWebSocket(server);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[docs]   http://localhost:${env.PORT}/docs`);
});
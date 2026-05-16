import './setup.js';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import './schemas.js'; // .openapi() 이름 부여로 인한 self-register 효과
import { registerPaths } from './paths/index.js';

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Firebase ID Token',
    description:
      'Firebase Auth SDK가 발급한 ID 토큰을 Authorization: Bearer <token>으로 전송.\n\n' +
      'Use a Firebase Auth ID token. Send it as `Authorization: Bearer <token>`.',
  });

  registerPaths(registry);

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Mental Guard Backend Server',
      version: '0.1.0',
      description:
        '## 한국어\n' +
        '악성 민원으로부터 민원 접수인을 보호하는 실시간 AI 민원 중계 시스템.\n' +
        '민원인 음성을 STT/분석해 정제 자막으로 접수인에 전달, 접수인 답변은 원본 그대로 민원인에게 전달.\n\n' +
        '인증: 모든 `/api/*` 요청은 Firebase ID 토큰 필요 (`Authorization: Bearer <token>`).\n' +
        'WebSocket은 OpenAPI에 포함되지 않음 — `docs/websocket.md` 참조.\n\n' +
        '## English\n' +
        'Real-time AI relay for civil complaints, protecting agents from abusive callers.\n' +
        "Caller's voice is transcribed and refined into captions for the agent; agent's reply is delivered raw to the caller.\n\n" +
        'Auth: every `/api/*` request requires a Firebase ID token (`Authorization: Bearer <token>`).\n' +
        'WebSocket endpoints are not in this OpenAPI spec — see `docs/websocket.md`.',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Local dev / VM' },
      { url: 'http://34.170.117.171:4000', description: 'GCP VM' },
    ],
    tags: [
      { name: 'Sessions', description: '세션 / Sessions' },
      { name: 'Turns', description: '발화 / Turns' },
      { name: 'Agent', description: '접수인 답변 / Agent replies' },
      { name: 'Transcript', description: '대화 기록 / Transcript & events' },
      { name: 'Scripts', description: '추천 응답 / Suggested scripts' },
      { name: 'Notes', description: '메모 / Notes' },
      { name: 'Escalations', description: '에스컬레이션 / Escalations' },
      { name: 'Feedback', description: 'AI 피드백 / AI feedback' },
      { name: 'Agents', description: '접수인 보호 지표 / Agent health' },
      { name: 'Admin', description: '관리자 통계 / Admin analytics' },
      { name: 'Health', description: '서버 상태 / Server health' },
    ],
  });
}

let cached: ReturnType<typeof buildOpenApiDocument> | null = null;
export function getOpenApiDocument() {
  if (!cached) cached = buildOpenApiDocument();
  return cached;
}

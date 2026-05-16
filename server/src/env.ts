import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1),

  // Google Cloud — Storage + Speech-to-Text 둘 다 같은 service account 재사용
  GCS_PROJECT_ID: z.string().min(1),
  GCS_BUCKET: z.string().default('mental-guard-voice-record'),
  GCS_CLIENT_EMAIL: z.string().email(),
  GCS_PRIVATE_KEY: z.string().min(1),

  // GCP Speech-to-Text
  GCP_STT_LANGUAGE: z.string().default('ko-KR'),
  GCP_STT_SAMPLE_RATE: z.coerce.number().default(48000),
  GCP_STT_ENCODING: z
    .enum(['WEBM_OPUS', 'OGG_OPUS', 'LINEAR16', 'MP3', 'FLAC', 'ENCODING_UNSPECIFIED'])
    .default('WEBM_OPUS'),
  GCP_STT_TIMEOUT_MS: z.coerce.number().default(10000),

  // ML service (Gemini 호출은 ML 내부). 비어있으면 analyze는 fallback Analysis 반환.
  ML_SERVICE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  ML_SERVICE_TIMEOUT_MS: z.coerce.number().default(15000),

  // Firebase Admin
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),

  // CORS / WS origin 허용. '*' 또는 콤마구분 URL 목록 (e.g., "https://app.vercel.app,http://localhost:3000")
  CORS_ORIGINS: z.string().default('*'),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
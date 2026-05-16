import { env } from '../env.js';
import { ApiError } from '../errors.js';
import { z } from 'zod';
import { Classification, ActionLevel } from '@prisma/client';
import { defaultSummary } from '../fallback.js';

const SummarizeResponseSchema = z.object({
  final_classification: z.nativeEnum(Classification),
  final_action: z.nativeEnum(ActionLevel),
  core_demands: z.array(z.string()),
  agent_response_summary: z.array(z.string()).default([]),
  legal_basis_keys: z.array(z.string()).default([]),
});
export type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;

export interface SummarizeInput {
  turns: Array<{
    seq: number;
    speaker: 'CALLER' | 'AGENT';
    text: string;
    classification: Classification | null;
    threat_level: number | null;
  }>;
  cumulative_threat: number;
  language: string;
}

/**
 * ML 계약:
 *   POST {ML_SERVICE_URL}/summarize
 *   body: SummarizeInput
 *   response: SummarizeResponseSchema
 */
export async function summarizeSession(
  input: SummarizeInput,
  sessionId: string
): Promise<SummarizeResponse> {
  // ML 서비스 미설정 → 데모 fallback 반환 (analyzeTurn과 동일 정책)
  if (!env.ML_SERVICE_URL) {
    console.warn('[summarizeSession] ML_SERVICE_URL missing, using defaultSummary');
    return defaultSummary();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ML_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.ML_SERVICE_URL}/summarize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[summarizeSession] ml /summarize ${res.status}, using defaultSummary`);
      return defaultSummary();
    }
    const parsed = SummarizeResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.warn('[summarizeSession] invalid response shape, using defaultSummary');
      return defaultSummary();
    }
    return parsed.data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.warn('[summarizeSession] failed, using defaultSummary', String(e));
    return defaultSummary();
  } finally {
    clearTimeout(timer);
  }
}

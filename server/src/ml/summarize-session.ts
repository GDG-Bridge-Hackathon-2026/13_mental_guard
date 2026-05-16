import { env } from '../env.js';
import { ApiError } from '../errors.js';
import { z } from 'zod';
import { Classification, ActionLevel } from '@prisma/client';

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
    classification?: Classification;
    threat_level?: number;
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
  if (!env.ML_SERVICE_URL) {
    throw new ApiError(500, 'LLM_FAILED', 'ML_SERVICE_URL not configured');
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
      throw new ApiError(500, 'LLM_FAILED', `ml /summarize ${res.status}: ${await res.text()}`);
    }
    return SummarizeResponseSchema.parse(await res.json());
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(500, 'LLM_FAILED', String(e));
  } finally {
    clearTimeout(timer);
  }
}
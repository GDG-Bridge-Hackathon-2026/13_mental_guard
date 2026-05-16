import { env } from '../env.js';
import { ApiError } from '../errors.js';
import { z } from 'zod';

const RegenerateResponseSchema = z.object({
  script: z.string(),
});

export type ScriptTone = '공감' | '단호' | '위로';

export interface RegenerateInput {
  turn_id: string;
  raw_text: string;
  tone: ScriptTone;
  additional_context?: string;
}

/**
 * ML 계약:
 *   POST {ML_SERVICE_URL}/regenerate-script
 *   body: RegenerateInput
 *   response: { script: string }
 */
export async function regenerateScript(input: RegenerateInput): Promise<string> {
  if (!env.ML_SERVICE_URL) {
    throw new ApiError(500, 'LLM_FAILED', 'ML_SERVICE_URL not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ML_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.ML_SERVICE_URL}/regenerate-script`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(
        500,
        'LLM_FAILED',
        `ml /regenerate-script ${res.status}: ${await res.text()}`
      );
    }
    const parsed = RegenerateResponseSchema.parse(await res.json());
    return parsed.script;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(500, 'LLM_FAILED', String(e));
  } finally {
    clearTimeout(timer);
  }
}
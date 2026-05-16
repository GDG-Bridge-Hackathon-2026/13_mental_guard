import { env } from '../env.js';
import { ApiError } from '../errors.js';
import { AnalysisSchema, type AnalysisPayload } from '../schemas.js';
import { defaultAnalysis } from '../fallback.js';
import type { Language } from '@prisma/client';

export interface AnalyzeContext {
  recent_threats: number[]; // 직전 5턴의 threat_level (오래된→최근)
  cumulative_threat: number;
  total_turns: number;
  language: Language;
}

/**
 * ML 서비스 계약 (ML 팀과 확정):
 *   POST {ML_SERVICE_URL}/analyze
 *   body: { text: string, context: AnalyzeContext }
 *   response 200: AnalysisSchema 형태
 */
async function callAnalyze(text: string, ctx: AnalyzeContext): Promise<unknown> {
  if (!env.ML_SERVICE_URL) {
    throw new ApiError(500, 'LLM_FAILED', 'ML_SERVICE_URL not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ML_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.ML_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, context: ctx }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(500, 'LLM_FAILED', `ml /analyze ${res.status}: ${await res.text()}`);
    }
    return res.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(500, 'LLM_FAILED', String(e));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 분석 호출 + zod 검증 + 1회 재시도 + 최종 실패 시 fallback.
 * 명세 §12.4 — 원본 transcript는 무조건 저장하고, 분석은 기본값으로라도 반환.
 */
export async function analyzeTurn(
  text: string,
  ctx: AnalyzeContext
): Promise<AnalysisPayload> {
  try {
    const raw = await callAnalyze(text, ctx);
    const parsed = AnalysisSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    // JSON 형태 오류 → 1회 재시도
    const raw2 = await callAnalyze(text, ctx);
    const parsed2 = AnalysisSchema.safeParse(raw2);
    if (parsed2.success) return parsed2.data;

    // 2회 모두 실패 → fallback (예외 던지지 않음)
    console.warn('[analyzeTurn] LLM_INVALID_JSON, falling back', parsed2.error.message);
    return defaultAnalysis(text);
  } catch (e) {
    // 네트워크/타임아웃 등 — fallback 반환 (호출자가 그대로 진행)
    console.warn('[analyzeTurn] LLM_FAILED, falling back', String(e));
    return defaultAnalysis(text);
  }
}

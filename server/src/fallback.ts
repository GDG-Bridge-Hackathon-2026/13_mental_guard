import { Classification, ActionLevel } from '@prisma/client';
import { Emotion, Intent, Trend } from './enums.js';
import type { AnalysisPayload } from './schemas.js';

/**
 * LLM이 1회 재시도 후에도 실패할 때 사용하는 기본 Analysis.
 * 명세 §12.4 참조.
 */
export function defaultAnalysis(rawText: string): AnalysisPayload {
  return {
    refined: '정제 결과를 생성하지 못했습니다. 원문 확인이 필요합니다.',
    metrics: {
      threat_level: 1,
      emotion: Emotion.CONFUSION,
      factual_ratio: 0,
      repetition_score: 0,
      trend: Trend.STABLE,
    },
    summary: {
      core_demand: rawText.slice(0, 100) || '분석 실패',
      intent: Intent.INQUIRY,
      risk_keywords: [],
    },
    classification: Classification.A,
    preserved_facts: [],
    removed_expressions: [],
    abuse_types: [],
    confidence: 0,
    recommended_action: {
      level: ActionLevel.NORMAL,
      scripts: {
        공감: '내용을 다시 확인하겠습니다.',
        단호: '정확한 처리를 위해 내용을 다시 확인하겠습니다.',
        위로: '확인 후 안내드리겠습니다.',
      },
      legal_basis: null,
    },
  };
}

/**
 * ML /summarize 실패 시 기본 종합 분석.
 * 데모/개발 환경에서 ML 없이도 PATCH /end가 동작하도록.
 *
 * 반환 타입은 의도적으로 명시하지 않음 — ml/summarize-session.ts의
 * `SummarizeResponse` 와 순환 import를 피하기 위함. 구조적 호환성으로 통과.
 */
export function defaultSummary() {
  return {
    final_classification: Classification.B,
    final_action: ActionLevel.CAUTION,
    core_demands: ['(분석 미사용 — ML 서비스 비활성)'] as string[],
    agent_response_summary: [] as string[],
    legal_basis_keys: [] as string[],
  };
}
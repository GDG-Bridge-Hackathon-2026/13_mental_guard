// Prisma `Json` 필드의 런타임 형태.
// LLM 응답 zod 스키마 (schemas.ts)와 1:1로 맞춤.

import type { Classification, ActionLevel } from '@prisma/client';
import type { Emotion, Intent, Trend } from './enums.js';

export interface AnalysisMetrics {
  threat_level: number; // 1~5
  emotion: Emotion;
  factual_ratio: number;
  repetition_score: number;
  trend: Trend;
}

export interface AnalysisSummaryJson {
  core_demand: string;
  intent: Intent;
  risk_keywords: string[];
}

/// scripts 키는 명세대로 한국어
export interface RecommendedAction {
  level: ActionLevel;
  scripts: {
    공감: string;
    단호: string;
    위로: string;
  };
  legal_basis: string | null;
}

export type ClassificationDistribution = Record<Classification, number>;

export interface SessionSummary {
  session_id: string;
  duration_seconds: number;
  final: {
    classification: Classification;
    action: ActionLevel;
    legal_basis: string[];
  };
  cumulative: {
    total_turns: number;
    avg_threat: number;
    max_threat: number;
    factual_ratio: number;
    repetition_score: number;
    distribution: ClassificationDistribution;
  };
  timeline: Array<{ seq: number; timestamp: string; threat_level: number }>;
  core_demands: string[];
  agent_response_summary: string[];
  caller_pattern: {
    is_repeat: boolean;
    similar_past_sessions: string[];
  } | null;
  agent_health: {
    today_high_risk_count: number;
    filtered_abuse_count: number;
    recommended_break_minutes: number;
  };
}
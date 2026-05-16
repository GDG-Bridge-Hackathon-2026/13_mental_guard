import { Classification } from '@prisma/client';
import type { ClassificationDistribution } from './types.js';

export type ThresholdEvent = 'WARNING' | 'TERMINATE_ALLOWED' | null;

/**
 * 누적 위협 + 최근 분류에 기반한 threshold 평가.
 * - cumulative_threat ≥ 4.5  OR  최근 3턴 모두 D → TERMINATE_ALLOWED
 * - cumulative_threat ≥ 4.0                   → WARNING
 */
export function evaluateThreshold(
  cumulativeThreat: number,
  recentClassifications: Classification[]
): ThresholdEvent {
  const last3 = recentClassifications.slice(-3);
  const allD = last3.length === 3 && last3.every((c) => c === Classification.D);
  if (cumulativeThreat >= 4.5 || allD) return 'TERMINATE_ALLOWED';
  if (cumulativeThreat >= 4.0) return 'WARNING';
  return null;
}

export function emptyDistribution(): ClassificationDistribution {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

export function incrementDistribution(
  dist: ClassificationDistribution,
  cls: Classification
): ClassificationDistribution {
  return { ...dist, [cls]: (dist[cls] ?? 0) + 1 };
}

/**
 * count개의 표본까지 평균이 prev, 새 표본 next가 들어왔을 때의 갱신된 평균.
 * count == 0이면 next 그 자체.
 */
export function rollingAverage(prev: number, prevCount: number, next: number): number {
  if (prevCount <= 0) return next;
  return (prev * prevCount + next) / (prevCount + 1);
}
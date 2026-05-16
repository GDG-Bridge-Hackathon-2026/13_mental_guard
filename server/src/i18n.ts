// 코드 enum (영어 ASCII) ↔ 한·일 표시 라벨.
// FE 표시 / LLM 한국어 응답 정규화 양쪽에서 사용.

import { ActionLevel } from '@prisma/client';
import { Emotion, Intent, Trend } from './enums.js';

export type Locale = 'ko' | 'ja';

export const EmotionLabels: Record<Locale, Record<Emotion, string>> = {
  ko: { ANGER: '분노', FRUSTRATION: '좌절', CYNICISM: '냉소', CONFUSION: '혼란', CALM: '평정' },
  ja: { ANGER: '怒り', FRUSTRATION: '苛立ち', CYNICISM: '皮肉', CONFUSION: '混乱', CALM: '平静' },
};

export const IntentLabels: Record<Locale, Record<Intent, string>> = {
  ko: {
    LEGITIMATE_COMPLAINT: '정당민원',
    VENT: '불만토로',
    THREAT: '위협',
    INSULT: '순수모욕',
    INQUIRY: '문의',
  },
  ja: {
    LEGITIMATE_COMPLAINT: '正当な苦情',
    VENT: '不満吐露',
    THREAT: '脅迫',
    INSULT: '純粋侮辱',
    INQUIRY: '問い合わせ',
  },
};

export const ActionLevelLabels: Record<Locale, Record<ActionLevel, string>> = {
  ko: {
    NORMAL: '정상응대',
    CAUTION: '주의',
    ESCALATE: '상급자호출',
    TERMINATE_ALLOWED: '응대종료가능',
    LEGAL_ACTION: '법적대응',
  },
  ja: {
    NORMAL: '通常対応',
    CAUTION: '注意',
    ESCALATE: '上司エスカレーション',
    TERMINATE_ALLOWED: '対応終了可',
    LEGAL_ACTION: '法的対応',
  },
};

export const TrendLabels: Record<Locale, Record<Trend, string>> = {
  ko: { UP: '상승', DOWN: '하락', STABLE: '안정' },
  ja: { UP: '上昇', DOWN: '低下', STABLE: '安定' },
};
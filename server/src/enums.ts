// Json 필드 내부에서만 사용하는 enum들.
// Prisma는 모델 컬럼에서 안 쓰이는 enum을 client에 생성하지 않으므로,
// 여기서 직접 정의해 schema.prisma의 `enum Emotion {...}` 선언과 1:1 동기화 유지.

export const Emotion = {
  ANGER: 'ANGER',
  FRUSTRATION: 'FRUSTRATION',
  CYNICISM: 'CYNICISM',
  CONFUSION: 'CONFUSION',
  CALM: 'CALM',
} as const;
export type Emotion = (typeof Emotion)[keyof typeof Emotion];

export const Intent = {
  LEGITIMATE_COMPLAINT: 'LEGITIMATE_COMPLAINT',
  VENT: 'VENT',
  THREAT: 'THREAT',
  INSULT: 'INSULT',
  INQUIRY: 'INQUIRY',
} as const;
export type Intent = (typeof Intent)[keyof typeof Intent];

export const Trend = {
  UP: 'UP',
  DOWN: 'DOWN',
  STABLE: 'STABLE',
} as const;
export type Trend = (typeof Trend)[keyof typeof Trend];
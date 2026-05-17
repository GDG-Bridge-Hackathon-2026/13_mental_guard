import { Prisma } from '@prisma/client';

/**
 * Prisma의 `Json` 컬럼에 임의 객체를 넣을 때 필요한 캐스트 한 줄로 축약.
 *   data: { metrics: J(analysisMetricsObj) }
 */
export const J = <T>(v: T): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

/**
 * Prisma Json을 명시적으로 null로 셋하고 싶을 때.
 *   data: { summary: Jnull() }
 */
export const Jnull = () => Prisma.JsonNull;

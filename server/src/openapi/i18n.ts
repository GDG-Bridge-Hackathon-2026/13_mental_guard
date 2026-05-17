/** OpenAPI description에 한·영 병기. paths/* 와 schemas.ts에서 공유. */
export const ko_en = (ko: string, en: string) => `**KO** ${ko}\n\n**EN** ${en}`;

/** schemas.ts의 description처럼 prefix 없이 두 단락 형태가 필요할 때. */
export const bilingual = (ko: string, en: string) => `${ko}\n\n${en}`;

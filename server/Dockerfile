# syntax=docker/dockerfile:1.7

# ── builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma 엔진이 alpine에서 필요
RUN apk add --no-cache openssl libc6-compat

# deps 캐시
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# 소스 + 빌드
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate \
 && npx tsc

# ── runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

RUN apk add --no-cache openssl libc6-compat \
 && addgroup -S app \
 && adduser -S app -G app

# prod deps만 + postinstall로 prisma generate 실행
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# 컴파일된 산출물만 가져오기
COPY --from=builder /app/dist ./dist

USER app
EXPOSE 4000

# 헬스 (Cloud Run은 자체 확인하지만 docker compose / k8s에서 유용)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
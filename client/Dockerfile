FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

ARG BACKEND_INTERNAL_URL=http://34.170.117.171:4000
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

ARG BACKEND_INTERNAL_URL=http://34.170.117.171:4000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next-dev ./.next-dev

EXPOSE 3000

CMD ["npm", "run", "start"]

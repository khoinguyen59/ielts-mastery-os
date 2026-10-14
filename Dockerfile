# Multi-stage Dockerfile for IELTS Mastery OS Application Tier
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
COPY data/ ./data/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/ui/ ./src/ui/
COPY src/db/schema.sql ./src/db/schema.sql
COPY data/ ./data/

EXPOSE 3000

CMD ["node", "dist/api/server.js"]

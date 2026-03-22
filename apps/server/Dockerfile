# Stage 1: Build the monorepo
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/core/package.json ./packages/core/
COPY packages/adapters/package.json ./packages/adapters/

RUN npm ci

# Copy source code
COPY tsconfig.base.json ./
COPY apps/server/ ./apps/server/
COPY packages/core/ ./packages/core/
COPY packages/adapters/ ./packages/adapters/

RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# Stage 2: Production runner
FROM node:22-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy production artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/adapters/dist ./packages/adapters/dist
COPY --from=builder /app/packages/adapters/package.json ./packages/adapters/package.json

# Switch to non-root user
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/server/dist/index.js"]

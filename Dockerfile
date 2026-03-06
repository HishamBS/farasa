FROM oven/bun:1-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN bun run build
RUN rm -f .next/standalone/.env .next/standalone/.env.local

# Production image, copy all files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Ensure native PDF dependencies are available in standalone
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@napi-rs /app/node_modules/@napi-rs
# pdfjs-dist worker files are loaded at runtime via relative path and missed by Next.js trace
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfjs-dist/legacy/build /app/node_modules/pdfjs-dist/legacy/build

# Database migration support: SQL files + migration runner + deps
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm /app/node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres /app/node_modules/postgres
COPY --from=builder --chown=nextjs:nodejs /app/docker/migrate.ts ./migrate.ts
COPY --from=builder --chown=nextjs:nodejs /app/docker/entrypoint.sh ./entrypoint.sh

USER nextjs

EXPOSE 3010

ENV PORT=3010
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["sh", "/app/entrypoint.sh"]

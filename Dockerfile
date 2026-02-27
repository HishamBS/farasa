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

ARG AUTH_SECRET
ARG AUTH_GOOGLE_ID
ARG AUTH_GOOGLE_SECRET
ARG OPENROUTER_API_KEY
ARG DATABASE_URL
ARG TAVILY_API_KEY
ARG GCS_BUCKET_NAME
ARG GCS_PROJECT_ID
ARG NEXT_PUBLIC_APP_URL
ARG NODE_ENV=production

ENV AUTH_SECRET=${AUTH_SECRET}
ENV AUTH_GOOGLE_ID=${AUTH_GOOGLE_ID}
ENV AUTH_GOOGLE_SECRET=${AUTH_GOOGLE_SECRET}
ENV OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
ENV DATABASE_URL=${DATABASE_URL}
ENV TAVILY_API_KEY=${TAVILY_API_KEY}
ENV GCS_BUCKET_NAME=${GCS_BUCKET_NAME}
ENV GCS_PROJECT_ID=${GCS_PROJECT_ID}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

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

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]

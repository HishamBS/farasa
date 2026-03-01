import { TRPCError } from '@trpc/server'

type RateLimitEntry = { count: number; resetAt: number }

// TODO(production): Replace with Redis-backed store for multi-instance Cloud Run.
// In-memory store allows N_instances × rate_limit requests/min.
const store = new Map<string, RateLimitEntry>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message: string,
): void {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (entry.count >= limit) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message,
    })
  }

  entry.count++
}

import { TRPCError } from '@trpc/server'
import { LIMITS } from '@/config/constants'

type RateLimitEntry = { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

function evictExpired(): void {
  const now = Date.now()
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k)
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message: string,
): void {
  const now = Date.now()

  if (store.size > LIMITS.RATE_LIMIT_EVICTION_THRESHOLD) {
    evictExpired()
  }

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

import { TRPCError } from '@trpc/server'
import { RATE_LIMITS } from '@/config/constants'

type RateLimitEntry = { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = RATE_LIMITS.WINDOW_MS,
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
      message: 'Rate limit exceeded. Please wait before trying again.',
    })
  }

  entry.count++
}

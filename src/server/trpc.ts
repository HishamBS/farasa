import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { RATE_LIMITS, TRPC_CODES } from '@/config/constants'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: TRPC_CODES.UNAUTHORIZED })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.session.user.id,
      session: ctx.session,
    },
  })
})

export const rateLimitedChatProcedure = protectedProcedure.use(({ ctx, next }) => {
  checkRateLimit(`chat:${ctx.userId}`, RATE_LIMITS.CHAT_PER_MINUTE, RATE_LIMITS.WINDOW_MS)
  return next({ ctx })
})

export const rateLimitedUploadProcedure = protectedProcedure.use(({ ctx, next }) => {
  checkRateLimit(`upload:${ctx.userId}`, RATE_LIMITS.UPLOAD_PER_MINUTE, RATE_LIMITS.WINDOW_MS)
  return next({ ctx })
})

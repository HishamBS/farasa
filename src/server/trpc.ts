import { eq } from 'drizzle-orm'
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { TRPC_CODES } from '@/config/constants'
import { getRuntimeConfig } from '@/lib/runtime-config/service'
import { users } from '@/lib/db/schema'
import { AppError } from '@/lib/utils/errors'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

async function ensureSessionUserExists(ctx: Context, userId: string): Promise<void> {
  const [existing] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!existing) {
    throw new TRPCError({
      code: TRPC_CODES.UNAUTHORIZED,
      message: AppError.UNAUTHORIZED,
    })
  }
}

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: TRPC_CODES.UNAUTHORIZED })
  }

  await ensureSessionUserExists(ctx, ctx.session.user.id)

  return next({
    ctx: {
      ...ctx,
      userId: ctx.session.user.id,
      session: ctx.session,
    },
  })
})

export const rateLimitedChatProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
  checkRateLimit(
    `chat:${ctx.userId}`,
    runtimeConfig.limits.rateLimit.chatPerMinute,
    runtimeConfig.limits.rateLimit.windowMs,
    runtimeConfig.chat.errors.rateLimited,
  )
  return next({
    ctx: {
      ...ctx,
      runtimeConfig,
    },
  })
})

export const rateLimitedUploadProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
  checkRateLimit(
    `upload:${ctx.userId}`,
    runtimeConfig.limits.rateLimit.uploadPerMinute,
    runtimeConfig.limits.rateLimit.windowMs,
    runtimeConfig.chat.errors.rateLimited,
  )
  return next({
    ctx: {
      ...ctx,
      runtimeConfig,
    },
  })
})

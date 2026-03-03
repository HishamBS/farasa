import { eq } from 'drizzle-orm'
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { TRPC_CODES, RATE_LIMITS } from '@/config/constants'
import { getRuntimeConfig } from '@/lib/runtime-config/service'
import { users } from '@/lib/db/schema'
import { AppError } from '@/lib/utils/errors'
import type { Session } from 'next-auth'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

function getSessionUser(session: Session | null) {
  return session?.user
}

async function resolveUserId(ctx: Context, userId: string): Promise<string> {
  const [existing] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (existing) {
    return existing.id
  }

  const sessionUser = getSessionUser(ctx.session)
  const sessionEmail = sessionUser?.email
  if (!sessionEmail) {
    throw new TRPCError({
      code: TRPC_CODES.UNAUTHORIZED,
      message: AppError.UNAUTHORIZED,
    })
  }

  const [emailOwner] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, sessionEmail))
    .limit(1)

  if (emailOwner) {
    return emailOwner.id
  }

  await ctx.db
    .insert(users)
    .values({
      id: userId,
      email: sessionEmail,
      name: sessionUser?.name ?? null,
      image: sessionUser?.image ?? null,
    })
    .onConflictDoNothing()

  return userId
}

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: TRPC_CODES.UNAUTHORIZED })
  }

  const resolvedUserId = await resolveUserId(ctx, ctx.session.user.id)

  return next({
    ctx: {
      ...ctx,
      userId: resolvedUserId,
      session: ctx.session,
    },
  })
})

export const rateLimitedChatProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  checkRateLimit(
    `chat:${ctx.userId}`,
    RATE_LIMITS.CHAT_PER_MINUTE,
    RATE_LIMITS.WINDOW_MS,
    RATE_LIMITS.ERROR_MESSAGE,
  )
  const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
  return next({
    ctx: {
      ...ctx,
      runtimeConfig,
    },
  })
})

export const rateLimitedUploadProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  checkRateLimit(
    `upload:${ctx.userId}`,
    RATE_LIMITS.UPLOAD_PER_MINUTE,
    RATE_LIMITS.WINDOW_MS,
    RATE_LIMITS.ERROR_MESSAGE,
  )
  const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
  return next({
    ctx: {
      ...ctx,
      runtimeConfig,
    },
  })
})

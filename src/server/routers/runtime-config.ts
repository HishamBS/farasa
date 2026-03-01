import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { getRuntimeConfig, clearRuntimeConfigCache } from '@/lib/runtime-config/service'

export const runtimeConfigRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getRuntimeConfig({ userId: ctx.userId })
  }),

  invalidate: protectedProcedure
    .input(
      z
        .object({
          userScoped: z.boolean().default(false),
        })
        .default({ userScoped: false }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userScoped) {
        clearRuntimeConfigCache({ userId: ctx.userId })
      } else {
        clearRuntimeConfigCache()
      }
      return { ok: true }
    }),
})

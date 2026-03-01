import { router, protectedProcedure } from '../trpc'
import { getRuntimeConfig, clearRuntimeConfigCache } from '@/lib/runtime-config/service'
import { InvalidateRuntimeConfigInputSchema } from '@/schemas/runtime-config'

export const runtimeConfigRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getRuntimeConfig({ userId: ctx.userId })
  }),

  invalidate: protectedProcedure
    .input(InvalidateRuntimeConfigInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.userScoped) {
        clearRuntimeConfigCache({ userId: ctx.userId })
      } else {
        clearRuntimeConfigCache()
      }
      return { ok: true }
    }),
})

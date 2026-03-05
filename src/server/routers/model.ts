import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { ModelByIdSchema, ModelConfigSchema, RefreshModelsSchema } from '@/schemas/model'
import { getRuntimeConfig } from '@/lib/runtime-config/service'
import { TRPC_CODES } from '@/config/constants'

export const modelRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
    const { getModelRegistry } = await import('@/lib/ai/registry')
    const models = await getModelRegistry({ runtimeConfig, userId: ctx.userId })
    return models
  }),

  getById: protectedProcedure.input(ModelByIdSchema).query(async ({ ctx, input }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
    const { getModelRegistry } = await import('@/lib/ai/registry')
    const models = await getModelRegistry({ runtimeConfig, userId: ctx.userId })
    const model = models.find((m) => m.id === input.id)
    if (!model) {
      throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
    }
    return ModelConfigSchema.parse(model)
  }),

  refresh: protectedProcedure.input(RefreshModelsSchema).mutation(async ({ ctx, input }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId, force: true })
    const { getModelRegistry, clearModelRegistryCache } = await import('@/lib/ai/registry')
    if (input.force) {
      clearModelRegistryCache()
    }
    const models = await getModelRegistry({
      force: true,
      runtimeConfig,
      userId: ctx.userId,
    })
    return { count: models.length }
  }),
})

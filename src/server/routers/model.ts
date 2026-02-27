import { router, protectedProcedure } from '../trpc'
import {
  ModelByIdSchema,
  ModelConfigSchema,
  RefreshModelsSchema,
} from '@/schemas/model'

export const modelRouter = router({
  list: protectedProcedure.query(async () => {
    const { getModelRegistry } = await import('@/lib/ai/registry')
    const models = await getModelRegistry()
    return models
  }),

  getById: protectedProcedure
    .input(ModelByIdSchema)
    .query(async ({ input }) => {
      const { getModelRegistry } = await import('@/lib/ai/registry')
      const models = await getModelRegistry()
      const model = models.find((m) => m.id === input.id)
      if (!model) {
        return null
      }
      return ModelConfigSchema.parse(model)
    }),

  refresh: protectedProcedure
    .input(RefreshModelsSchema)
    .mutation(async ({ input }) => {
      const { getModelRegistry, clearModelRegistryCache } = await import(
        '@/lib/ai/registry'
      )
      if (input.force) {
        clearModelRegistryCache()
      }
      const models = await getModelRegistry(true)
      return { count: models.length }
    }),
})

import { router, protectedProcedure } from '../trpc'
import { ModelConfigSchema } from '@/schemas/model'
import { z } from 'zod'

export const modelRouter = router({
  list: protectedProcedure.query(async () => {
    const { getModelRegistry } = await import('@/lib/ai/registry')
    const models = await getModelRegistry()
    return models
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const { getModelRegistry } = await import('@/lib/ai/registry')
      const models = await getModelRegistry()
      const model = models.find((m) => m.id === input.id)
      if (!model) {
        return null
      }
      return ModelConfigSchema.parse(model)
    }),
})

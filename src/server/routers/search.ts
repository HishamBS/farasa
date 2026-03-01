import { router, protectedProcedure } from '../trpc'
import { SearchQuerySchema } from '@/schemas/search'
import { getRuntimeConfig } from '@/lib/runtime-config/service'

export const searchRouter = router({
  execute: protectedProcedure.input(SearchQuerySchema).mutation(async ({ ctx, input }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
    const { tavilySearch } = await import('@/lib/search/tavily')
    return tavilySearch({
      query: input.query,
      includeImages: input.includeImages ?? runtimeConfig.search.includeImagesByDefault,
      maxResults: Math.min(
        input.maxResults ?? runtimeConfig.limits.searchMaxResults,
        runtimeConfig.limits.searchMaxResults,
      ),
      searchDepth: input.searchDepth ?? runtimeConfig.search.defaultDepth,
    })
  }),
})

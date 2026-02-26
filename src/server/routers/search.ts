import { router, protectedProcedure } from '../trpc'
import { SearchQuerySchema } from '@/schemas/search'

export const searchRouter = router({
  execute: protectedProcedure
    .input(SearchQuerySchema)
    .mutation(async ({ input }) => {
      const { tavilySearch } = await import('@/lib/search/tavily')
      return tavilySearch(input)
    }),
})

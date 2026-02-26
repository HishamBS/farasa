import { tavily } from '@tavily/core'
import { env } from '@/config/env'
import { SearchResultSchema, SearchImageSchema } from '@/schemas/search'
import { LIMITS } from '@/config/constants'
import type { SearchQuery, SearchResponse } from '@/schemas/search'

const client = tavily({ apiKey: env.TAVILY_API_KEY })

export async function tavilySearch(input: SearchQuery): Promise<SearchResponse> {
  const result = await client.search(input.query, {
    searchDepth: input.searchDepth ?? 'basic',
    maxResults: LIMITS.SEARCH_MAX_RESULTS,
    includeImages: input.includeImages ?? false,
  })

  const results = (result.results ?? [])
    .map((r) =>
      SearchResultSchema.safeParse({
        title: r.title,
        url: r.url,
        snippet: r.content,
        score: r.score,
        publishedDate: r.publishedDate,
      }),
    )
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: typeof SearchResultSchema._type }).data)

  const images = input.includeImages
    ? (result.images ?? [])
        .map((img) =>
          SearchImageSchema.safeParse(
            typeof img === 'string' ? { url: img } : img,
          ),
        )
        .filter((r) => r.success)
        .map((r) => (r as { success: true; data: typeof SearchImageSchema._type }).data)
    : []

  return { results, images, query: input.query }
}

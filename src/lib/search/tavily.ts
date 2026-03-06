import { tavily } from '@tavily/core'
import { SEARCH_DEPTHS } from '@/config/constants'
import { env } from '@/config/env'
import { SearchResultSchema, SearchImageSchema } from '@/schemas/search'
import type { SearchQuery, SearchResponse, SearchResult, SearchImage } from '@/schemas/search'

const client = tavily({ apiKey: env.TAVILY_API_KEY })

export async function tavilySearch(input: SearchQuery): Promise<SearchResponse> {
  if (!input.maxResults) {
    throw new Error('Search maxResults is required at runtime.')
  }

  const result = await client.search(input.query, {
    searchDepth: input.searchDepth ?? SEARCH_DEPTHS.BASIC,
    maxResults: input.maxResults,
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
    .filter((r): r is { success: true; data: SearchResult } => r.success)
    .map((r) => r.data)

  const images = input.includeImages
    ? (result.images ?? [])
        .map((img) => SearchImageSchema.safeParse(typeof img === 'string' ? { url: img } : img))
        .filter((r): r is { success: true; data: SearchImage } => r.success)
        .map((r) => r.data)
    : []

  return { results, images, query: input.query }
}

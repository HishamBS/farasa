import { LIMITS } from '@/config/constants'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import type { SearchImage, SearchResult } from '@/schemas/search'
import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'
import { tavilySearch } from '@/lib/search/tavily'

type SearchEnrichment = {
  query: string
  results: SearchResult[]
  images: SearchImage[]
  context: string
}

function normalizeForPrompt(value: string, runtimeConfig: RuntimeConfig): string {
  if (!runtimeConfig.safety.escapeSearchXml) {
    return value
  }
  return escapeXmlForPrompt(value)
}

function buildSearchContext(results: SearchResult[], runtimeConfig: RuntimeConfig): string {
  if (results.length === 0) {
    return ''
  }

  const wrappers = runtimeConfig.prompts.wrappers
  const body = results
    .map((result) => {
      const title = normalizeForPrompt(result.title, runtimeConfig)
      const snippet = normalizeForPrompt(result.snippet, runtimeConfig)
      const url = normalizeForPrompt(result.url, runtimeConfig)
      return `${wrappers.searchResultOpen}<title>${title}</title><snippet>${snippet}</snippet><url>${url}</url>${wrappers.searchResultClose}`
    })
    .join('\n')

  return `\n\n${wrappers.searchResultsOpen}\n${body}\n${wrappers.searchResultsClose}`
}

export async function executeSearchEnrichment(
  query: string,
  runtimeConfig: RuntimeConfig,
): Promise<SearchEnrichment> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const response = await Promise.race([
    tavilySearch({
      query,
      maxResults: runtimeConfig.limits.searchMaxResults,
      includeImages: runtimeConfig.search.includeImagesByDefault,
      searchDepth: runtimeConfig.search.defaultDepth,
    }),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Search timeout')), LIMITS.SEARCH_TIMEOUT_MS)
    }),
  ]).finally(() => {
    clearTimeout(timeoutId)
  })

  return {
    query: response.query,
    results: response.results,
    images: response.images,
    context: buildSearchContext(response.results, runtimeConfig),
  }
}

import type { SearchImage, SearchResult } from '@/schemas/search'

export function parseSearchToolQuery(rawArguments: string, fallbackQuery: string): string {
  try {
    const parsed = JSON.parse(rawArguments) as { query?: unknown }
    if (typeof parsed.query === 'string' && parsed.query.trim().length > 0) {
      return parsed.query
    }
  } catch {
    // If arguments are malformed, keep the original user prompt as the safe fallback.
  }
  return fallbackQuery
}

export function mergeSearchResults(
  existing: ReadonlyArray<SearchResult>,
  incoming: ReadonlyArray<SearchResult>,
): SearchResult[] {
  const byUrl = new Map<string, SearchResult>()
  for (const result of existing) {
    byUrl.set(result.url, result)
  }
  for (const result of incoming) {
    byUrl.set(result.url, result)
  }
  return [...byUrl.values()]
}

export function mergeSearchImages(
  existing: ReadonlyArray<SearchImage>,
  incoming: ReadonlyArray<SearchImage>,
): SearchImage[] {
  const byUrl = new Map<string, SearchImage>()
  for (const image of existing) {
    byUrl.set(image.url, image)
  }
  for (const image of incoming) {
    byUrl.set(image.url, image)
  }
  return [...byUrl.values()]
}

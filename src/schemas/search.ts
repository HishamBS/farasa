import { z } from 'zod'
import { CHAT_MODES, LIMITS } from '@/config/constants'

export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(LIMITS.SEARCH_QUERY_MAX_LENGTH),
  maxResults: z.number().int().min(1).optional(),
  includeImages: z.boolean().optional(),
  searchDepth: z.enum(['basic', 'advanced']).optional(),
})

export const SearchImageSchema = z.object({
  url: z.string().url(),
  description: z.string().optional(),
})

export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  score: z.number().optional(),
  publishedDate: z.string().optional(),
})

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  images: z.array(SearchImageSchema).default([]),
})

export const SearchModeSchema = z.enum([CHAT_MODES.CHAT, CHAT_MODES.SEARCH])

export const ChatModeSchema = z.enum([CHAT_MODES.CHAT, CHAT_MODES.SEARCH, CHAT_MODES.GROUP])

export type SearchQuery = z.infer<typeof SearchQuerySchema>
export type SearchImage = z.infer<typeof SearchImageSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>
export type SearchResponse = z.infer<typeof SearchResponseSchema>
export type SearchMode = z.infer<typeof SearchModeSchema>
export type ChatMode = z.infer<typeof ChatModeSchema>

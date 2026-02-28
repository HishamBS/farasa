'use client'

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle, Search, Loader2 } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { TOOL_NAMES } from '@/config/constants'
import { SearchResultSchema, SearchImageSchema } from '@/schemas/search'
import { SearchResults } from '@/features/search/components/search-results'
import { ImageGallery } from '@/features/search/components/image-gallery'
import type { ToolExecutionState } from '@/types/stream'

type ToolExecutionProps = {
  execution: ToolExecutionState
}

export function ToolExecution({ execution }: ToolExecutionProps) {
  const shouldReduce = useReducedMotion()
  const isComplete = !!execution.completedAt
  const isSearch = execution.name === TOOL_NAMES.WEB_SEARCH

  const query =
    typeof execution.input === 'object' && execution.input !== null && 'query' in execution.input
      ? String((execution.input as { query: string }).query)
      : ''

  const parsedSearchPayload = useMemo(() => {
    if (!execution.result || typeof execution.result !== 'object') {
      return { results: [], images: [] }
    }
    const record = execution.result as Record<string, unknown>
    const rawResults = Array.isArray(record['results']) ? record['results'] : []
    const rawImages = Array.isArray(record['images']) ? record['images'] : []

    const results = rawResults.flatMap((item) => {
      const parsed = SearchResultSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
    const images = rawImages.flatMap((item) => {
      const parsed = SearchImageSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })

    return { results, images }
  }, [execution.result])

  const resultCount = isComplete ? parsedSearchPayload.results.length : null

  const searchResults = isSearch ? parsedSearchPayload.results : []
  const searchImages = isSearch ? parsedSearchPayload.images : []

  return (
    <motion.div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        isComplete
          ? 'border-[--border-subtle] bg-[--bg-surface]'
          : 'border-[--accent-glow] bg-[--bg-surface] shadow-md shadow-[--accent-muted]',
      )}
      {...(shouldReduce ? {} : fadeInUp)}
    >
      <div className="flex items-center gap-2">
        {isSearch && (
          <Search size={13} className={isComplete ? 'text-[--success]' : 'text-[--accent]'} />
        )}
        {!isComplete ? (
          <Loader2 size={12} className={cn('text-[--accent]', !shouldReduce && 'animate-spin')} />
        ) : (
          <CheckCircle size={12} className="text-[--success]" />
        )}

        <div className="min-w-0 flex-1">
          {query && <span className="text-xs text-[--text-secondary]">&ldquo;{query}&rdquo;</span>}
          {resultCount !== null && (
            <span className="ml-2 text-xs text-[--text-muted]">
              Found {resultCount} result{resultCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {isComplete && searchResults.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          <SearchResults results={searchResults} query={query} />
          <ImageGallery images={searchImages} />
        </div>
      )}
    </motion.div>
  )
}

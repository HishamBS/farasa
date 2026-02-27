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
    typeof execution.input === 'object' &&
    execution.input !== null &&
    'query' in execution.input
      ? String((execution.input as { query: string }).query)
      : ''

  const resultCount =
    isComplete && Array.isArray(execution.result) ? execution.result.length : null

  const searchResults = useMemo(() => {
    if (!isSearch || !Array.isArray(execution.result)) return []
    return execution.result.flatMap((r) => {
      const parsed = SearchResultSchema.safeParse(r)
      return parsed.success ? [parsed.data] : []
    })
  }, [isSearch, execution.result])

  const searchImages = useMemo(() => {
    if (!isSearch || !Array.isArray(execution.result)) return []
    return execution.result.flatMap((r) => {
      const parsed = SearchImageSchema.safeParse(r)
      return parsed.success ? [parsed.data] : []
    })
  }, [isSearch, execution.result])

  return (
    <motion.div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        isComplete
          ? 'border-[--border-subtle] bg-[--bg-surface]'
          : 'border-[--accent] bg-[--bg-surface] shadow-[0_0_8px_var(--accent-muted)]',
      )}
      {...(shouldReduce ? {} : fadeInUp)}
    >
      <div className="flex items-center gap-2">
        {isSearch && (
          <Search
            size={13}
            className={isComplete ? 'text-[--success]' : 'text-[--accent]'}
          />
        )}
        {!isComplete ? (
          <Loader2
            size={12}
            className={cn('text-[--accent]', !shouldReduce && 'animate-spin')}
          />
        ) : (
          <CheckCircle size={12} className="text-[--success]" />
        )}

        <div className="min-w-0 flex-1">
          {query && (
            <span className="text-xs text-[--text-secondary]">&ldquo;{query}&rdquo;</span>
          )}
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

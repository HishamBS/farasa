'use client'

import { useReducedMotion, motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { fadeInUp, staggerContainer } from '@/lib/utils/motion'
import type { SearchResult } from '@/schemas/search'

type SearchResultsProps = {
  results: SearchResult[]
  query: string
}

export function SearchResults({ results, query }: SearchResultsProps) {
  const shouldReduce = useReducedMotion()

  if (results.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-(--text-muted)">
        {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </p>
      <motion.div className="flex flex-col gap-2" {...(shouldReduce ? {} : staggerContainer)}>
        {results.map((result, i) => (
          <motion.a
            key={i}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-11 flex-col gap-1 rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-3 transition-colors hover:border-(--border-default) hover:bg-(--bg-surface-hover)"
            {...(shouldReduce ? {} : fadeInUp)}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-(--text-primary) group-hover:text-(--accent)">
                {result.title}
              </span>
              <ExternalLink className="mt-0.5 size-3 shrink-0 text-(--text-ghost)" />
            </div>
            <p className="line-clamp-2 text-xs text-(--text-muted)">{result.snippet}</p>
            <span className="truncate text-xs text-(--text-ghost)">{result.url}</span>
          </motion.a>
        ))}
      </motion.div>
    </div>
  )
}

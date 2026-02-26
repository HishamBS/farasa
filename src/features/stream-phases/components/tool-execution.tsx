'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle, Search, Loader2 } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { TOOL_NAMES } from '@/config/constants'
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
    isComplete && Array.isArray(execution.result)
      ? execution.result.length
      : null

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
            className={cn(
              'text-[--accent]',
              !shouldReduce && 'animate-spin',
            )}
          />
        ) : (
          <CheckCircle size={12} className="text-[--success]" />
        )}

        <div className="min-w-0 flex-1">
          {query && (
            <span className="text-xs text-[--text-secondary]">
              &ldquo;{query}&rdquo;
            </span>
          )}
          {resultCount !== null && (
            <span className="ml-2 text-xs text-[--text-muted]">
              Found {resultCount} result{resultCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

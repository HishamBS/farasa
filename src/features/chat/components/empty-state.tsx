'use client'

import { useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp } from '@/lib/utils/motion'
import { EMPTY_STATE_SUGGESTIONS } from '@/config/constants'

type EmptyStateProps = {
  onSelect?: (text: string) => void
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  const shouldReduce = useReducedMotion()
  const handleSelect = useCallback(() => {
    const defaultSuggestion = EMPTY_STATE_SUGGESTIONS[0]
    if (defaultSuggestion) {
      onSelect?.(defaultSuggestion)
    }
  }, [onSelect])

  const previewSuggestion = EMPTY_STATE_SUGGESTIONS[0] ?? 'Ask anything...'

  return (
    <div className="relative flex h-full flex-col items-center px-4">
      <motion.button
        type="button"
        onClick={handleSelect}
        className="mt-8 rounded-2xl border border-(--border-default) bg-(--bg-shell) px-6 py-3 text-base text-(--text-secondary) backdrop-blur-xl transition-colors hover:text-(--text-primary) sm:mt-10"
        {...(shouldReduce ? {} : fadeInUp)}
      >
        {previewSuggestion}
      </motion.button>
    </div>
  )
}

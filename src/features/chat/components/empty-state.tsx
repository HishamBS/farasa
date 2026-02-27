'use client'

import { useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '@/lib/utils/motion'
import { EMPTY_STATE_SUGGESTIONS } from '@/config/constants'

type SuggestionChipProps = {
  text: string
  onSelect: (text: string) => void
}

function SuggestionChip({ text, onSelect }: SuggestionChipProps) {
  const shouldReduce = useReducedMotion()
  const handleClick = useCallback(() => onSelect(text), [onSelect, text])

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className="rounded-xl border border-[--border-default] bg-[--bg-surface] p-3 text-left text-sm text-[--text-secondary] transition-colors hover:border-[--accent] hover:text-[--text-primary]"
      {...(shouldReduce ? {} : fadeInUp)}
    >
      {text}
    </motion.button>
  )
}

type EmptyStateProps = {
  onSelect?: (text: string) => void
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  const shouldReduce = useReducedMotion()
  const handleSelect = useCallback((text: string) => { onSelect?.(text) }, [onSelect])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <motion.div
        className="flex flex-col items-center gap-2"
        {...(shouldReduce ? {} : fadeInUp)}
      >
        <h1 className="text-2xl font-semibold text-[--text-primary]">farasa</h1>
        <p className="text-sm text-[--text-muted]">
          How can I help you today?
        </p>
      </motion.div>

      <motion.div
        className="grid w-full max-w-sm grid-cols-2 gap-3"
        {...(shouldReduce ? {} : staggerContainer)}
      >
        {EMPTY_STATE_SUGGESTIONS.map((suggestion) => (
          <SuggestionChip
            key={suggestion}
            text={suggestion}
            onSelect={handleSelect}
          />
        ))}
      </motion.div>
    </div>
  )
}

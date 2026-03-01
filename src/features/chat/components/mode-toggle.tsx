'use client'

import { useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { springBounce } from '@/lib/utils/motion'
import { CHAT_MODES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { SearchMode } from '@/schemas/search'

type ModeToggleProps = {
  value: SearchMode
  onChange: (mode: SearchMode) => void
}

const MODES: ReadonlyArray<{ value: SearchMode; label: string }> = [
  { value: CHAT_MODES.CHAT, label: 'Chat' },
  { value: CHAT_MODES.SEARCH, label: 'Search' },
]

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  const shouldReduce = useReducedMotion()

  const handleChange = useCallback((mode: SearchMode) => () => onChange(mode), [onChange])

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-1">
      {MODES.map(({ value: modeValue, label }) => (
        <button
          key={modeValue}
          type="button"
          onClick={handleChange(modeValue)}
          className={cn(
            'relative flex min-h-7 min-w-14 items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ease-out',
            value === modeValue
              ? 'text-white drop-shadow-sm'
              : 'text-(--text-muted) hover:text-(--text-secondary)',
            shouldReduce && value === modeValue && 'bg-accent shadow-md shadow-accent/20',
          )}
          aria-pressed={value === modeValue}
          aria-label={`${label} mode`}
        >
          {value === modeValue && !shouldReduce && (
            <motion.span
              layoutId="mode-active-pill"
              className="absolute inset-0 rounded-md bg-accent shadow-md shadow-accent/20"
              transition={springBounce}
            />
          )}
          <span className="relative z-10 inline-flex items-center">{label}</span>
        </button>
      ))}
    </div>
  )
}

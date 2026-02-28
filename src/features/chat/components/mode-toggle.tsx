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
    <div className="flex items-center gap-0.5 rounded-lg border border-[--border-subtle] bg-[--bg-surface] p-0.5">
      {MODES.map(({ value: modeValue, label }) => (
        <button
          key={modeValue}
          type="button"
          onClick={handleChange(modeValue)}
          className={cn(
            'relative min-h-8 min-w-16 rounded-md px-3 py-1 text-xs font-medium transition-all',
            value === modeValue
              ? 'text-[--text-primary]'
              : 'text-[--text-muted] hover:text-[--text-secondary]',
            shouldReduce && value === modeValue && 'bg-[--bg-surface-active]',
          )}
          aria-pressed={value === modeValue}
          aria-label={`${label} mode`}
        >
          {value === modeValue && !shouldReduce && (
            <motion.span
              layoutId="mode-active-pill"
              className="absolute inset-0 rounded-md bg-[--bg-surface-active] shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
              transition={springBounce}
            />
          )}
          <span className="relative z-10 inline-flex items-center">{label}</span>
        </button>
      ))}
    </div>
  )
}

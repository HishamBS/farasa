'use client'

import type { ElementType } from 'react'
import { useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MessageSquare, Globe } from 'lucide-react'
import { springBounce } from '@/lib/utils/motion'
import { CHAT_MODES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { SearchMode } from '@/schemas/search'

type ModeToggleProps = {
  value: SearchMode
  onChange: (mode: SearchMode) => void
}

const MODES: ReadonlyArray<{ value: SearchMode; icon: ElementType; label: string }> = [
  { value: CHAT_MODES.CHAT, icon: MessageSquare, label: 'Chat' },
  { value: CHAT_MODES.SEARCH, icon: Globe, label: 'Search' },
]

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  const shouldReduce = useReducedMotion()

  const handleChange = useCallback((mode: SearchMode) => () => onChange(mode), [onChange])

  return (
    <div className="flex items-center gap-0.5 rounded-[9px] border border-[--border-subtle] bg-[--bg-surface] p-[3px]">
      {MODES.map(({ value: modeValue, icon: Icon, label }) => (
        <button
          key={modeValue}
          type="button"
          onClick={handleChange(modeValue)}
          className={cn(
            'relative flex min-h-11 min-w-11 items-center gap-1.5 rounded-[6px] px-3 py-1 text-xs font-medium transition-all',
            value === modeValue
              ? 'text-[--text-primary]'
              : 'text-[--text-muted] hover:text-[--text-primary]',
            shouldReduce && value === modeValue && 'bg-[--accent-muted]',
          )}
          aria-pressed={value === modeValue}
          aria-label={`${label} mode`}
        >
          {value === modeValue && !shouldReduce && (
            <motion.span
              layoutId="mode-active-pill"
              className="absolute inset-0 rounded-[6px] bg-[--bg-surface-active] shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
              transition={springBounce}
            />
          )}
          <span className="relative z-10 inline-flex items-center gap-1.5">
            <Icon className="size-3" />
            <span className="hidden sm:block">{label}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

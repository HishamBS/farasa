'use client'

import { CHAT_MODES, UI_TEXT } from '@/config/constants'
import { useStreamSession } from '@/features/chat/context/stream-session-context'
import { cn } from '@/lib/utils/cn'
import { springBounce } from '@/lib/utils/motion'
import type { ChatMode } from '@/schemas/message'
import { motion, useReducedMotion } from 'framer-motion'
import { useCallback } from 'react'

type ModeToggleProps = {
  value: ChatMode
  onChange: (mode: ChatMode) => void
}

const MODES: ReadonlyArray<{ value: ChatMode; label: string }> = [
  { value: CHAT_MODES.CHAT, label: 'Chat' },
  { value: CHAT_MODES.TEAM, label: 'Team' },
]

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  const shouldReduce = useReducedMotion()
  const { isTurnActive } = useStreamSession()

  const handleChange = useCallback((mode: ChatMode) => () => onChange(mode), [onChange])

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-1">
      {MODES.map(({ value: modeValue, label }) => (
        <button
          key={modeValue}
          type="button"
          onClick={handleChange(modeValue)}
          disabled={isTurnActive}
          title={isTurnActive ? UI_TEXT.MODE_TOGGLE_DISABLED_HINT : undefined}
          className={cn(
            'relative flex min-h-7 min-w-14 items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ease-out',
            value === modeValue
              ? 'text-white drop-shadow-sm'
              : 'text-(--text-muted) hover:text-(--text-secondary)',
            shouldReduce && value === modeValue && 'bg-accent shadow-md shadow-accent/20',
            isTurnActive && 'opacity-50 cursor-not-allowed',
          )}
          aria-pressed={value === modeValue}
          aria-label={`Current mode: ${label}`}
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

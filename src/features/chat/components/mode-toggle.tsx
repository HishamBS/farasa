'use client'

import { useCallback } from 'react'
import { MessageSquare, Globe } from 'lucide-react'
import { CHAT_MODES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { SearchMode } from '@/schemas/search'

type ModeToggleProps = {
  value: SearchMode
  onChange: (mode: SearchMode) => void
}

const MODES = [
  { value: CHAT_MODES.CHAT as SearchMode, icon: MessageSquare, label: 'Chat' },
  { value: CHAT_MODES.SEARCH as SearchMode, icon: Globe, label: 'Search' },
]

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  const handleChange = useCallback(
    (mode: SearchMode) => () => onChange(mode),
    [onChange],
  )

  return (
    <div className="flex items-center gap-1">
      {MODES.map(({ value: modeValue, icon: Icon, label }) => (
        <button
          key={modeValue}
          type="button"
          onClick={handleChange(modeValue)}
          className={cn(
            'flex min-h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors',
            value === modeValue
              ? 'bg-[--accent-muted] text-[--accent]'
              : 'text-[--text-muted] hover:text-[--text-primary]',
          )}
          aria-pressed={value === modeValue}
          aria-label={`${label} mode`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  )
}

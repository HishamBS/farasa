'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Sparkles,
  Terminal,
  BrainCircuit,
  Mail,
  Bug,
  Map,
  Lightbulb,
  FileText,
  Box,
  RefreshCw,
  ClipboardList,
  Calculator,
  CalendarCheck,
} from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { EMPTY_STATE_SUGGESTIONS, UI_TEXT, MOTION, LIMITS, UX } from '@/config/constants'
import { cn } from '@/lib/utils/cn'

type EmptyStateProps = {
  onSelect?: (text: string) => void
}

const ICON_MAP = {
  BrainCircuit,
  Terminal,
  Sparkles,
  Mail,
  Bug,
  Map,
  Lightbulb,
  FileText,
  Box,
  ClipboardList,
  Calculator,
  CalendarCheck,
} as const

const getShuffledItems = (count: number) => {
  const array = [...EMPTY_STATE_SUGGESTIONS]
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = array[i]
    const src = array[j]
    if (tmp !== undefined && src !== undefined) {
      array[i] = src
      array[j] = tmp
    }
  }
  return array.slice(0, count)
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  const shouldReduce = useReducedMotion()
  const [currentSuggestions, setCurrentSuggestions] = useState(() =>
    EMPTY_STATE_SUGGESTIONS.slice(0, LIMITS.EMPTY_STATE_CHIP_COUNT),
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCurrentSuggestions(getShuffledItems(LIMITS.EMPTY_STATE_CHIP_COUNT))
    return () => {
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  const handleExploreMore = useCallback(() => {
    setIsRefreshing(true)
    refreshTimerRef.current = setTimeout(() => {
      setCurrentSuggestions(getShuffledItems(LIMITS.EMPTY_STATE_CHIP_COUNT))
      setIsRefreshing(false)
    }, UX.STATUS_MIN_DISPLAY_MS)
  }, [])

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 pb-12">
      <motion.div
        className="mb-10 flex flex-col items-center gap-2 text-center"
        initial={shouldReduce ? {} : { opacity: 0, y: 10, scale: 0.95 }}
        animate={shouldReduce ? {} : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: MOTION.DURATION_EXTRA_SLOW, ease: MOTION.EASING }}
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-(--bg-surface-active) to-(--bg-root) shadow-xl shadow-(--accent-glow) ring-1 ring-(--border-subtle)">
          <Sparkles className="size-6 text-accent" />
        </div>

        <h2 className="text-2xl font-semibold tracking-tight text-(--text-primary) md:text-3xl">
          {UI_TEXT.WELCOME_HEADING}
        </h2>
        <p className="max-w-md text-sm text-(--text-secondary) md:text-base">
          {UI_TEXT.WELCOME_BODY}
        </p>
      </motion.div>

      <motion.div
        className="mb-3 flex w-full max-w-3xl justify-end"
        initial={shouldReduce ? {} : { opacity: 0 }}
        animate={shouldReduce ? {} : { opacity: 1 }}
        transition={{ delay: MOTION.EXPLORE_REVEAL_DELAY, duration: MOTION.DURATION_SLOW }}
      >
        <button
          type="button"
          onClick={handleExploreMore}
          className="group flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-(--text-ghost) transition-colors hover:text-(--text-secondary)"
        >
          <RefreshCw
            className={cn(
              'size-3.5 transition-transform duration-500',
              isRefreshing && 'rotate-180',
            )}
          />
          {UI_TEXT.EXPLORE_MORE}
        </button>
      </motion.div>

      <motion.div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        {currentSuggestions.map((suggestion, index) => {
          const Icon = ICON_MAP[suggestion.icon]

          return (
            <motion.button
              key={suggestion.title}
              onClick={() => onSelect?.(suggestion.prompt)}
              variants={shouldReduce ? {} : fadeInUp}
              initial="initial"
              animate="animate"
              transition={{
                delay: index * MOTION.STAGGER_CHILDREN,
                duration: MOTION.DURATION_NORMAL,
              }}
              className={cn(
                'flex flex-col items-start gap-4 p-4 text-left',
                'rounded-2xl border border-(--border-subtle) bg-(--bg-glass) backdrop-blur-xl',
                'transition-all duration-200 hover:-translate-y-0.5 hover:border-(--border-default) hover:bg-(--bg-surface-hover)',
                'shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)]',
              )}
            >
              <div className="flex size-8 items-center justify-center rounded-[10px] bg-(--bg-surface-active) text-(--text-secondary)">
                <Icon className="size-4" />
              </div>
              <div className="mt-auto flex flex-col pt-4">
                <span className="text-sm font-medium text-(--text-primary)">
                  {suggestion.title}
                </span>
                <span className="text-xs text-(--text-muted)">{suggestion.label}</span>
              </div>
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}

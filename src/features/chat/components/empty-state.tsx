'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { EMPTY_STATE_SUGGESTIONS } from '@/config/constants'
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
} as const

// Utility to get random items
const getShuffledItems = (count: number) => {
  const shuffled = [...EMPTY_STATE_SUGGESTIONS].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  const shouldReduce = useReducedMotion()
  const [currentSuggestions, setCurrentSuggestions] = useState(() => getShuffledItems(3))
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleExploreMore = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setCurrentSuggestions(getShuffledItems(3))
      setIsRefreshing(false)
    }, 200) // slight delay to allow exit animation if we were doing one, or just simple state change
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 pb-12">
      {/* Hero Section */}
      <motion.div
        className="mb-10 flex flex-col items-center gap-2 text-center"
        initial={shouldReduce ? {} : { opacity: 0, y: 10, scale: 0.95 }}
        animate={shouldReduce ? {} : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-(--bg-surface-active) to-(--bg-root) shadow-xl shadow-(--accent-glow) ring-1 ring-(--border-subtle)">
          <Sparkles className="size-6 text-accent" />
        </div>

        <h2 className="text-2xl font-semibold tracking-tight text-(--text-primary) md:text-3xl">
          Welcome to farasa
        </h2>
        <p className="max-w-md text-sm text-(--text-secondary) md:text-base">
          I&apos;m your AI assistant. Let&apos;s build something amazing together today. What&apos;s
          on your mind?
        </p>
      </motion.div>

      {/* Explore More Header */}
      <motion.div
        className="mb-3 flex w-full max-w-3xl justify-end"
        initial={shouldReduce ? {} : { opacity: 0 }}
        animate={shouldReduce ? {} : { opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
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
          Explore more
        </button>
      </motion.div>

      {/* Suggestion Grid */}
      <motion.div
        className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-3"
        initial="initial"
        animate="animate"
      >
        {currentSuggestions.map((suggestion, index) => {
          const Icon = ICON_MAP[suggestion.icon as keyof typeof ICON_MAP]

          return (
            <motion.button
              key={`${suggestion.title}-${index}`}
              onClick={() => onSelect?.(suggestion.prompt)}
              variants={shouldReduce ? {} : fadeInUp}
              initial="initial"
              animate="animate"
              // Add a slight stagger to each item based on its index
              transition={{ delay: index * 0.05, duration: 0.2 }}
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

'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles, Terminal, BrainCircuit, ChevronDown } from 'lucide-react'
import { fadeInUp, staggerContainer } from '@/lib/utils/motion'
import { EMPTY_STATE_SUGGESTIONS } from '@/config/constants'
import { cn } from '@/lib/utils/cn'

type EmptyStateProps = {
  onSelect?: (text: string) => void
}

const ICON_MAP = {
  BrainCircuit,
  Terminal,
  Sparkles,
} as const

export function EmptyState({ onSelect }: EmptyStateProps) {
  const shouldReduce = useReducedMotion()

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 pb-12">
      {/* Hero Section */}
      <motion.div
        className="mb-10 flex flex-col items-center gap-1"
        initial={shouldReduce ? {} : { opacity: 0, y: 10, scale: 0.95 }}
        animate={shouldReduce ? {} : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-(--bg-surface-active) to-(--bg-root) shadow-xl shadow-(--accent-glow) ring-1 ring-(--border-subtle)">
          <Sparkles className="size-6 text-(--text-primary)" />
        </div>

        <h2 className="text-3xl font-semibold tracking-tight text-(--text-primary)">
          Let&apos;s build
        </h2>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xl font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary)"
        >
          farasa <ChevronDown className="size-4 text-(--text-ghost)" />
        </button>
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
          className="text-xs font-medium text-(--text-ghost) transition-colors hover:text-(--text-secondary)"
        >
          Explore more
        </button>
      </motion.div>

      {/* Suggestion Grid */}
      <motion.div
        className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-3"
        variants={shouldReduce ? {} : staggerContainer}
        initial="initial"
        animate="animate"
      >
        {EMPTY_STATE_SUGGESTIONS.map((suggestion) => {
          const Icon = ICON_MAP[suggestion.icon as keyof typeof ICON_MAP]

          return (
            <motion.button
              key={suggestion.title}
              onClick={() => onSelect?.(suggestion.prompt)}
              variants={shouldReduce ? {} : fadeInUp}
              className={cn(
                'flex flex-col items-start gap-4 p-4 text-left',
                'rounded-2xl border border-(--border-subtle) bg-(--bg-glass) backdrop-blur-xl',
                'transition-all duration-200 hover:border-(--border-default) hover:bg-(--bg-surface-hover)',
                'shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10',
              )}
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-(--bg-surface-active) text-(--text-secondary)">
                <Icon className="size-4" />
              </div>
              <div className="mt-auto flex flex-col pt-6">
                <span className="text-sm font-medium text-(--text-primary)">
                  {suggestion.title}
                </span>
                <span className="text-sm text-(--text-muted)">{suggestion.label}</span>
              </div>
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}

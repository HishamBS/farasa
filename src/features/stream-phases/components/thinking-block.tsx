'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { expand, collapse } from '@/lib/utils/motion'
import { UX, STATUS_MESSAGES } from '@/config/constants'
import type { ThinkingState } from '@/types/stream'

type ThinkingBlockProps = {
  thinking: ThinkingState
}

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const shouldReduce = useReducedMotion()
  const [isExpanded, setIsExpanded] = useState(!UX.THINKING_COLLAPSE_DEFAULT)

  const isComplete = !!thinking.completedAt
  const completedAt = thinking.completedAt
  const durationDisplay =
    isComplete && completedAt !== undefined
      ? Math.max(1, Math.round((completedAt - thinking.startedAt) / 1000))
      : null

  const toggle = useCallback(() => setIsExpanded((p) => !p), [])

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-xl border border-(--thinking-border) bg-(--thinking-bg) px-2.5 py-1.5 transition-all duration-200 hover:scale-105 hover:border-[#a78bfa4d] active:scale-95"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-(--thinking)">
          {isComplete
            ? `${STATUS_MESSAGES.THOUGHT_FOR_LABEL} ${durationDisplay ?? 1}${STATUS_MESSAGES.THOUGHT_DURATION_UNIT}`
            : STATUS_MESSAGES.THINKING}
        </span>
        <div className="flex items-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1 rounded-full bg-(--thinking)"
              animate={{ y: [0, -3, 0] }}
              transition={{
                duration: 0.6,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div key="content" {...(shouldReduce ? {} : expand)} className="overflow-hidden">
            <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-(--thinking-border) bg-(--thinking-bg) p-3 font-mono text-xs leading-relaxed text-(--thinking) shadow-inner">
              {thinking.content}
            </p>
          </motion.div>
        )}
        {!isExpanded && (
          <motion.div
            key="collapsed"
            {...(shouldReduce ? {} : collapse)}
            className="overflow-hidden"
          />
        )}
      </AnimatePresence>
    </div>
  )
}

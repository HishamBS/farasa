'use client'

import { MOTION, STATUS_MESSAGES, UX } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { collapse, expand } from '@/lib/utils/motion'
import type { ThinkingState } from '@/types/stream'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

type ThinkingBlockProps = {
  thinking: ThinkingState
  autoCollapse?: boolean
  className?: string
}

export function ThinkingBlock({ thinking, autoCollapse, className }: ThinkingBlockProps) {
  const shouldReduce = useReducedMotion()
  const [isExpanded, setIsExpanded] = useState(!UX.THINKING_COLLAPSE_DEFAULT)

  useEffect(() => {
    if (autoCollapse && isExpanded) {
      setIsExpanded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to autoCollapse transitions
  }, [autoCollapse])

  const isComplete = thinking.completedAt !== undefined
  const completedAt = thinking.completedAt
  const durationDisplay =
    isComplete && completedAt !== undefined
      ? Math.max(1, Math.round((completedAt - thinking.startedAt) / 1000))
      : null

  const toggle = useCallback(() => setIsExpanded((p) => !p), [])

  return (
    <div className={cn('mb-3', className)}>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-xl border border-(--thinking-border) bg-(--thinking-bg) px-2.5 py-1.5 transition-all duration-200 hover:scale-105 hover:border-(--thinking-border) active:scale-95"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-(--thinking)">
          {isComplete
            ? `${STATUS_MESSAGES.THOUGHT_FOR_LABEL} ${durationDisplay ?? 1}${STATUS_MESSAGES.THOUGHT_DURATION_UNIT}`
            : STATUS_MESSAGES.THINKING}
        </span>
        {!isComplete && (
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1 rounded-full bg-(--thinking)"
                animate={{ y: [0, -MOTION.THINKING_PULSE_Y, 0], opacity: [1, 0.7, 1] }}
                transition={{
                  duration: MOTION.DURATION_LOOP,
                  ease: MOTION.EASING_IN_OUT,
                  repeat: MOTION.REPEAT_INFINITE,
                  delay: i * MOTION.STAGGER_CHILDREN,
                }}
              />
            ))}
          </div>
        )}
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

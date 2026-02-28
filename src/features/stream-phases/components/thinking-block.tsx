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
    <div>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 rounded-[10px] border border-[--thinking-border] bg-[--thinking-bg] px-3 py-1.5 text-left transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.02]"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-[--thinking]"
              animate={{ scale: [0, 1, 0, 0] }}
              transition={{
                duration: 1.4,
                ease: 'easeInOut',
                repeat: Infinity,
                times: [0, 0.4, 0.8, 1],
                delay: i * 0.16,
              }}
            />
          ))}
        </div>
        <span className="text-xs text-[--thinking]">
          {isComplete
            ? `${STATUS_MESSAGES.THOUGHT_FOR_LABEL} ${durationDisplay ?? 1}${STATUS_MESSAGES.THOUGHT_DURATION_UNIT}`
            : STATUS_MESSAGES.THINKING}
        </span>
        {isComplete && !isExpanded && (
          <span className="text-xs text-[--text-muted]">tap to expand</span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div key="content" {...(shouldReduce ? {} : expand)} className="overflow-hidden">
            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap border-l border-[--thinking-border] pl-3 font-mono text-xs leading-relaxed text-[--thinking]/60">
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

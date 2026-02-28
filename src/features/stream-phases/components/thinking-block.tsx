'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { expand, collapse, pulse } from '@/lib/utils/motion'
import { UX, MOTION, STATUS_MESSAGES } from '@/config/constants'
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
      ? Math.round((completedAt - thinking.startedAt) / 1000)
      : null

  const toggle = useCallback(() => setIsExpanded((p) => !p), [])

  return (
    <div className="rounded-xl border border-[--thinking-border] bg-[--thinking-bg]">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 select-none"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown size={12} className="shrink-0 text-[--thinking]" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-[--thinking]" />
        )}

        {!isComplete ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1 rounded-full bg-[--thinking]"
                  {...(shouldReduce ? {} : pulse)}
                  transition={
                    shouldReduce
                      ? {}
                      : { ...pulse.transition, delay: i * MOTION.STAGGER_CHILDREN }
                  }
                />
              ))}
            </div>
            <span className="text-xs text-[--thinking]">{STATUS_MESSAGES.THINKING}</span>
          </div>
        ) : (
          <>
            <span className="text-xs text-[--thinking]">
              {STATUS_MESSAGES.THOUGHT_FOR_LABEL}
              {durationDisplay !== null && durationDisplay > 0
                ? ` ${durationDisplay}${STATUS_MESSAGES.THOUGHT_DURATION_UNIT}`
                : ''}
            </span>
            {isComplete && !isExpanded && (
              <span className="ml-1 text-xs text-[--text-ghost]">· tap to expand</span>
            )}
          </>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            {...(shouldReduce ? {} : expand)}
            className="overflow-hidden"
          >
            <p className="max-h-48 overflow-y-auto px-3 py-2.5 font-mono text-xs leading-relaxed text-[--thinking]/50 whitespace-pre-wrap bg-[--thinking-bg] border border-[--thinking-border] rounded-xl border-t-0 rounded-t-sm">
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

'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { STREAM_PHASES, CHAT_STREAM_STATUS, STREAM_PROGRESS } from '@/config/constants'
import { fadeInDown, fadeInUp } from '@/lib/utils/motion'
import type { StreamState } from '@/types/stream'

type StreamProgressProps = {
  streamState: StreamState
  onRetry?: () => void
}

type DisplayStatus = 'inactive' | 'active' | 'thinking' | 'done'

type DisplayPhase = {
  id: string
  label: string
  status: DisplayStatus
}

function extractModelName(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? (parts.slice(1).join('/') ?? modelId) : modelId
}

export function StreamProgress({ streamState, onRetry }: StreamProgressProps) {
  const shouldReduce = useReducedMotion()
  const isActive = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const isComplete = streamState.phase === CHAT_STREAM_STATUS.COMPLETE

  const routingStatus: DisplayStatus = streamState.modelSelection
    ? 'done'
    : streamState.statusMessages.some((status) => status.phase === STREAM_PHASES.ROUTING)
      ? 'active'
      : 'inactive'

  const hasThinking = !!streamState.thinking
  const thinkingStatus: DisplayStatus = !hasThinking
    ? streamState.modelSelection
      ? 'done'
      : 'inactive'
    : streamState.thinking?.completedAt
      ? 'done'
      : 'thinking'

  const respondingStatus: DisplayStatus = streamState.textContent
    ? isComplete
      ? 'done'
      : 'active'
    : streamState.modelSelection
      ? 'active'
      : 'inactive'

  const doneStatus: DisplayStatus = isComplete ? 'done' : 'inactive'

  const displayPhases: DisplayPhase[] = [
    { id: STREAM_PHASES.ROUTING, label: 'Routed', status: routingStatus },
    { id: STREAM_PHASES.THINKING, label: 'Thinking', status: thinkingStatus },
    { id: 'responding', label: STREAM_PROGRESS.LABELS.STREAMING, status: respondingStatus },
    { id: 'done', label: STREAM_PROGRESS.LABELS.DONE, status: doneStatus },
  ]

  const isVisible = isActive || isComplete

  if (streamState.phase === CHAT_STREAM_STATUS.ERROR && streamState.error) {
    return (
      <motion.div
        {...(shouldReduce ? {} : fadeInUp)}
        className="mx-auto my-3 flex max-w-[var(--content-max-width)] items-center gap-2 rounded-lg border border-[--error]/20 bg-[--error]/5 px-3 py-2 text-sm text-[--error]"
      >
        <AlertCircle className="size-4 shrink-0" />
        <span className="flex-1">{streamState.error}</span>
        {onRetry && streamState.lastInput && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[--text-muted] hover:bg-[--bg-surface-hover] hover:text-[--text-primary]"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div className="overflow-hidden" {...(shouldReduce ? {} : fadeInDown)}>
          <div className="flex items-center gap-3 border-b border-[--border-subtle] bg-gradient-to-r from-[--bg-ambient] to-transparent px-5 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {displayPhases.map((phase, index) => (
                <div key={phase.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'size-1.5 rounded-full bg-current',
                        phase.status === 'done' && 'text-[--success]',
                        phase.status === 'active' && 'animate-pulse text-[--text-primary]',
                        phase.status === 'thinking' && 'animate-pulse text-[--thinking]',
                        phase.status === 'inactive' && 'text-[--text-ghost]',
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs',
                        phase.status === 'done' && 'text-[--success]',
                        phase.status === 'active' && 'text-[--text-primary]',
                        phase.status === 'thinking' && 'text-[--thinking]',
                        phase.status === 'inactive' && 'text-[--text-muted]',
                      )}
                    >
                      {phase.label}
                    </span>
                  </div>
                  {index < displayPhases.length - 1 && (
                    <span className="text-xs text-[--text-ghost]">›</span>
                  )}
                </div>
              ))}
            </div>

            {streamState.modelSelection && (
              <div className="ml-auto flex items-center gap-1.5 rounded-full border border-[--provider-anthropic-border] bg-[--provider-anthropic-muted] px-2.5 py-1 text-xs text-[--provider-anthropic]">
                <span className="size-1.5 rounded-full bg-[--provider-anthropic]" />
                <span className="font-mono">
                  {extractModelName(streamState.modelSelection.model)}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

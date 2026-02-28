'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import {
  STREAM_PHASES,
  CHAT_STREAM_STATUS,
  STREAM_PROGRESS,
} from '@/config/constants'
import { fadeInDown } from '@/lib/utils/motion'
import type { StreamState } from '@/types/stream'

type StreamProgressProps = {
  streamState: StreamState
}

type PhaseStatus =
  (typeof STREAM_PROGRESS.STATUS)[keyof typeof STREAM_PROGRESS.STATUS]

type DisplayPhase = {
  id: string
  label: string
  status: PhaseStatus
}

export function StreamProgress({ streamState }: StreamProgressProps) {
  const shouldReduce = useReducedMotion()
  const isActive = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const { statusMessages, modelSelection, textContent } = streamState

  const displayPhases: DisplayPhase[] = []

  for (const msg of statusMessages) {
    const label = STREAM_PROGRESS.LABELS[msg.phase] ?? msg.phase
    const status: PhaseStatus = msg.completedAt
      ? STREAM_PROGRESS.STATUS.DONE
      : msg.phase === STREAM_PHASES.THINKING
        ? STREAM_PROGRESS.STATUS.THINKING
        : STREAM_PROGRESS.STATUS.ACTIVE
    displayPhases.push({ id: msg.phase, label, status })
  }

  if (textContent) {
    displayPhases.push({
      id: STREAM_PROGRESS.IDS.STREAMING,
      label: STREAM_PROGRESS.LABELS.STREAMING,
      status: isActive
        ? STREAM_PROGRESS.STATUS.ACTIVE
        : STREAM_PROGRESS.STATUS.DONE,
    })
  }

  const modelName = modelSelection
    ? (() => {
        const parts = modelSelection.model.split('/')
        return parts.length > 1 ? parts.slice(1).join('/') : modelSelection.model
      })()
    : ''

  return (
    <AnimatePresence>
      {isActive && displayPhases.length > 0 && (
        <motion.div
          className="overflow-hidden"
          {...(shouldReduce ? {} : fadeInDown)}
        >
          <div className="flex items-center gap-3 border-b border-[--border-subtle] bg-gradient-to-r from-[--accent-muted] to-transparent px-5 py-2.5">
            <div className="flex items-center gap-3">
              {displayPhases.map(({ id, label, status }) => (
                <div key={id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      status === STREAM_PROGRESS.STATUS.DONE && 'bg-[--success]',
                      status === STREAM_PROGRESS.STATUS.ACTIVE &&
                        'animate-pulse bg-[--accent]',
                      status === STREAM_PROGRESS.STATUS.THINKING &&
                        'animate-pulse bg-[--thinking]',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs',
                      status === STREAM_PROGRESS.STATUS.DONE &&
                        'text-[--success]',
                      status === STREAM_PROGRESS.STATUS.ACTIVE &&
                        'font-medium text-[--text-primary]',
                      status === STREAM_PROGRESS.STATUS.THINKING &&
                        'text-[--thinking]',
                      status === STREAM_PROGRESS.STATUS.INACTIVE &&
                        'text-[--text-ghost]',
                    )}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {modelSelection && (
              <div className="ml-auto flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-xs text-[--provider-anthropic]">
                <span className="size-1.5 rounded-full bg-[--provider-anthropic]" />
                <span className="font-mono">{modelName}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useStreamPhase } from '../context/stream-phase-context'
import { MOTION, STREAM_PHASES, STREAM_PROGRESS, TITLEBAR_PHASE } from '@/config/constants'
import { cn } from '@/lib/utils/cn'

const PHASE_ORDER = [
  STREAM_PHASES.ROUTING,
  STREAM_PHASES.THINKING,
  STREAM_PHASES.SEARCHING,
  STREAM_PHASES.READING_FILES,
  STREAM_PHASES.GENERATING_UI,
] as const

export function PhaseBar({ model }: { model?: string }) {
  const { phase } = useStreamPhase()
  const isActive = phase !== TITLEBAR_PHASE.IDLE && phase !== TITLEBAR_PHASE.DONE

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: MOTION.DURATION_FAST, ease: MOTION.EASING_IN_OUT }}
          className="flex-shrink-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[--border-subtle] bg-gradient-to-b from-[--accent-muted] to-transparent px-4 py-2">
            <div className="flex items-center gap-3">
              {PHASE_ORDER.map((p) => {
                const label = STREAM_PROGRESS.LABELS[p]
                return (
                  <div key={p} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'size-1.5 rounded-full transition-colors',
                        phase === TITLEBAR_PHASE.THINKING && p === STREAM_PHASES.THINKING
                          ? 'animate-pulse bg-[--accent]'
                          : 'bg-[--border-subtle]',
                      )}
                    />
                    <span className="text-xs text-[--text-ghost]">{label}</span>
                  </div>
                )
              })}
            </div>
            {model && (
              <span className="rounded-full bg-[--bg-surface] px-2 py-0.5 text-xs text-[--text-secondary]">
                {model}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

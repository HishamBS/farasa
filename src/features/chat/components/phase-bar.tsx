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

const ACTIVE_PHASE_INDEX = {
  [TITLEBAR_PHASE.IDLE]: -1,
  [TITLEBAR_PHASE.THINKING]: 1,
  [TITLEBAR_PHASE.STREAMING]: 4, // generating UI is the last phase before done
  [TITLEBAR_PHASE.DONE]: 5,
}

export function PhaseBar({ model }: { model?: string }) {
  const { phase } = useStreamPhase()
  const isActive = phase !== TITLEBAR_PHASE.IDLE && phase !== TITLEBAR_PHASE.DONE
  const currentIndex = ACTIVE_PHASE_INDEX[phase] ?? 0

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: MOTION.DURATION_FAST, ease: MOTION.EASING_IN_OUT }}
          className="shrink-0 overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-[--border-subtle] bg-linear-to-r from-[--accent-muted] to-transparent px-5 py-2.5">
            <div className="flex items-center gap-2 flex-1">
              {PHASE_ORDER.map((p, idx) => {
                const label = STREAM_PROGRESS.LABELS[p]
                const isPassed = currentIndex > idx
                const isCurrent = currentIndex === idx
                const isThinking = isCurrent && p === STREAM_PHASES.THINKING

                return (
                  <div
                    key={p}
                    className={cn(
                      'flex items-center gap-1.5 text-xs transition-colors duration-300',
                      isPassed && 'text-[--success]',
                      isCurrent && !isThinking && 'text-[--text-primary] font-medium',
                      isThinking && 'text-[--thinking]',
                      !isPassed && !isCurrent && 'text-[--text-ghost]',
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full transition-all duration-300',
                        isPassed && 'bg-[--success]',
                        isCurrent && !isThinking && 'bg-[--accent] animate-pulse',
                        isThinking && 'bg-[--thinking] animate-pulse',
                        !isPassed && !isCurrent && 'bg-[--text-ghost]/40',
                      )}
                    />
                    <span>{label}</span>
                  </div>
                )
              })}
            </div>
            {model && (
              <div className="ml-auto flex items-center gap-1.5 rounded-full bg-[--provider-anthropic-muted] border border-[--provider-anthropic-border] px-2.5 py-1 text-xs text-[--provider-anthropic]">
                <span className="size-1.5 rounded-full bg-[--provider-anthropic]" />
                {model}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

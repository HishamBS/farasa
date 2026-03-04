'use client'

import { MOTION, STREAM_PHASES, STREAM_PROGRESS, TITLEBAR_PHASE } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'
import { useStreamPhase } from '../context/stream-phase-context'

const STATUS_PHASES = [
  STREAM_PHASES.ROUTING,
  STREAM_PHASES.READING_FILES,
  STREAM_PHASES.SEARCHING,
  STREAM_PHASES.THINKING,
  STREAM_PHASES.GENERATING_UI,
  STREAM_PHASES.GENERATING_TITLE,
] as const

type RenderPhaseKey = (typeof STATUS_PHASES)[number] | 'STREAMING'
const STREAMING_PHASE_KEY: RenderPhaseKey = 'STREAMING'

export function PhaseBar({ model }: { model?: string }) {
  const { phase, hasText, statusMessages } = useStreamPhase()
  const isActive = phase !== TITLEBAR_PHASE.IDLE && phase !== TITLEBAR_PHASE.DONE

  const renderedPhases = useMemo(() => {
    const deduped: RenderPhaseKey[] = []
    const seen = new Set<RenderPhaseKey>()
    for (const statusMessage of statusMessages) {
      const phaseKey = statusMessage.phase as (typeof STATUS_PHASES)[number]
      if (!STATUS_PHASES.includes(phaseKey)) continue
      if (seen.has(phaseKey)) continue
      deduped.push(phaseKey)
      seen.add(phaseKey)
    }
    if (hasText) {
      deduped.push(STREAMING_PHASE_KEY)
    }
    return deduped
  }, [hasText, statusMessages])

  const currentPhase: RenderPhaseKey | null = (() => {
    if (renderedPhases.length === 0) return null
    if (phase === TITLEBAR_PHASE.DONE) return renderedPhases[renderedPhases.length - 1] ?? null
    if (hasText) return STREAMING_PHASE_KEY
    const lastStatusPhase = statusMessages[statusMessages.length - 1]?.phase
    if (lastStatusPhase && renderedPhases.includes(lastStatusPhase as RenderPhaseKey)) {
      return lastStatusPhase as RenderPhaseKey
    }
    return renderedPhases[0] ?? null
  })()
  const currentIndex = currentPhase ? renderedPhases.indexOf(currentPhase) : -1

  return (
    <AnimatePresence>
      {isActive && renderedPhases.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: MOTION.DURATION_FAST, ease: MOTION.EASING_IN_OUT }}
          className="shrink-0 overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-(--border-subtle) bg-linear-to-r from-(--accent-muted) to-transparent px-5 py-2.5">
            <div className="flex items-center gap-2 flex-1">
              {renderedPhases.map((phaseKey, idx) => {
                const label =
                  phaseKey === STREAMING_PHASE_KEY
                    ? STREAM_PROGRESS.LABELS.STREAMING
                    : STREAM_PROGRESS.LABELS[phaseKey]
                const isPassed = currentIndex > idx
                const isCurrent = currentIndex === idx
                const isThinking = isCurrent && phaseKey === STREAM_PHASES.THINKING

                return (
                  <div
                    key={phaseKey}
                    className={cn(
                      'flex items-center gap-1.5 text-xs transition-colors duration-300',
                      isPassed && 'text-(--success)',
                      isCurrent && !isThinking && 'text-(--text-primary) font-medium',
                      isThinking && 'text-(--thinking)',
                      !isPassed && !isCurrent && 'text-(--text-ghost)',
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full transition-all duration-300',
                        isPassed && 'bg-(--success)',
                        isCurrent && !isThinking && 'bg-(--accent) animate-pulse',
                        isThinking && 'bg-(--thinking) animate-pulse',
                        !isPassed && !isCurrent && 'bg-(--text-ghost)/40',
                      )}
                    />
                    <span>{label}</span>
                  </div>
                )
              })}
            </div>
            {model && (
              <div className="ml-auto flex items-center gap-1.5 rounded-full bg-(--provider-anthropic-muted) border border-(--provider-anthropic-border) px-2.5 py-1 text-xs text-(--provider-anthropic)">
                <span className="size-1.5 rounded-full bg-(--provider-anthropic)" />
                {model}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

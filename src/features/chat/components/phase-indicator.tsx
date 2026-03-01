'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { CHAT_STREAM_STATUS } from '@/config/constants'
import { useStreamPhase } from '../context/stream-phase-context'
import type { StreamState } from '@/types/stream'

type PhaseIndicatorProps = {
  streamState: StreamState
  model?: string
}

export function PhaseIndicator({ streamState, model }: PhaseIndicatorProps) {
  const { phase } = useStreamPhase()

  const isVisible = phase !== 'idle'

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="border-b border-(--border-subtle) overflow-hidden shrink-0 bg-linear-to-r from-(--accent-muted) to-transparent"
        >
          <div className="flex items-center justify-between px-5 py-2.5">
            {/* Error State overrides normal steps */}
            {streamState.phase === CHAT_STREAM_STATUS.ERROR ? (
              <div className="flex items-center gap-2 text-xs text-(--error)">
                <AlertCircle className="size-4 shrink-0" />
                <span>{streamState.error?.message ?? 'An error occurred'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                {/* Step 1: Routed */}
                <div
                  className={`flex items-center gap-1 text-xs transition-colors duration-300 ${
                    phase === 'thinking' || phase === 'streaming' || phase === 'done'
                      ? 'text-(--success)'
                      : 'text-(--text-muted)'
                  }`}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  Routed
                </div>

                <div className="text-xs text-(--text-ghost)">›</div>

                {/* Step 2: Thinking */}
                <div
                  className={`flex items-center gap-1 text-xs transition-colors duration-300 ${
                    phase === 'thinking'
                      ? 'text-(--thinking)'
                      : phase === 'streaming' || phase === 'done'
                        ? 'text-(--success)'
                        : 'text-(--text-muted)'
                  }`}
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full bg-current ${phase === 'thinking' ? 'animate-pulse' : ''}`}
                  />
                  Thinking
                </div>

                <div className="text-xs text-(--text-ghost)">›</div>

                {/* Step 3: Responding */}
                <div
                  className={`flex items-center gap-1 text-xs transition-colors duration-300 ${
                    phase === 'streaming'
                      ? 'text-(--text-primary)'
                      : phase === 'done'
                        ? 'text-(--success)'
                        : 'text-(--text-muted)'
                  }`}
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full bg-current ${phase === 'streaming' ? 'animate-pulse' : ''}`}
                  />
                  Responding
                </div>

                <div className="text-xs text-(--text-ghost)">›</div>

                {/* Step 4: Done */}
                <div
                  className={`flex items-center gap-1 text-xs transition-colors duration-300 ${
                    phase === 'done' ? 'text-(--success)' : 'text-(--text-muted)'
                  }`}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  Done
                </div>
              </div>
            )}

            {/* Model Chip */}
            <div className="flex items-center gap-1 rounded-full border border-(--provider-anthropic-border) bg-(--provider-anthropic-muted) px-2.5 py-1 text-xs font-normal text-(--warning)">
              <span className="size-1.5 shrink-0 rounded-full bg-(--warning)" />
              {model ?? 'claude-3.5-sonnet'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

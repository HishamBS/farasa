'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { STREAM_PHASES, CHAT_STREAM_STATUS, PROVIDERS } from '@/config/constants'
import { fadeInDown } from '@/lib/utils/motion'
import type { StreamState } from '@/types/stream'

type StreamProgressProps = {
  streamState: StreamState
}

const PHASE_LABELS: Record<string, string> = {
  [STREAM_PHASES.ROUTING]: 'Routing',
  [STREAM_PHASES.THINKING]: 'Thinking',
  [STREAM_PHASES.READING_FILES]: 'Reading',
  [STREAM_PHASES.GENERATING_UI]: 'Rendering',
}

const PROVIDER_DOT_CLASSES: Record<string, string> = {
  [PROVIDERS.ANTHROPIC]: 'bg-[--provider-anthropic]',
  [PROVIDERS.OPENAI]: 'bg-[--provider-openai]',
  [PROVIDERS.GOOGLE]: 'bg-[--provider-google]',
  [PROVIDERS.META]: 'bg-[--provider-meta]',
  [PROVIDERS.GROQ]: 'bg-[--provider-groq]',
  [PROVIDERS.CEREBRAS]: 'bg-[--provider-cerebras]',
}

const PROVIDER_TEXT_CLASSES: Record<string, string> = {
  [PROVIDERS.ANTHROPIC]: 'text-[--provider-anthropic]',
  [PROVIDERS.OPENAI]: 'text-[--provider-openai]',
  [PROVIDERS.GOOGLE]: 'text-[--provider-google]',
  [PROVIDERS.META]: 'text-[--provider-meta]',
  [PROVIDERS.GROQ]: 'text-[--provider-groq]',
  [PROVIDERS.CEREBRAS]: 'text-[--provider-cerebras]',
}

type PhaseStatus = 'inactive' | 'active' | 'thinking' | 'done'

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
    const label = PHASE_LABELS[msg.phase] ?? msg.phase
    const status: PhaseStatus = msg.completedAt
      ? 'done'
      : msg.phase === STREAM_PHASES.THINKING
        ? 'thinking'
        : 'active'
    displayPhases.push({ id: msg.phase, label, status })
  }

  if (textContent) {
    displayPhases.push({
      id: 'streaming',
      label: 'Streaming',
      status: isActive ? 'active' : 'done',
    })
  }

  const provider = modelSelection?.model.split('/')[0] ?? ''
  const dotClass = PROVIDER_DOT_CLASSES[provider] ?? 'bg-[--text-ghost]'
  const textClass = PROVIDER_TEXT_CLASSES[provider] ?? 'text-[--text-muted]'
  const modelName = modelSelection?.model.split('/').slice(1).join('/') ?? ''

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
                      status === 'done' && 'bg-[--success]',
                      status === 'active' && 'animate-pulse bg-[--accent]',
                      status === 'thinking' && 'animate-pulse bg-[--thinking]',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs',
                      status === 'done' && 'text-[--success]',
                      status === 'active' && 'font-medium text-[--text-primary]',
                      status === 'thinking' && 'text-[--thinking]',
                      status === 'inactive' && 'text-[--text-ghost]',
                    )}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {modelSelection && (
              <div
                className={cn(
                  'ml-auto flex items-center gap-1.5 rounded-full border border-[--border-subtle] px-2.5 py-1 text-xs',
                  textClass,
                )}
              >
                <span className={cn('size-1.5 rounded-full', dotClass)} />
                <span className="font-mono">{modelName}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { fadeIn } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import {
  STATUS_MESSAGES,
  STREAM_PROGRESS,
  PROVIDER_DOT_CLASSES,
} from '@/config/constants'
import type { ModelSelectionState } from '@/types/stream'

type ModelBadgeProps = {
  isRouting: boolean
  modelSelection: ModelSelectionState | null
}

export function ModelBadge({ isRouting, modelSelection }: ModelBadgeProps) {
  const shouldReduce = useReducedMotion()

  const provider = modelSelection?.model.split('/')[0] ?? ''
  const dotClass = PROVIDER_DOT_CLASSES[provider] ?? 'bg-[--text-ghost]'

  return (
    <AnimatePresence mode="wait">
      {isRouting && !modelSelection ? (
        <motion.div
          key={STREAM_PROGRESS.IDS.ROUTING}
          className="flex items-center gap-1.5"
          {...(shouldReduce ? {} : fadeIn)}
        >
          <span
            className={cn(
              'size-1.5 rounded-full bg-[--accent]',
              !shouldReduce && 'animate-pulse',
            )}
          />
          <span className="text-xs text-[--text-muted]">{STATUS_MESSAGES.ROUTING}</span>
        </motion.div>
      ) : modelSelection ? (
        <motion.div
          key={STREAM_PROGRESS.IDS.SELECTED}
          className="flex items-center gap-1.5"
          title={modelSelection.reasoning}
          {...(shouldReduce ? {} : fadeIn)}
        >
          <span className={cn('size-1.5 rounded-full', dotClass)} />
          <span className="font-mono text-xs text-[--text-muted]">
            {modelSelection.model}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

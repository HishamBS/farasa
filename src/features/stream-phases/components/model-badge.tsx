'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { fadeIn } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { STATUS_MESSAGES, STREAM_PROGRESS, PROVIDER_DOT_CLASSES } from '@/config/constants'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ModelSelectionState } from '@/types/stream'

type ModelBadgeProps = {
  isRouting: boolean
  modelSelection: ModelSelectionState | null
}

function extractModelName(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? (parts.slice(1).join('/') ?? modelId) : modelId
}

export function ModelBadge({ isRouting, modelSelection }: ModelBadgeProps) {
  const shouldReduce = useReducedMotion()

  const provider = modelSelection?.model.split('/')[0] ?? ''
  const dotClass = PROVIDER_DOT_CLASSES[provider] ?? 'bg-[--text-ghost]'

  const badge = modelSelection ? (
    <motion.div
      key={STREAM_PROGRESS.IDS.SELECTED}
      className="flex items-center gap-1.5"
      {...(shouldReduce ? {} : fadeIn)}
    >
      <span className={cn('size-1.5 rounded-full', dotClass)} />
      <span className="font-mono text-xs text-[--text-muted]">
        {extractModelName(modelSelection.model)}
      </span>
    </motion.div>
  ) : null

  return (
    <AnimatePresence mode="wait">
      {isRouting && !modelSelection ? (
        <motion.div
          key={STREAM_PROGRESS.IDS.ROUTING}
          className="flex items-center gap-1.5"
          {...(shouldReduce ? {} : fadeIn)}
        >
          <span
            className={cn('size-1.5 rounded-full bg-[--accent]', !shouldReduce && 'animate-pulse')}
          />
          <span className="text-xs text-[--text-muted]">{STATUS_MESSAGES.ROUTING}</span>
        </motion.div>
      ) : modelSelection?.reasoning ? (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs" side="bottom">
            <p className="font-medium text-[--text-secondary]">Router reasoning</p>
            <p className="mt-1 text-[--text-muted]">{modelSelection.reasoning}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        badge
      )}
    </AnimatePresence>
  )
}

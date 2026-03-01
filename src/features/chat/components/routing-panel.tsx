'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MODEL_CATEGORIES,
  MOTION,
  PROVIDER_DOT_CLASSES,
  LIMITS,
  STREAM_PHASES,
} from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { ModelSelectionState, TitlebarPhase } from '@/types/stream'
import type { ModelConfig } from '@/schemas/model'

const CATEGORY_LABELS: Record<string, string> = {
  [MODEL_CATEGORIES.CODE]: 'Code',
  [MODEL_CATEGORIES.ANALYSIS]: 'Analysis',
  [MODEL_CATEGORIES.CREATIVE]: 'Creative',
  [MODEL_CATEGORIES.VISION]: 'Vision',
  [MODEL_CATEGORIES.GENERAL]: 'General',
  [MODEL_CATEGORIES.FAST]: 'Fast',
}

const CATEGORY_PRIORITY = [
  MODEL_CATEGORIES.CODE,
  MODEL_CATEGORIES.VISION,
  MODEL_CATEGORIES.ANALYSIS,
  MODEL_CATEGORIES.FAST,
  MODEL_CATEGORIES.CREATIVE,
  MODEL_CATEGORIES.GENERAL,
] as const

type RoutingPanelProps = {
  modelSelection: ModelSelectionState | null
  streamPhase: TitlebarPhase
  hasText: boolean
  models: ModelConfig[]
}

export function RoutingPanel({ modelSelection, streamPhase, hasText, models }: RoutingPanelProps) {
  const isActive = streamPhase !== 'idle'
  const isRouting = isActive && modelSelection === null
  const hasDecision = modelSelection !== null
  const isCollapsed = hasDecision && (hasText || streamPhase === 'done')
  const isExpanded = hasDecision && !isCollapsed

  const modelConfig = useMemo(
    () => (modelSelection ? (models.find((m) => m.id === modelSelection.model) ?? null) : null),
    [modelSelection, models],
  )

  const primaryCategory = useMemo(() => {
    if (!modelConfig) return null
    return (
      CATEGORY_PRIORITY.find((cat) => modelConfig.capabilities.includes(cat)) ??
      MODEL_CATEGORIES.GENERAL
    )
  }, [modelConfig])

  const dotClass = modelConfig
    ? (PROVIDER_DOT_CLASSES[modelConfig.provider] ?? 'bg-(--text-ghost)')
    : 'bg-(--text-ghost)'

  const displayName =
    modelConfig?.name ?? modelSelection?.model.split('/')[1] ?? modelSelection?.model ?? ''

  if (!isActive) return null

  return (
    <AnimatePresence mode="wait">
      {isRouting && (
        <motion.div
          key={STREAM_PHASES.ROUTING}
          initial={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
          transition={{ duration: MOTION.DURATION_FAST }}
          className="mr-1 flex items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-surface) px-2.5 py-1 text-xs font-medium text-(--text-muted)"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-current" />
          <span>Selecting model…</span>
        </motion.div>
      )}

      {isExpanded && modelSelection && (
        <motion.div
          key="decision"
          initial={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
          transition={{ duration: MOTION.DURATION_NORMAL, ease: MOTION.EASING }}
          className="mr-1 flex flex-col gap-1 rounded-xl border border-(--border-subtle) bg-(--bg-glass-strong) px-3 py-2 text-xs backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <span className={cn('size-2 shrink-0 rounded-full', dotClass)} />
            <span className="max-w-40 truncate font-medium text-(--text-primary)">
              {displayName}
            </span>
            {primaryCategory && (
              <span className="ml-auto shrink-0 rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)">
                {CATEGORY_LABELS[primaryCategory]}
              </span>
            )}
          </div>

          {modelConfig && (
            <div className="flex flex-wrap items-center gap-1">
              {modelConfig.supportsThinking && (
                <span className="rounded-full bg-(--thinking)/10 px-1.5 py-0.5 text-[0.625rem] text-(--thinking)">
                  Thinking
                </span>
              )}
              {modelConfig.supportsVision && (
                <span className="rounded-full bg-(--accent-muted) px-1.5 py-0.5 text-[0.625rem] text-accent">
                  Vision
                </span>
              )}
              {modelConfig.supportsTools && (
                <span className="rounded-full bg-(--bg-surface-active) px-1.5 py-0.5 text-[0.625rem] text-(--text-muted)">
                  Tools
                </span>
              )}
              <span className="text-(--text-ghost)">
                {Math.round(modelConfig.contextWindow / LIMITS.TOKENS_PER_K)}k
              </span>
            </div>
          )}

          {modelSelection.reasoning && (
            <p className="text-[0.625rem] italic leading-tight text-(--text-muted)">
              {modelSelection.reasoning}
            </p>
          )}
        </motion.div>
      )}

      {isCollapsed && (
        <motion.div
          key="collapsed"
          initial={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
          transition={{ duration: MOTION.DURATION_FAST }}
          className="mr-1 flex items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-surface) px-2.5 py-1 text-xs text-(--text-muted)"
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
          <span className="max-w-32 truncate">{displayName}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

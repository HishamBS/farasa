'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MODEL_CATEGORIES,
  MOTION,
  PROVIDER_DOT_CLASSES,
  STREAM_PHASES,
  UX,
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

const SOURCE_LABELS: Record<string, string> = {
  explicit_request: 'Manual selection',
  conversation_default: 'Conversation default',
  user_default: 'User default',
  auto_router: 'Auto router',
}

type RoutingPanelProps = {
  modelSelection: ModelSelectionState | null
  streamPhase: TitlebarPhase
  hasText: boolean
  models: ModelConfig[]
}

export function RoutingPanel({ modelSelection, streamPhase, hasText, models }: RoutingPanelProps) {
  const isActive = streamPhase !== 'idle'
  const hasDecision = modelSelection !== null
  const isExpanded = hasDecision && isActive
  const isCollapsed = hasDecision && !isExpanded && hasText

  const [routingMinVisible, setRoutingMinVisible] = useState(false)
  const routingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isActive && !hasDecision) {
      setRoutingMinVisible(true)
      if (routingTimerRef.current) clearTimeout(routingTimerRef.current)
    } else if (hasDecision && routingMinVisible) {
      routingTimerRef.current = setTimeout(
        () => setRoutingMinVisible(false),
        UX.ROUTING_MIN_DISPLAY_MS,
      )
    } else if (!isActive) {
      setRoutingMinVisible(false)
      if (routingTimerRef.current) clearTimeout(routingTimerRef.current)
    }
    return () => {
      if (routingTimerRef.current) clearTimeout(routingTimerRef.current)
    }
  }, [isActive, hasDecision, routingMinVisible])

  const modelConfig = useMemo(
    () => (modelSelection ? (models.find((m) => m.id === modelSelection.model) ?? null) : null),
    [modelSelection, models],
  )

  const primaryCategory = modelSelection?.category ?? MODEL_CATEGORIES.GENERAL

  const dotClass = modelConfig
    ? (PROVIDER_DOT_CLASSES[modelConfig.provider] ?? 'bg-(--text-ghost)')
    : 'bg-(--text-ghost)'

  const displayName =
    modelConfig?.name ?? modelSelection?.model.split('/')[1] ?? modelSelection?.model ?? ''

  if (!isActive && !routingMinVisible) return null

  return (
    <AnimatePresence mode="wait">
      {routingMinVisible && (
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

          {modelSelection && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)">
                {SOURCE_LABELS[modelSelection.source] ?? modelSelection.source}
              </span>
              {typeof modelSelection.confidence === 'number' && (
                <span className="rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)">
                  {Math.round(modelSelection.confidence * 100)}% confidence
                </span>
              )}
              {modelSelection.factors?.map((factor) => (
                <span
                  key={factor.key}
                  className="rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)"
                  title={`${factor.label}: ${factor.value}`}
                >
                  {factor.label}
                </span>
              ))}
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

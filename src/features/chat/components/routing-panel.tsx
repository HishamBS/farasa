'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MOTION, PROVIDER_DOT_CLASSES, STREAM_PHASES, UX } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { ModelSelectionState, TitlebarPhase } from '@/types/stream'
import type { ModelConfig } from '@/schemas/model'

type RoutingPanelProps = {
  modelSelection: ModelSelectionState | null
  streamPhase: TitlebarPhase
  hasText: boolean
  models: ModelConfig[]
}

export function RoutingPanel({ modelSelection, streamPhase, hasText, models }: RoutingPanelProps) {
  const isActive = streamPhase !== 'idle'
  const hasDecision = modelSelection !== null
  const isCollapsed = hasDecision && (hasText || isActive)

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

  const dotClass = modelConfig
    ? (PROVIDER_DOT_CLASSES[modelConfig.provider] ?? 'bg-(--text-ghost)')
    : 'bg-(--text-ghost)'

  const displayName =
    modelConfig?.name ?? modelSelection?.model.split('/')[1] ?? modelSelection?.model ?? ''

  if (modelSelection && modelSelection.source !== 'auto_router') return null
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
          <span className="max-w-48 truncate">{displayName}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

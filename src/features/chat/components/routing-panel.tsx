'use client'

import { MOTION, PROVIDER_DOT_CLASSES, TITLEBAR_PHASE, UX } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { ModelConfig } from '@/schemas/model'
import type { ModelSelectionState, TitlebarPhase } from '@/types/stream'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type RoutingPanelProps = {
  modelSelection: ModelSelectionState | null
  streamPhase: TitlebarPhase
  hasText: boolean
  models: ModelConfig[]
}

export function RoutingPanel({ modelSelection, streamPhase, hasText, models }: RoutingPanelProps) {
  const isActive = streamPhase !== TITLEBAR_PHASE.IDLE
  const hasDecision = modelSelection !== null && modelSelection.source === 'auto_router'
  const [isUserCollapsed, setIsUserCollapsed] = useState(false)

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

  useEffect(() => {
    if (
      !hasDecision ||
      streamPhase === TITLEBAR_PHASE.THINKING ||
      streamPhase === TITLEBAR_PHASE.STREAMING
    ) {
      setIsUserCollapsed(false)
    }
  }, [streamPhase, modelSelection?.model, hasDecision])

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
    <>
      <AnimatePresence>
        {!isUserCollapsed && (routingMinVisible || hasDecision) && (
          <motion.aside
            key="routing-popup"
            initial={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
            transition={{ duration: MOTION.DURATION_FAST }}
            className="pointer-events-auto fixed top-[4.5rem] left-3 right-3 z-40 sm:left-auto sm:right-4 sm:w-[min(26rem,calc(100vw-2rem))]"
            aria-live="polite"
          >
            <div className="rounded-2xl border border-(--border-default) bg-(--bg-shell-strong) p-3 shadow-xl backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    hasDecision ? dotClass : 'animate-pulse bg-(--accent)',
                  )}
                />
                <span className="text-xs font-semibold tracking-wide text-(--text-secondary)">
                  Routing Decision
                </span>
                <button
                  type="button"
                  onClick={() => setIsUserCollapsed(true)}
                  className="ml-auto rounded-md p-1 text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
                  aria-label="Minimize routing details"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsUserCollapsed(true)}
                  className="rounded-md p-1 text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
                  aria-label="Dismiss routing details"
                >
                  <X size={14} />
                </button>
              </div>

              {!hasDecision && (
                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) px-3 py-2 text-xs text-(--text-muted)">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 animate-pulse rounded-full bg-(--accent)" />
                    <span>Selecting model…</span>
                  </div>
                </div>
              )}

              {hasDecision && modelSelection && (
                <div className="max-h-[40vh] space-y-2 overflow-y-auto rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="max-w-full truncate text-sm font-semibold text-(--text-primary)">
                      {displayName}
                    </span>
                    {typeof modelSelection.confidence === 'number' && (
                      <span className="rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)">
                        {Math.round(modelSelection.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>

                  {modelSelection.factors && modelSelection.factors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {modelSelection.factors.map((factor) => (
                        <span
                          key={factor.key}
                          className="rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)"
                        >
                          {factor.label}: {factor.value}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-(--text-secondary)">
                    {modelSelection.reasoning}
                  </p>

                  {hasText && (
                    <p className="text-[0.675rem] text-(--text-ghost)">
                      Routing locked for this response.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isUserCollapsed && hasDecision && (
          <motion.button
            key="routing-collapsed-chip"
            type="button"
            initial={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
            transition={{ duration: MOTION.DURATION_FAST }}
            onClick={() => setIsUserCollapsed(false)}
            className="pointer-events-auto fixed top-[4.5rem] right-4 z-40 flex items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-shell-strong) px-2.5 py-1 text-xs text-(--text-muted) shadow-md"
          >
            <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
            <span>Routing details</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

'use client'

import { STREAM_PHASES, STREAM_PROGRESS } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

type RouterFactor = {
  key: string
  label: string
  value: string
}

type RoutingDecisionBlockProps = {
  modelLabel: string
  confidence?: number
  reasoning?: string
  factors?: RouterFactor[]
  defaultExpanded?: boolean
  className?: string
}

function factorClass(key: string): string {
  if (key.includes('tool'))
    return 'border-(--routing-tool-border) bg-(--routing-tool-bg) text-(--routing-tool)'
  if (key.includes('source'))
    return 'border-(--routing-source-border) bg-(--routing-source-bg) text-(--routing-source)'
  if (key.includes('mode'))
    return 'border-(--routing-mode-border) bg-(--routing-mode-bg) text-(--routing-mode)'
  if (key.includes('response'))
    return 'border-(--routing-response-border) bg-(--routing-response-bg) text-(--routing-response)'
  if (key.includes('model'))
    return 'border-(--routing-model-border) bg-(--routing-model-bg) text-(--routing-model)'
  return 'border-(--border-subtle) bg-(--bg-surface-active) text-(--text-muted)'
}

export function RoutingDecisionBlock({
  modelLabel,
  confidence,
  reasoning,
  factors,
  defaultExpanded = true,
  className,
}: RoutingDecisionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const toggle = useCallback(() => setIsExpanded((value) => !value), [])

  const visibleFactors = useMemo(() => factors ?? [], [factors])

  return (
    <div className={cn('mb-3', className)}>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex max-w-full cursor-pointer select-none items-center gap-1.5 rounded-xl border border-(--accent)/35 bg-(--accent)/8 px-2.5 py-1.5 transition-all duration-200 hover:scale-[1.02] hover:border-(--accent)/50 active:scale-[0.98]"
        aria-expanded={isExpanded}
      >
        <span className="size-1.5 rounded-full bg-(--accent)" />
        <span className="text-sm font-medium text-(--accent)">
          {STREAM_PROGRESS.LABELS[STREAM_PHASES.ROUTING]}
        </span>
        <span className="max-w-36 truncate text-xs text-(--text-secondary)">{modelLabel}</span>
        {typeof confidence === 'number' && (
          <span className="rounded-full border border-(--border-subtle) bg-(--bg-surface-active) px-1.5 py-0.5 text-[0.625rem] text-(--text-muted)">
            {Math.round(confidence * 100)}%
          </span>
        )}
        <ChevronDown
          size={13}
          className={cn('text-(--text-muted) transition-transform', isExpanded && 'rotate-180')}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {visibleFactors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleFactors.map((factor) => (
                <span
                  key={factor.key}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[0.625rem]',
                    factorClass(factor.key),
                  )}
                >
                  {factor.label}: {factor.value}
                </span>
              ))}
            </div>
          )}
          {reasoning && (
            <p className="rounded-lg border border-(--routing-reasoning-border) bg-(--routing-reasoning-bg) px-2.5 py-2 text-xs leading-relaxed text-(--routing-reasoning)">
              {reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

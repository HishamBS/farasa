'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type AssistantFrameProps = {
  modelLabel: string | null
  tokenLabel: string | null
  isStreaming?: boolean
  children: ReactNode
}

export function AssistantFrame({
  modelLabel,
  tokenLabel,
  isStreaming = false,
  children,
}: AssistantFrameProps) {
  const hasMeta = Boolean(modelLabel || tokenLabel)

  return (
    <article className="mb-0.5 flex flex-col pt-2">
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-linear-to-br from-(--assistant-avatar-from) to-(--thinking) text-xs font-bold text-(--bg-root) shadow-inner shadow-white/20">
          f
        </div>
        <span className="text-sm font-medium text-(--text-primary)">farasa</span>
        {isStreaming && <span className="size-1.5 animate-pulse rounded-full bg-(--thinking)" />}
      </div>

      {hasMeta && (
        <div className="mb-2 pl-8 text-xs text-(--text-muted)">
          <span className={cn(isStreaming && 'animate-pulse')}>{modelLabel}</span>
          {modelLabel && tokenLabel ? ' · ' : null}
          <span>{tokenLabel}</span>
        </div>
      )}

      <div className="pl-8 text-sm lg:text-base leading-relaxed text-(--text-primary)">
        {children}
      </div>
    </article>
  )
}

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
  return (
    <article className="mb-4">
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-lg bg-linear-to-br from-[--accent] to-[--thinking] text-[10px] font-bold text-[--bg-root]">
          f
        </div>
        <span className="text-sm font-medium text-[--text-secondary]">farasa</span>
        <div
          className={cn(
            'ml-auto flex items-center gap-1.5 text-xs',
            isStreaming ? 'text-[--accent]' : 'text-[--text-muted]',
          )}
        >
          {!isStreaming && modelLabel && (
            <>
              <span className="size-1.5 rounded-full bg-[--provider-anthropic]" />
              <span>{modelLabel}</span>
            </>
          )}
          {isStreaming && <span>streaming…</span>}
          {!isStreaming && tokenLabel && <span>· {tokenLabel}</span>}
        </div>
      </div>

      <div className="pl-8 text-sm lg:text-[0.9375rem] leading-[1.72] text-[--text-primary]">
        {children}
      </div>
    </article>
  )
}

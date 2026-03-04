'use client'

import { cn } from '@/lib/utils/cn'
import Image from 'next/image'
import type { ReactNode } from 'react'
import farasaAvatar from '@/app/icon.png'

type AssistantFrameProps = {
  modelLabel: string | null
  tokenLabel: string | null
  costLabel?: string | null
  isStreaming?: boolean
  children: ReactNode
}

export function AssistantFrame({
  modelLabel,
  tokenLabel,
  costLabel,
  isStreaming = false,
  children,
}: AssistantFrameProps) {
  return (
    <article className="mb-0.5 flex flex-col pt-2">
      <div className="mb-2 flex items-center gap-2.5">
        <Image
          src={farasaAvatar}
          alt="Farasa assistant avatar"
          width={24}
          height={24}
          className="size-6 rounded-full object-cover ring-1 ring-(--border-subtle)"
        />
        <span className="text-sm font-medium text-(--text-secondary)">farasa</span>
        {isStreaming && <span className="size-1.5 animate-pulse rounded-full bg-(--thinking)" />}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-(--text-muted)">
          <span className={cn(isStreaming && 'animate-pulse')}>{modelLabel}</span>
          {modelLabel && tokenLabel ? ' · ' : null}
          <span>{tokenLabel}</span>
          {tokenLabel && costLabel ? ' · ' : null}
          <span>{costLabel}</span>
        </div>
      </div>

      <div className="pl-8 text-[0.90625rem] leading-[1.72] text-(--text-primary)">{children}</div>
    </article>
  )
}

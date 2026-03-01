'use client'

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { staggerContainer } from '@/lib/utils/motion'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { CHAT_STREAM_STATUS, PROVIDER_DOT_CLASSES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { StreamState } from '@/types/stream'

type GroupResponsePanelProps = {
  modelLabel: string
  providerKey: string
  streamState: StreamState
}

export function GroupResponsePanel({
  modelLabel,
  providerKey,
  streamState,
}: GroupResponsePanelProps) {
  const shouldReduce = useReducedMotion()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE

  const dotClass = useMemo(
    () => PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)',
    [providerKey],
  )

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-2 text-xs text-(--text-muted)">
        <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
        <span className="font-mono font-medium text-(--text-secondary)">{modelLabel}</span>
        {isStreaming && (
          <span className="ml-auto size-1.5 animate-pulse rounded-full bg-(--accent)" />
        )}
      </div>

      <div className="text-[0.90625rem] leading-[1.72] text-(--text-primary)">
        {streamState.thinking && <ThinkingBlock thinking={streamState.thinking} />}

        {streamState.toolExecutions.length > 0 && (
          <motion.div
            className="mb-3 flex flex-col gap-2"
            {...(shouldReduce ? {} : staggerContainer)}
          >
            {streamState.toolExecutions.map((execution, i) => (
              <ToolExecution key={i} execution={execution} />
            ))}
          </motion.div>
        )}

        {streamState.textContent && <MarkdownRenderer content={streamState.textContent} />}

        {isStreaming && (
          <span className="inline-block h-4 w-0.5 animate-pulse rounded-sm bg-(--accent) align-middle" />
        )}

        {streamState.phase === CHAT_STREAM_STATUS.ERROR && streamState.error && (
          <p className="text-sm text-red-400">{streamState.error.message}</p>
        )}
      </div>
    </div>
  )
}

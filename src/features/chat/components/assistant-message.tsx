'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '@/lib/utils/motion'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { CHAT_STREAM_STATUS, STATUS_MESSAGES } from '@/config/constants'
import { AssistantFrame } from './assistant-frame'
import { extractModelName } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'

type AssistantMessageProps = {
  streamState: StreamState
}

export function AssistantMessage({ streamState }: AssistantMessageProps) {
  const shouldReduce = useReducedMotion()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE

  const modelLabel = streamState.modelSelection
    ? extractModelName(streamState.modelSelection.model)
    : null
  const showRouterDecision = streamState.modelSelection?.source === 'auto_router'

  return (
    <motion.div {...(shouldReduce ? {} : fadeInUp)}>
      <AssistantFrame modelLabel={modelLabel} tokenLabel={null} isStreaming={isStreaming}>
        <div className="space-y-3">
          {isStreaming && !streamState.modelSelection && (
            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) px-3 py-2 text-xs text-(--text-muted)">
              <div className="flex items-center gap-2">
                <span className="size-1.5 animate-pulse rounded-full bg-(--accent)" />
                <span>{STATUS_MESSAGES.ROUTING}</span>
              </div>
            </div>
          )}

          {streamState.modelSelection && showRouterDecision && (
            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-(--text-secondary)">
                <span className="font-medium">{modelLabel}</span>
                {typeof streamState.modelSelection.confidence === 'number' && (
                  <span className="rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)">
                    {Math.round(streamState.modelSelection.confidence * 100)}% confidence
                  </span>
                )}
              </div>
              {streamState.modelSelection.factors &&
                streamState.modelSelection.factors.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {streamState.modelSelection.factors.map((factor) => (
                      <span
                        key={factor.key}
                        className="rounded-full bg-(--bg-surface-active) px-2 py-0.5 text-[0.625rem] text-(--text-muted)"
                      >
                        {factor.label}
                      </span>
                    ))}
                  </div>
                )}
              <p className="mt-1 text-(--text-muted)">{streamState.modelSelection.reasoning}</p>
            </div>
          )}

          {streamState.thinking && <ThinkingBlock thinking={streamState.thinking} />}

          {streamState.toolExecutions.length > 0 && (
            <motion.div className="flex flex-col gap-2" {...(shouldReduce ? {} : staggerContainer)}>
              {streamState.toolExecutions.map((execution, i) => (
                <ToolExecution key={i} execution={execution} />
              ))}
            </motion.div>
          )}

          {streamState.textContent && <MarkdownRenderer content={streamState.textContent} />}
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 animate-pulse rounded-sm bg-(--accent) align-middle" />
          )}

          {streamState.a2uiMessages.length > 0 && (
            <A2UIMessage messages={streamState.a2uiMessages} />
          )}

          {streamState.textContent && (
            <div className="flex items-center">
              <TTSControls content={streamState.textContent} />
            </div>
          )}
        </div>
      </AssistantFrame>
    </motion.div>
  )
}

'use client'

import { CHAT_STREAM_STATUS, STATUS_MESSAGES } from '@/config/constants'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { RoutingDecisionBlock } from '@/features/stream-phases/components/routing-decision-block'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { extractModelName } from '@/lib/utils/model'
import { fadeInUp, staggerContainer } from '@/lib/utils/motion'
import type { StreamState } from '@/types/stream'
import { motion, useReducedMotion } from 'framer-motion'
import { AssistantFrame } from './assistant-frame'

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
  const hasRoutingDecision = !!streamState.modelSelection && showRouterDecision

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

          {(hasRoutingDecision || streamState.thinking) && (
            <div className="flex flex-wrap items-start gap-2">
              {hasRoutingDecision && streamState.modelSelection && (
                <RoutingDecisionBlock
                  modelLabel={modelLabel ?? streamState.modelSelection.model}
                  model={streamState.modelSelection.model}
                  category={streamState.modelSelection.category}
                  confidence={streamState.modelSelection.confidence}
                  factors={streamState.modelSelection.factors}
                  reasoning={streamState.modelSelection.reasoning}
                  compact
                  defaultExpanded={false}
                  autoCollapse={!!streamState.textContent || streamState.toolExecutions.length > 0}
                  className="mb-0"
                />
              )}
              {streamState.thinking && (
                <ThinkingBlock
                  thinking={streamState.thinking}
                  autoCollapse={!!streamState.thinking.completedAt}
                  className="mb-0"
                />
              )}
            </div>
          )}

          {streamState.toolExecutions.length > 0 && (
            <motion.div className="flex flex-col gap-2" {...(shouldReduce ? {} : staggerContainer)}>
              {streamState.toolExecutions.map((execution, i) => (
                <ToolExecution key={i} execution={execution} />
              ))}
            </motion.div>
          )}

          {streamState.textContent && (
            <MarkdownRenderer
              content={streamState.textContent}
              autoCollapse={streamState.phase === CHAT_STREAM_STATUS.COMPLETE}
            />
          )}
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

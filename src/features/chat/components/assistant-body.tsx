'use client'

import { StreamingCursor } from '@/components/streaming-cursor'
import { EXPANDABLE_BLOCKS, STATUS_MESSAGES } from '@/config/constants'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { RoutingDecisionBlock } from '@/features/stream-phases/components/routing-decision-block'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { useActiveBlock } from '@/features/stream-phases/hooks/use-active-block'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { staggerContainer } from '@/lib/utils/motion'
import type { ModelSelectionState, ThinkingState, ToolExecutionState } from '@/types/stream'
import type { v0_8 } from '@a2ui-sdk/types'
import { motion, useReducedMotion } from 'framer-motion'

export type RoutingDecision = Partial<
  Pick<ModelSelectionState, 'model' | 'category' | 'confidence' | 'factors' | 'reasoning'>
> & {
  modelLabel: string
}

const EMPTY_MOTION = {} as const

type AssistantBodyProps = {
  routingDecision: RoutingDecision | null
  thinking: ThinkingState | null
  toolExecutions: ToolExecutionState[]
  textContent: string
  a2uiMessages: v0_8.A2UIMessage[]
  isStreaming?: boolean
  modelResolved?: boolean
  autoCollapse?: boolean
  messageId?: string
}

export function AssistantBody({
  routingDecision,
  thinking,
  toolExecutions,
  textContent,
  a2uiMessages,
  isStreaming = false,
  modelResolved = true,
  autoCollapse = false,
  messageId,
}: AssistantBodyProps) {
  const shouldReduce = useReducedMotion()
  const { activeBlock, toggleRouting, toggleThinking } = useActiveBlock()

  return (
    <div className="space-y-3">
      {isStreaming && !modelResolved && (
        <div className="w-fit rounded-xl border border-(--border-subtle) bg-(--bg-surface) px-3 py-2 text-xs text-(--text-muted)">
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-(--accent)" />
            <span>{STATUS_MESSAGES.ROUTING}</span>
          </div>
        </div>
      )}

      {(routingDecision || thinking) && (
        <div className="flex flex-wrap items-start gap-2">
          {routingDecision && (
            <RoutingDecisionBlock
              modelLabel={routingDecision.modelLabel}
              model={routingDecision.model}
              category={routingDecision.category}
              confidence={routingDecision.confidence}
              factors={routingDecision.factors}
              reasoning={routingDecision.reasoning}
              compact
              defaultExpanded={false}
              isExpanded={activeBlock === EXPANDABLE_BLOCKS.ROUTING}
              onToggle={toggleRouting}
              className="mb-0"
            />
          )}
          {thinking && (
            <ThinkingBlock
              thinking={thinking}
              isExpanded={activeBlock === EXPANDABLE_BLOCKS.THINKING}
              onToggle={toggleThinking}
              className="mb-0"
            />
          )}
        </div>
      )}

      {toolExecutions.length > 0 && (
        <motion.div
          className="flex flex-col gap-2"
          {...(shouldReduce ? EMPTY_MOTION : staggerContainer)}
        >
          {toolExecutions.map((execution, index) => (
            <ToolExecution key={`${execution.name}-${index}`} execution={execution} />
          ))}
        </motion.div>
      )}

      {textContent && <MarkdownRenderer content={textContent} autoCollapse={autoCollapse} />}

      {isStreaming && textContent && <StreamingCursor />}

      {a2uiMessages.length > 0 && <A2UIMessage messages={a2uiMessages} />}

      {textContent && messageId && (
        <div className="flex items-center">
          <TTSControls content={textContent} messageId={messageId} />
        </div>
      )}
    </div>
  )
}

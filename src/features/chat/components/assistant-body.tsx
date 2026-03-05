'use client'

import { EXPANDABLE_BLOCKS, STATUS_MESSAGES } from '@/config/constants'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { RoutingDecisionBlock } from '@/features/stream-phases/components/routing-decision-block'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { useActiveBlock } from '@/features/stream-phases/hooks/use-active-block'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { staggerContainer } from '@/lib/utils/motion'
import type { ModelCapability, RouterFactor } from '@/schemas/model'
import type { ThinkingState, ToolExecutionState } from '@/types/stream'
import type { v0_8 } from '@a2ui-sdk/types'
import { motion, useReducedMotion } from 'framer-motion'

type RoutingDecision = {
  modelLabel: string
  model?: string
  category?: ModelCapability
  confidence?: number
  factors?: RouterFactor[]
  reasoning?: string
}

type AssistantBodyProps = {
  routingDecision: RoutingDecision | null
  thinking: ThinkingState | null
  toolExecutions: ToolExecutionState[]
  textContent: string
  a2uiMessages: v0_8.A2UIMessage[]
  isStreaming?: boolean
  modelResolved?: boolean
  autoCollapse?: boolean
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
        <motion.div className="flex flex-col gap-2" {...(shouldReduce ? {} : staggerContainer)}>
          {toolExecutions.map((execution) => (
            <ToolExecution
              key={`${execution.name}-${execution.completedAt}`}
              execution={execution}
            />
          ))}
        </motion.div>
      )}

      {textContent && <MarkdownRenderer content={textContent} autoCollapse={autoCollapse} />}

      {isStreaming && textContent && (
        <span className="inline-block h-4 w-0.5 animate-pulse rounded-sm bg-(--accent) align-middle" />
      )}

      {a2uiMessages.length > 0 && <A2UIMessage messages={a2uiMessages} />}

      {textContent && (
        <div className="flex items-center">
          <TTSControls content={textContent} />
        </div>
      )}
    </div>
  )
}

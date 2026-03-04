'use client'

import {
  AI_PARAMS,
  EXPANDABLE_BLOCKS,
  MODEL_SELECTION_SOURCES,
  TOOL_NAMES,
  UI_TEXT,
} from '@/config/constants'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { RoutingDecisionBlock } from '@/features/stream-phases/components/routing-decision-block'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { formatCost } from '@/lib/utils/format'
import { extractModelName } from '@/lib/utils/model'
import { fadeInUp } from '@/lib/utils/motion'
import type { Message, MessageMetadata } from '@/schemas/message'
import { MessageMetadataSchema } from '@/schemas/message'
import type { ThinkingState, ToolExecutionState } from '@/types/stream'
import type { v0_8 } from '@a2ui-sdk/types'
import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { AssistantFrame } from './assistant-frame'

type ActiveBlock = (typeof EXPANDABLE_BLOCKS)[keyof typeof EXPANDABLE_BLOCKS] | null

type HistoricalAssistantMessageProps = {
  message: Message
}

function parseA2UIMessages(raw: unknown[] | undefined): v0_8.A2UIMessage[] {
  if (!raw || raw.length === 0) return []
  const result: v0_8.A2UIMessage[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    try {
      const parsed = JSON.parse(item) as v0_8.A2UIMessage
      result.push(parsed)
    } catch {
      // Skip malformed entries
    }
  }
  return result
}

function buildThinkingState(metadata: MessageMetadata): ThinkingState | null {
  if (!metadata.thinkingContent) return null
  return {
    content: metadata.thinkingContent,
    startedAt: AI_PARAMS.THINKING_HISTORICAL_STARTAT_MS,
    completedAt: metadata.thinkingDurationMs ?? AI_PARAMS.THINKING_HISTORICAL_STARTAT_MS,
  }
}

function buildToolExecutions(metadata: MessageMetadata): ToolExecutionState[] {
  if (metadata.toolCalls && metadata.toolCalls.length > 0) {
    return metadata.toolCalls.map((toolCall, index) => ({
      name: toolCall.name,
      input: toolCall.input,
      result: toolCall.result,
      completedAt: index + 1,
    }))
  }

  if (
    (!metadata.searchResults || metadata.searchResults.length === 0) &&
    (!metadata.searchImages || metadata.searchImages.length === 0)
  ) {
    return []
  }
  return [
    {
      name: TOOL_NAMES.WEB_SEARCH,
      input: { query: metadata.searchQuery ?? '' },
      result: {
        query: metadata.searchQuery ?? '',
        results: metadata.searchResults ?? [],
        images: metadata.searchImages ?? [],
      },
      completedAt: 1,
    },
  ]
}

export function HistoricalAssistantMessage({ message }: HistoricalAssistantMessageProps) {
  const shouldReduce = useReducedMotion()

  const parsed = useMemo(
    () => MessageMetadataSchema.safeParse(message.metadata),
    [message.metadata],
  )

  const metadata = parsed.success ? parsed.data : null

  const thinking = useMemo(() => (metadata ? buildThinkingState(metadata) : null), [metadata])

  const toolExecutions = useMemo(() => (metadata ? buildToolExecutions(metadata) : []), [metadata])

  const a2uiMessages = useMemo(() => parseA2UIMessages(metadata?.a2uiMessages), [metadata])

  const [activeBlock, setActiveBlock] = useState<ActiveBlock>(null)
  const toggleRouting = useCallback(
    () =>
      setActiveBlock((prev) =>
        prev === EXPANDABLE_BLOCKS.ROUTING ? null : EXPANDABLE_BLOCKS.ROUTING,
      ),
    [],
  )
  const toggleThinking = useCallback(
    () =>
      setActiveBlock((prev) =>
        prev === EXPANDABLE_BLOCKS.THINKING ? null : EXPANDABLE_BLOCKS.THINKING,
      ),
    [],
  )

  const modelLabel = metadata?.modelUsed ? extractModelName(metadata.modelUsed) : null
  const tokenLabel =
    metadata?.usage?.totalTokens && metadata.usage.totalTokens > 0
      ? `${metadata.usage.totalTokens.toLocaleString()} tokens`
      : null
  const costLabel =
    metadata?.usage?.cost && metadata.usage.cost > 0 ? formatCost(metadata.usage.cost) : null

  const hasRouting = metadata?.routerSource === MODEL_SELECTION_SOURCES.AUTO_ROUTER

  return (
    <motion.div {...(shouldReduce ? {} : fadeInUp)}>
      <AssistantFrame modelLabel={modelLabel} tokenLabel={tokenLabel} costLabel={costLabel}>
        <div className="space-y-3">
          {(hasRouting || thinking) && (
            <div className="flex flex-wrap items-start gap-2">
              {hasRouting && metadata && (
                <RoutingDecisionBlock
                  modelLabel={modelLabel ?? UI_TEXT.DEFAULT_MODEL_LABEL}
                  model={metadata.modelUsed}
                  category={metadata.routerCategory}
                  confidence={metadata.routerConfidence}
                  factors={metadata.routerFactors}
                  reasoning={metadata.routerReasoning}
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
            <div className="flex flex-col gap-2">
              {toolExecutions.map((execution, i) => (
                <ToolExecution key={i} execution={execution} />
              ))}
            </div>
          )}

          {message.content && <MarkdownRenderer content={message.content} autoCollapse />}

          {a2uiMessages.length > 0 && <A2UIMessage messages={a2uiMessages} />}

          {message.content && (
            <div className="flex items-center">
              <TTSControls content={message.content} />
            </div>
          )}
        </div>
      </AssistantFrame>
    </motion.div>
  )
}

'use client'

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp } from '@/lib/utils/motion'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { MessageMetadataSchema } from '@/schemas/message'
import { TOOL_NAMES, AI_PARAMS } from '@/config/constants'
import { AssistantFrame } from './assistant-frame'
import { extractModelName } from '@/lib/utils/model'
import type { Message, MessageMetadata } from '@/schemas/message'
import type { ThinkingState, ToolExecutionState } from '@/types/stream'
import type { v0_8 } from '@a2ui-sdk/types'

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

  const modelLabel = metadata?.modelUsed ? extractModelName(metadata.modelUsed) : null
  const tokenLabel =
    metadata?.usage?.totalTokens && metadata.usage.totalTokens > 0
      ? `${metadata.usage.totalTokens.toLocaleString()} tokens`
      : null

  return (
    <motion.div {...(shouldReduce ? {} : fadeInUp)}>
      <AssistantFrame modelLabel={modelLabel} tokenLabel={tokenLabel}>
        <div className="space-y-3">
          {thinking && <ThinkingBlock thinking={thinking} />}

          {toolExecutions.length > 0 && (
            <div className="flex flex-col gap-2">
              {toolExecutions.map((execution, i) => (
                <ToolExecution key={i} execution={execution} />
              ))}
            </div>
          )}

          {message.content && <MarkdownRenderer content={message.content} />}

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

'use client'

import { AI_PARAMS, MODEL_SELECTION_SOURCES, UI_TEXT } from '@/config/constants'
import { buildToolExecutions } from '@/features/chat/utils/build-tool-executions'
import { formatCost } from '@/lib/utils/format'
import { extractModelName } from '@/lib/utils/model'
import { fadeInUp } from '@/lib/utils/motion'
import type { Message, MessageMetadata } from '@/schemas/message'
import { MessageMetadataSchema } from '@/schemas/message'
import { trpc } from '@/trpc/provider'
import type { ThinkingState } from '@/types/stream'
import type { v0_8 } from '@a2ui-sdk/types'
import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { AssistantBody } from './assistant-body'
import { AssistantFrame } from './assistant-frame'

type HistoricalAssistantMessageProps = {
  message: Message
}

const LEGACY_COMPONENT_ALIASES: Record<string, string> = {
  text: 'Text',
  button: 'Button',
  card: 'Card',
  input: 'TextField',
  textfield: 'TextField',
  row: 'Row',
  column: 'Column',
  list: 'List',
  divider: 'Divider',
  code_block: 'CodeBlock',
  contact_form: 'Column',
  root: 'Column',
}

function normalizeComponentType(typeName: string): string {
  return LEGACY_COMPONENT_ALIASES[typeName.toLowerCase()] ?? typeName
}

function normalizeComponentEntry(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object') return entry
  const raw = entry as Record<string, unknown>
  const component = raw.component
  if (!component || typeof component !== 'object') return entry

  const normalizedComponent: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(component as Record<string, unknown>)) {
    const normalizedType = normalizeComponentType(key)
    normalizedComponent[normalizedType] = value
  }

  return { ...raw, component: normalizedComponent }
}

function normalizeA2UIMessage(message: v0_8.A2UIMessage): v0_8.A2UIMessage {
  const raw = message as unknown as Record<string, unknown>
  const surfaceUpdate = raw.surfaceUpdate
  if (!surfaceUpdate || typeof surfaceUpdate !== 'object') {
    return message
  }
  const surfaceUpdateRecord = surfaceUpdate as Record<string, unknown>
  const components = surfaceUpdateRecord.components
  if (!Array.isArray(components)) {
    return message
  }
  return {
    ...message,
    surfaceUpdate: {
      ...(surfaceUpdate as object),
      components: components.map(normalizeComponentEntry),
    },
  } as v0_8.A2UIMessage
}

function parseA2UIMessages(raw: unknown[] | undefined): v0_8.A2UIMessage[] {
  if (!raw || raw.length === 0) return []
  const result: v0_8.A2UIMessage[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    try {
      const parsed = JSON.parse(item) as v0_8.A2UIMessage
      result.push(normalizeA2UIMessage(parsed))
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

export function HistoricalAssistantMessage({ message }: HistoricalAssistantMessageProps) {
  const shouldReduce = useReducedMotion()
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()
  const a2uiPolicy = runtimeConfigQuery.data?.safety.a2ui

  const parsed = useMemo(
    () => MessageMetadataSchema.safeParse(message.metadata),
    [message.metadata],
  )

  const metadata = parsed.success ? parsed.data : null

  const thinking = useMemo(() => (metadata ? buildThinkingState(metadata) : null), [metadata])

  const toolExecutions = useMemo(() => (metadata ? buildToolExecutions(metadata) : []), [metadata])

  const a2uiMessages = useMemo(() => parseA2UIMessages(metadata?.a2uiMessages), [metadata])

  const a2uiRawLines = useMemo(() => {
    if (!metadata?.a2uiMessages) return []
    return metadata.a2uiMessages.filter((item): item is string => typeof item === 'string')
  }, [metadata])

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
        <AssistantBody
          routingDecision={
            hasRouting && metadata
              ? {
                  modelLabel: modelLabel ?? UI_TEXT.DEFAULT_MODEL_LABEL,
                  model: metadata.modelUsed,
                  category: metadata.routerCategory,
                  confidence: metadata.routerConfidence,
                  factors: metadata.routerFactors,
                  reasoning: metadata.routerReasoning,
                }
              : null
          }
          thinking={thinking}
          toolExecutions={toolExecutions}
          textContent={message.content ?? ''}
          a2uiMessages={a2uiMessages}
          a2uiRawLines={a2uiRawLines}
          a2uiPolicy={a2uiPolicy}
          autoCollapse
          messageId={message.id}
        />
      </AssistantFrame>
    </motion.div>
  )
}

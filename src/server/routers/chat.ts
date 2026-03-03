import {
  AI_MARKUP,
  LIMITS,
  MESSAGE_ROLES,
  NEW_CHAT_TITLE,
  RESPONSE_FORMATS,
  STREAM_EVENTS,
  STREAM_PHASES,
  TRPC_CODES,
} from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import { attachments, conversations, messages } from '@/lib/db/schema'
import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'
import { AppError, getErrorMessage } from '@/lib/utils/errors'
import type { StreamChunk, ToolCall, Usage } from '@/schemas/message'
import {
  CancelStreamInputSchema,
  ChatInputSchema,
  MessageMetadataSchema,
  UsageSchema,
} from '@/schemas/message'
import type { ModelCapability, ModelResponseFormat, ModelSelectionSource } from '@/schemas/model'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import type { SearchImage, SearchResult } from '@/schemas/search'
import { parseA2UIFencePayloadToJsonLines } from '@/server/services/a2ui-message-service'
import { resolveModelDecision } from '@/server/services/model-resolution-service'
import { executeSearchEnrichment } from '@/server/services/search-enrichment-service'
import type { ChatMessageContentItem, ChatMessageToolCall, Message } from '@openrouter/sdk/models'
import {
  ChatMessageContentItemImageType,
  ChatMessageContentItemTextType,
  ToolChoiceOptionAuto,
} from '@openrouter/sdk/models'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { protectedProcedure, rateLimitedChatProcedure, router } from '../trpc'

type StreamSession = {
  key: string
  userId: string
  conversationId: string
  streamRequestId: string
  abortController: AbortController
}

type StreamChunkPayload = {
  type: StreamChunk['type']
  [key: string]: unknown
}

const activeStreamsByConversation = new Map<string, StreamSession>()
const activeStreamsByRequest = new Map<string, StreamSession>()

function getConversationStreamKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`
}

function createChunkEmitter(streamRequestId: string, attempt: number, enforceSequence: boolean) {
  let sequence = 0
  return (payload: StreamChunkPayload): StreamChunk => {
    const base = {
      ...payload,
      streamRequestId,
      attempt,
    } as StreamChunk
    if (!enforceSequence) {
      return base
    }
    return {
      ...base,
      sequence: sequence++,
    }
  }
}

function beginStreamSession(params: {
  userId: string
  conversationId: string
  streamRequestId: string
}): StreamSession {
  const key = getConversationStreamKey(params.userId, params.conversationId)
  const existing = activeStreamsByConversation.get(key)

  if (existing && existing.streamRequestId === params.streamRequestId) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: 'Duplicate active stream request.',
    })
  }

  if (existing) {
    existing.abortController.abort('superseded_by_new_stream')
    endStreamSession(existing)
  }

  const session: StreamSession = {
    key,
    userId: params.userId,
    conversationId: params.conversationId,
    streamRequestId: params.streamRequestId,
    abortController: new AbortController(),
  }
  activeStreamsByConversation.set(key, session)
  activeStreamsByRequest.set(session.streamRequestId, session)
  return session
}

function endStreamSession(session: StreamSession): void {
  const activeForConversation = activeStreamsByConversation.get(session.key)
  if (activeForConversation?.streamRequestId === session.streamRequestId) {
    activeStreamsByConversation.delete(session.key)
  }
  const activeForRequest = activeStreamsByRequest.get(session.streamRequestId)
  if (activeForRequest?.key === session.key) {
    activeStreamsByRequest.delete(session.streamRequestId)
  }
}

function classifyTerminalError(
  runtimeConfig: RuntimeConfig,
  error: unknown,
): {
  message: string
  code?: string
  reasonCode: string
  recoverable: boolean
} {
  if (error instanceof TRPCError) {
    if (error.code === TRPC_CODES.UNAUTHORIZED || error.code === TRPC_CODES.FORBIDDEN) {
      return {
        message: runtimeConfig.chat.errors.unauthorized,
        code: error.code,
        reasonCode: 'authorization_expired',
        recoverable: false,
      }
    }
    if (error.code === TRPC_CODES.BAD_REQUEST) {
      const invalidModel = error.message === AppError.INVALID_MODEL
      const routerFailed = error.message === AppError.ROUTER_FAILED
      return {
        message: routerFailed
          ? AppError.ROUTER_FAILED
          : invalidModel
            ? runtimeConfig.chat.errors.invalidModel
            : runtimeConfig.chat.errors.processing,
        code: error.code,
        reasonCode: routerFailed ? 'router_failed' : 'validation_rejected',
        recoverable: routerFailed,
      }
    }
    return {
      message: runtimeConfig.chat.errors.processing,
      code: error.code,
      reasonCode: 'provider_unavailable',
      recoverable: true,
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('abort') || message.includes('timeout')) {
      return {
        message: runtimeConfig.chat.errors.connection,
        code: error.name,
        reasonCode: 'transient_network',
        recoverable: true,
      }
    }
  }

  return {
    message: runtimeConfig.chat.errors.providerUnavailable,
    reasonCode: 'provider_unavailable',
    recoverable: true,
  }
}

function buildCombinedAbortSignal(signals: AbortSignal[], timeoutMs: number): AbortSignal {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const subscriptions: Array<() => void> = []
  for (const candidate of signals) {
    if (candidate.aborted) {
      clearTimeout(timeoutId)
      controller.abort()
      break
    }
    const onAbort = () => controller.abort()
    candidate.addEventListener('abort', onAbort, { once: true })
    subscriptions.push(() => candidate.removeEventListener('abort', onAbort))
  }

  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeoutId)
      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }
    },
    { once: true },
  )

  return controller.signal
}

function parseSearchToolQuery(rawArguments: string, fallbackQuery: string): string {
  try {
    const parsed = JSON.parse(rawArguments) as { query?: unknown }
    if (typeof parsed.query === 'string' && parsed.query.trim().length > 0) {
      return parsed.query
    }
  } catch {
    // If arguments are malformed, use the user prompt as the safest fallback.
  }
  return fallbackQuery
}

function mergeSearchResults(existing: SearchResult[], incoming: SearchResult[]): SearchResult[] {
  const byUrl = new Map<string, SearchResult>()
  for (const result of existing) {
    byUrl.set(result.url, result)
  }
  for (const result of incoming) {
    byUrl.set(result.url, result)
  }
  return [...byUrl.values()]
}

function mergeSearchImages(existing: SearchImage[], incoming: SearchImage[]): SearchImage[] {
  const byUrl = new Map<string, SearchImage>()
  for (const image of existing) {
    byUrl.set(image.url, image)
  }
  for (const image of incoming) {
    byUrl.set(image.url, image)
  }
  return [...byUrl.values()]
}

export const chatRouter = router({
  stream: rateLimitedChatProcedure.input(ChatInputSchema).subscription(async function* ({
    ctx,
    input,
    signal,
  }) {
    const runtimeConfig = ctx.runtimeConfig
    const streamRequestId = input.clientRequestId ?? crypto.randomUUID()
    const emit = createChunkEmitter(streamRequestId, 0, runtimeConfig.chat.stream.enforceSequence)

    let conversationId = input.conversationId
    let userMessageId: string | null = null
    let streamSession: StreamSession | null = null

    try {
      if (input.content.length > runtimeConfig.limits.messageMaxLength) {
        throw new TRPCError({ code: TRPC_CODES.BAD_REQUEST, message: AppError.INVALID_INPUT })
      }

      if (!conversationId) {
        const [created] = await ctx.db
          .insert(conversations)
          .values({
            userId: ctx.userId,
            model: input.model,
            mode: input.mode,
            webSearchEnabled: input.webSearchEnabled,
          })
          .returning({ id: conversations.id })
        if (!created) {
          throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
        }
        conversationId = created.id
        yield emit({ type: STREAM_EVENTS.CONVERSATION_CREATED, conversationId: created.id })
      }

      const [conversation] = await ctx.db
        .select({ id: conversations.id, title: conversations.title })
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))
        .limit(1)
      if (!conversation) {
        throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
      }

      streamSession = beginStreamSession({
        userId: ctx.userId,
        conversationId,
        streamRequestId,
      })
      const combinedSignal = buildCombinedAbortSignal(
        signal
          ? [signal, streamSession.abortController.signal]
          : [streamSession.abortController.signal],
        runtimeConfig.chat.stream.timeoutMs,
      )

      if (input.webSearchEnabled && !runtimeConfig.features.searchEnabled) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: AppError.SEARCH_UNAVAILABLE,
        })
      }

      const [existingUserMessage] = await ctx.db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.role, MESSAGE_ROLES.USER),
            eq(messages.clientRequestId, streamRequestId),
          ),
        )
        .limit(1)

      if (existingUserMessage) {
        userMessageId = existingUserMessage.id
      } else {
        const [createdUserMessage] = await ctx.db
          .insert(messages)
          .values({
            conversationId,
            role: MESSAGE_ROLES.USER,
            content: input.content,
            clientRequestId: streamRequestId,
          })
          .returning({ id: messages.id })
        if (!createdUserMessage) {
          throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
        }
        userMessageId = createdUserMessage.id
      }

      yield emit({
        type: STREAM_EVENTS.USER_MESSAGE_SAVED,
        messageId: userMessageId,
      })

      if (input.attachmentIds.length > 0 && userMessageId) {
        const linked = await ctx.db
          .update(attachments)
          .set({ messageId: userMessageId })
          .where(
            and(
              inArray(attachments.id, input.attachmentIds),
              eq(attachments.userId, ctx.userId),
              isNotNull(attachments.confirmedAt),
            ),
          )
          .returning({ id: attachments.id })

        if (linked.length !== input.attachmentIds.length) {
          throw new TRPCError({
            code: TRPC_CODES.FORBIDDEN,
            message: AppError.ATTACHMENT_ACCESS_DENIED,
          })
        }
      }

      let selectedModel: string | undefined
      let conversationMode = input.mode
      let routerReasoning: string | undefined
      let routerSource: ModelSelectionSource | undefined
      let routerCategory: ModelCapability | undefined
      let routerResponseFormat: ModelResponseFormat | undefined
      let routerConfidence: number | undefined
      let routerFactors:
        | Array<{
            key: string
            label: string
            value: string
          }>
        | undefined
      const webSearchEnabled = input.webSearchEnabled
      const { getModelRegistry } = await import('@/lib/ai/registry')
      const registry = await getModelRegistry({ runtimeConfig })

      if (!input.model) {
        yield emit({
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.ROUTING,
          message: runtimeConfig.chat.statusMessages.routing,
        })
      }

      const routerSignal = AbortSignal.timeout(LIMITS.ROUTER_TIMEOUT_MS)
      const routerCombined = AbortSignal.any([combinedSignal, routerSignal])

      const resolvedDecision = await resolveModelDecision({
        dbClient: ctx.db,
        userId: ctx.userId,
        conversationId,
        requestedModel: input.model,
        requestedMode: input.mode,
        requestedWebSearchEnabled: input.webSearchEnabled,
        prompt: input.content,
        registry,
        runtimeConfig,
        signal: routerCombined,
      })

      selectedModel = resolvedDecision.selectedModel
      conversationMode = resolvedDecision.requestedMode
      routerReasoning = resolvedDecision.reasoning
      routerSource = resolvedDecision.source
      routerCategory = resolvedDecision.category
      routerResponseFormat = resolvedDecision.responseFormat
      routerConfidence = resolvedDecision.confidence
      routerFactors = resolvedDecision.factors

      yield emit({
        type: STREAM_EVENTS.MODEL_SELECTED,
        model: selectedModel,
        reasoning: resolvedDecision.reasoning,
        source: resolvedDecision.source,
        category: resolvedDecision.category,
        responseFormat: resolvedDecision.responseFormat,
        confidence: resolvedDecision.confidence,
        factors: resolvedDecision.factors,
      })

      if (!selectedModel) {
        throw new TRPCError({
          code: TRPC_CODES.INTERNAL_SERVER_ERROR,
          message: AppError.INVALID_MODEL,
        })
      }

      await ctx.db
        .update(conversations)
        .set({
          model: resolvedDecision.source === 'auto_router' ? null : selectedModel,
          mode: conversationMode,
          webSearchEnabled: input.webSearchEnabled,
          updatedAt: new Date(),
        })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))

      const wrappedContent = `${runtimeConfig.prompts.wrappers.userRequestOpen}\n${input.content}\n${runtimeConfig.prompts.wrappers.userRequestClose}`
      let userContent: string | ChatMessageContentItem[] = wrappedContent
      const hasAttachments = input.attachmentIds.length > 0
      if (hasAttachments) {
        yield emit({
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.READING_FILES,
          message: runtimeConfig.chat.statusMessages.readingFiles,
        })

        const blocks: ChatMessageContentItem[] = [
          { type: ChatMessageContentItemTextType.Text, text: wrappedContent },
        ]

        const attachmentRows = await ctx.db
          .select()
          .from(attachments)
          .where(
            and(
              inArray(attachments.id, input.attachmentIds),
              eq(attachments.userId, ctx.userId),
              isNotNull(attachments.confirmedAt),
            ),
          )
        for (const attachment of attachmentRows) {
          if (attachment.fileType.startsWith('image/')) {
            blocks.push({
              type: ChatMessageContentItemImageType.ImageUrl,
              imageUrl: { url: attachment.storageUrl },
            })
          } else {
            blocks.push({
              type: ChatMessageContentItemTextType.Text,
              text: `[Attachment: ${escapeXmlForPrompt(attachment.fileName)} — ${escapeXmlForPrompt(attachment.fileType)}]`,
            })
          }
        }

        userContent = blocks
      }

      const searchToolName = runtimeConfig.search.toolName
      const toolCalls: ToolCall[] = []
      let searchContext = ''
      let searchResults: SearchResult[] = []
      let searchImages: SearchImage[] = []

      if (webSearchEnabled) {
        if (!runtimeConfig.features.searchEnabled) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: AppError.SEARCH_UNAVAILABLE,
          })
        }

        yield emit({
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.SEARCHING,
          message: runtimeConfig.chat.statusMessages.searching,
        })
        yield emit({
          type: STREAM_EVENTS.TOOL_START,
          toolName: searchToolName,
          input: { query: input.content },
        })

        const startedAt = Date.now()
        const enrichment = await executeSearchEnrichment(input.content, runtimeConfig)
        searchResults = enrichment.results
        searchImages = enrichment.images

        yield emit({
          type: STREAM_EVENTS.TOOL_RESULT,
          toolName: searchToolName,
          result: {
            query: enrichment.query,
            results: enrichment.results,
            images: enrichment.images,
          },
        })
        toolCalls.push({
          name: searchToolName,
          input: { query: input.content },
          result: {
            query: enrichment.query,
            results: enrichment.results,
            images: enrichment.images,
          },
          durationMs: Date.now() - startedAt,
        })
        searchContext = enrichment.context
      }

      const systemSections = [PROMPTS.CHAT_SYSTEM_PROMPT, runtimeConfig.prompts.chatSystem]
      if (runtimeConfig.features.a2uiEnabled) {
        systemSections.push(PROMPTS.A2UI_SYSTEM_PROMPT)
        systemSections.push(runtimeConfig.prompts.a2uiSystem)
        if (routerResponseFormat === RESPONSE_FORMATS.A2UI) {
          systemSections.push(
            `Response format policy: For this request, provide a concise explanation followed by valid A2UI JSONL inside an \`${RESPONSE_FORMATS.A2UI}\` fenced block.`,
          )
        }
      }
      if (searchContext) {
        systemSections.push(searchContext)
      }

      const historyRows = await ctx.db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            or(eq(messages.role, MESSAGE_ROLES.USER), eq(messages.role, MESSAGE_ROLES.ASSISTANT)),
          ),
        )
        .orderBy(asc(messages.createdAt))
        .limit(LIMITS.CONVERSATION_HISTORY_LIMIT)

      const historyMessages: Message[] = historyRows.map((row) => ({
        role: row.role,
        content: row.content,
      }))

      const sdkMessages: Message[] = [
        { role: MESSAGE_ROLES.SYSTEM, content: systemSections.join('\n\n') },
        ...historyMessages,
        { role: MESSAGE_ROLES.USER, content: userContent },
      ]

      const { openrouter } = await import('@/lib/ai/client')
      const { ALL_TOOLS } = await import('@/lib/ai/tools')

      let fullText = ''
      let thinkingContent = ''
      let thinkingStartedAt: number | null = null
      let thinkingDurationMs: number | undefined
      let a2uiLines: string[] = []
      let inA2UI = false
      let a2uiBuffer = ''
      let usage: Usage | undefined
      let streamSequenceMax = 0
      let thinkingStatusEmitted = false

      const emitA2UIFromPayload = (payload: string): StreamChunk[] => {
        const parsedLines = parseA2UIFencePayloadToJsonLines(payload, runtimeConfig.safety.a2ui)
        const events: StreamChunk[] = []
        for (const line of parsedLines) {
          a2uiLines.push(line)
          const a2uiEvent = emit({
            type: STREAM_EVENTS.A2UI,
            jsonl: line,
          })
          if (typeof a2uiEvent.sequence === 'number') {
            streamSequenceMax = Math.max(streamSequenceMax, a2uiEvent.sequence)
          }
          events.push(a2uiEvent)
        }
        return events
      }

      let toolRoundCount = 0
      while (true) {
        const stream = await openrouter.chat.send(
          {
            chatGenerationParams: {
              model: selectedModel,
              messages: sdkMessages,
              stream: true,
              maxTokens: runtimeConfig.ai.chatMaxTokens,
              ...(webSearchEnabled
                ? { tools: ALL_TOOLS, toolChoice: ToolChoiceOptionAuto.Auto }
                : {}),
            },
          },
          { signal: combinedSignal },
        )

        const toolCallDeltas = new Map<number, { id?: string; name?: string; argsJson: string }>()
        let roundAssistantText = ''

        for await (const streamChunk of stream) {
          if (streamChunk.usage) {
            const parsedUsage = UsageSchema.safeParse({
              promptTokens: streamChunk.usage.promptTokens ?? 0,
              completionTokens: streamChunk.usage.completionTokens ?? 0,
              totalTokens: streamChunk.usage.totalTokens ?? 0,
            })
            if (parsedUsage.success) {
              usage = parsedUsage.data
            }
          }

          const delta = streamChunk.choices[0]?.delta
          if (!delta) continue

          if (delta.toolCalls && delta.toolCalls.length > 0) {
            for (const toolCallDelta of delta.toolCalls) {
              const current = toolCallDeltas.get(toolCallDelta.index) ?? { argsJson: '' }
              if (toolCallDelta.id) {
                current.id = toolCallDelta.id
              }
              if (toolCallDelta.function?.name) {
                current.name = toolCallDelta.function.name
              }
              if (toolCallDelta.function?.arguments) {
                current.argsJson += toolCallDelta.function.arguments
              }
              toolCallDeltas.set(toolCallDelta.index, current)
            }
          }

          if (delta.reasoning) {
            if (!thinkingStatusEmitted) {
              const thinkingStatusEvent = emit({
                type: STREAM_EVENTS.STATUS,
                phase: STREAM_PHASES.THINKING,
                message: runtimeConfig.chat.statusMessages.thinking,
              })
              if (typeof thinkingStatusEvent.sequence === 'number') {
                streamSequenceMax = Math.max(streamSequenceMax, thinkingStatusEvent.sequence)
              }
              yield thinkingStatusEvent
              thinkingStatusEmitted = true
            }
            if (!thinkingStartedAt) thinkingStartedAt = Date.now()
            thinkingContent += delta.reasoning
            const thinkingEvent = emit({
              type: STREAM_EVENTS.THINKING,
              content: delta.reasoning,
              isComplete: false,
            })
            if (typeof thinkingEvent.sequence === 'number') {
              streamSequenceMax = Math.max(streamSequenceMax, thinkingEvent.sequence)
            }
            yield thinkingEvent
            continue
          }

          if (!delta.content) continue

          let remaining = delta.content
          while (remaining.length > 0) {
            if (!inA2UI) {
              const fenceStartIndex = remaining.indexOf(AI_MARKUP.A2UI_FENCE_START)
              if (fenceStartIndex < 0) {
                roundAssistantText += remaining
                fullText += remaining
                const textEvent = emit({
                  type: STREAM_EVENTS.TEXT,
                  content: remaining,
                })
                if (typeof textEvent.sequence === 'number') {
                  streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
                }
                yield textEvent
                remaining = ''
                continue
              }

              const visiblePrefix = remaining.slice(0, fenceStartIndex)
              if (visiblePrefix.length > 0) {
                roundAssistantText += visiblePrefix
                fullText += visiblePrefix
                const textEvent = emit({
                  type: STREAM_EVENTS.TEXT,
                  content: visiblePrefix,
                })
                if (typeof textEvent.sequence === 'number') {
                  streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
                }
                yield textEvent
              }

              remaining = remaining.slice(fenceStartIndex + AI_MARKUP.A2UI_FENCE_START.length)
              inA2UI = true
              a2uiBuffer = ''
              const generatingUiEvent = emit({
                type: STREAM_EVENTS.STATUS,
                phase: STREAM_PHASES.GENERATING_UI,
                message: runtimeConfig.chat.statusMessages.generatingUi,
              })
              if (typeof generatingUiEvent.sequence === 'number') {
                streamSequenceMax = Math.max(streamSequenceMax, generatingUiEvent.sequence)
              }
              yield generatingUiEvent
              continue
            }

            const fenceEndIndex = remaining.indexOf(AI_MARKUP.CODE_FENCE_END)
            if (fenceEndIndex < 0) {
              a2uiBuffer += remaining
              remaining = ''
              continue
            }

            a2uiBuffer += remaining.slice(0, fenceEndIndex)
            const a2uiEvents = emitA2UIFromPayload(a2uiBuffer)
            for (const a2uiEvent of a2uiEvents) {
              yield a2uiEvent
            }
            a2uiBuffer = ''
            inA2UI = false
            remaining = remaining.slice(fenceEndIndex + AI_MARKUP.CODE_FENCE_END.length)
          }
        }

        if (inA2UI && a2uiBuffer.trim().length > 0) {
          const a2uiEvents = emitA2UIFromPayload(a2uiBuffer)
          for (const a2uiEvent of a2uiEvents) {
            yield a2uiEvent
          }
          inA2UI = false
          a2uiBuffer = ''
        }

        if (toolCallDeltas.size === 0) {
          break
        }

        if (toolRoundCount >= LIMITS.SEARCH_MAX_TOOL_CALL_ROUNDS) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: runtimeConfig.chat.errors.processing,
          })
        }

        const roundToolCalls: ChatMessageToolCall[] = [...toolCallDeltas.entries()]
          .sort(([a], [b]) => a - b)
          .map(([index, value]) => ({
            id: value.id ?? `tool_${index}_${crypto.randomUUID()}`,
            type: 'function' as const,
            function: {
              name: value.name ?? '',
              arguments: value.argsJson,
            },
          }))
          .filter((call) => call.function.name.length > 0)

        if (roundToolCalls.length === 0) {
          break
        }

        sdkMessages.push({
          role: MESSAGE_ROLES.ASSISTANT,
          content: roundAssistantText,
          toolCalls: roundToolCalls,
        })

        for (const call of roundToolCalls) {
          if (call.function.name !== searchToolName) {
            sdkMessages.push({
              role: 'tool',
              toolCallId: call.id,
              content: JSON.stringify({ error: 'Unsupported tool call' }),
            })
            continue
          }

          const toolQuery = parseSearchToolQuery(call.function.arguments, input.content)
          const startedAt = Date.now()
          yield emit({
            type: STREAM_EVENTS.TOOL_START,
            toolName: searchToolName,
            input: { query: toolQuery },
          })
          const enrichment = await executeSearchEnrichment(toolQuery, runtimeConfig)
          searchResults = mergeSearchResults(searchResults, enrichment.results)
          searchImages = mergeSearchImages(searchImages, enrichment.images)
          yield emit({
            type: STREAM_EVENTS.TOOL_RESULT,
            toolName: searchToolName,
            result: {
              query: enrichment.query,
              results: enrichment.results,
              images: enrichment.images,
            },
          })

          toolCalls.push({
            name: searchToolName,
            input: { query: toolQuery },
            result: {
              query: enrichment.query,
              results: enrichment.results,
              images: enrichment.images,
            },
            durationMs: Date.now() - startedAt,
          })

          sdkMessages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify({
              query: enrichment.query,
              results: enrichment.results,
              images: enrichment.images,
            }),
          })
        }

        toolRoundCount += 1
      }

      if (thinkingContent) {
        thinkingDurationMs = thinkingStartedAt ? Date.now() - thinkingStartedAt : undefined
        const thinkingCompleteEvent = emit({
          type: STREAM_EVENTS.THINKING,
          content: '',
          isComplete: true,
        })
        if (typeof thinkingCompleteEvent.sequence === 'number') {
          streamSequenceMax = Math.max(streamSequenceMax, thinkingCompleteEvent.sequence)
        }
        yield thinkingCompleteEvent
      }

      const hasVisibleAssistantOutput = fullText.trim().length > 0 || a2uiLines.length > 0
      if (!hasVisibleAssistantOutput) {
        throw new TRPCError({
          code: TRPC_CODES.INTERNAL_SERVER_ERROR,
          message: runtimeConfig.chat.errors.processing,
        })
      }

      const modelEntry = selectedModel ? registry.find((m) => m.id === selectedModel) : undefined
      const estimatedCost =
        modelEntry && usage
          ? (usage.promptTokens * modelEntry.pricing.promptPerMillion +
              usage.completionTokens * modelEntry.pricing.completionPerMillion) /
            1_000_000
          : undefined
      const usageWithCost = usage ? { ...usage, cost: estimatedCost } : undefined

      const metadata = MessageMetadataSchema.parse({
        streamRequestId,
        modelUsed: selectedModel,
        routerReasoning,
        routerSource,
        routerCategory,
        routerResponseFormat,
        routerConfidence,
        routerFactors,
        requiresSearch: webSearchEnabled,
        thinkingContent: thinkingContent || undefined,
        thinkingDurationMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        searchQuery: webSearchEnabled ? input.content : undefined,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        searchImages: searchImages.length > 0 ? searchImages : undefined,
        a2uiMessages: a2uiLines.length > 0 ? a2uiLines : undefined,
        usage: usageWithCost,
        userMessageId: userMessageId ?? undefined,
      })

      const [existingAssistantMessage] = await ctx.db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.role, MESSAGE_ROLES.ASSISTANT),
            eq(messages.clientRequestId, streamRequestId),
          ),
        )
        .limit(1)

      if (existingAssistantMessage) {
        await ctx.db
          .update(messages)
          .set({
            content: fullText,
            metadata,
            streamSequenceMax,
            tokenCount: usage?.totalTokens ?? null,
          })
          .where(eq(messages.id, existingAssistantMessage.id))
      } else {
        await ctx.db.insert(messages).values({
          conversationId,
          role: MESSAGE_ROLES.ASSISTANT,
          content: fullText,
          metadata,
          clientRequestId: streamRequestId,
          streamSequenceMax,
          tokenCount: usage?.totalTokens ?? null,
        })
      }

      await ctx.db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))

      const shouldGenerateTitle = conversation.title === NEW_CHAT_TITLE

      if (shouldGenerateTitle) {
        const [firstAssistantMessage] = await ctx.db
          .select({ metadata: messages.metadata })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conversationId),
              eq(messages.role, MESSAGE_ROLES.ASSISTANT),
              sql`length(trim(${messages.content})) > 0`,
            ),
          )
          .orderBy(asc(messages.createdAt), asc(messages.id))
          .limit(1)

        const parsedFirstAssistantMetadata = MessageMetadataSchema.safeParse(
          firstAssistantMessage?.metadata,
        )
        const firstUserMessageId = parsedFirstAssistantMetadata.success
          ? parsedFirstAssistantMetadata.data.userMessageId
          : undefined

        let titleSeedMessage = input.content
        if (firstUserMessageId) {
          const [seedUserMessage] = await ctx.db
            .select({ content: messages.content })
            .from(messages)
            .where(
              and(
                eq(messages.id, firstUserMessageId),
                eq(messages.conversationId, conversationId),
                eq(messages.role, MESSAGE_ROLES.USER),
              ),
            )
            .limit(1)

          const candidate = seedUserMessage?.content?.trim()
          if (candidate) {
            titleSeedMessage = candidate
          }
        }

        if (titleSeedMessage.trim()) {
          const generatingTitleEvent = emit({
            type: STREAM_EVENTS.STATUS,
            phase: STREAM_PHASES.GENERATING_TITLE,
            message: runtimeConfig.chat.statusMessages.generatingTitle,
          })
          if (typeof generatingTitleEvent.sequence === 'number') {
            streamSequenceMax = Math.max(streamSequenceMax, generatingTitleEvent.sequence)
          }
          yield generatingTitleEvent

          try {
            const { generateTitle } = await import('@/lib/ai/title')
            const generatedTitle = await generateTitle(titleSeedMessage, runtimeConfig)
            const safeTitle = generatedTitle
              .trim()
              .slice(0, runtimeConfig.limits.conversationTitleMaxLength)
            if (safeTitle) {
              await ctx.db
                .update(conversations)
                .set({ title: safeTitle, updatedAt: new Date() })
                .where(
                  and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)),
                )
            }
          } catch (titleError) {
            console.error('[title-gen] generateTitle failed:', getErrorMessage(titleError))
          }
        }
      }

      const doneEvent = emit({
        type: STREAM_EVENTS.DONE,
        usage,
        terminalReason: 'done',
      })
      if (typeof doneEvent.sequence === 'number') {
        streamSequenceMax = Math.max(streamSequenceMax, doneEvent.sequence)
      }
      yield doneEvent
    } catch (error) {
      const terminal = classifyTerminalError(runtimeConfig, error)
      yield emit({
        type: STREAM_EVENTS.ERROR,
        message: terminal.message,
        code: terminal.code,
        reasonCode: terminal.reasonCode,
        recoverable: terminal.recoverable,
      })
    } finally {
      if (streamSession) {
        endStreamSession(streamSession)
      }
    }
  }),

  cancel: protectedProcedure.input(CancelStreamInputSchema).mutation(async ({ ctx, input }) => {
    const key = getConversationStreamKey(ctx.userId, input.conversationId)
    const active = activeStreamsByConversation.get(key)
    if (!active) {
      return { cancelled: false }
    }
    if (input.streamRequestId && active.streamRequestId !== input.streamRequestId) {
      return { cancelled: false }
    }
    active.abortController.abort('cancelled_by_client')
    endStreamSession(active)
    return { cancelled: true }
  }),
})

import {
  AI_MARKUP,
  AI_PARAMS,
  LIMITS,
  MESSAGE_ROLES,
  NEW_CHAT_TITLE,
  RESPONSE_FORMATS,
  MODEL_SELECTION_SOURCES,
  STREAM_EVENTS,
  STREAM_PHASES,
  STREAM_REASON_CODES,
  TRPC_CODES,
} from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import { attachments, conversations, messages } from '@/lib/db/schema'
import type { AttachmentRow } from '@/server/services/history-builder'
import { AppError, getErrorMessage } from '@/lib/utils/errors'
import type { StreamChunk, ToolCall, Usage } from '@/schemas/message'
import {
  CancelStreamInputSchema,
  ChatInputSchema,
  MessageMetadataSchema,
  UsageSchema,
} from '@/schemas/message'
import type { ModelCapability, ModelResponseFormat, ModelSelectionSource } from '@/schemas/model'
import type { RuntimeA2UIPolicy, RuntimeConfig } from '@/schemas/runtime-config'
import type { SearchImage, SearchResult } from '@/schemas/search'
import {
  buildComponentTypeFeedback,
  parseA2UIFencePayloadToJsonLines,
  validateA2UIComponentTypes,
} from '@/server/services/a2ui-message-service'
import { resolveModelDecision } from '@/server/services/model-resolution-service'
import { executeSearchEnrichment } from '@/server/services/search-enrichment-service'
import {
  mergeSearchImages,
  mergeSearchResults,
  parseSearchToolQuery,
} from '@/server/services/search-tool-service'
import type { ChatMessageToolCall, Message } from '@openrouter/sdk/models'
import { ToolChoiceOptionAuto } from '@openrouter/sdk/models'
import { TRPCError } from '@trpc/server'
import { and, desc, eq, sql } from 'drizzle-orm'
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
  const byRequest = activeStreamsByRequest.get(params.streamRequestId)
  if (byRequest && byRequest.userId === params.userId) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: 'Duplicate active stream request.',
    })
  }

  const key = getConversationStreamKey(params.userId, params.conversationId)
  const existing = activeStreamsByConversation.get(key)

  if (existing && existing.streamRequestId === params.streamRequestId) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: 'Duplicate active stream request.',
    })
  }

  if (existing) {
    existing.abortController.abort(STREAM_REASON_CODES.SUPERSEDED)
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
        reasonCode: STREAM_REASON_CODES.AUTHORIZATION_EXPIRED,
        recoverable: false,
      }
    }
    if (error.code === TRPC_CODES.BAD_REQUEST) {
      const invalidModel = error.message === AppError.INVALID_MODEL
      const routerFailed = error.message === AppError.ROUTER_FAILED
      const a2uiContractFailed = error.message === AppError.A2UI_CONTRACT_FAILED
      const imageGenIncompatible = error.message === AppError.IMAGE_GEN_INCOMPATIBLE
      const imageGenEmptyResult = error.message === AppError.IMAGE_GEN_EMPTY_RESULT
      return {
        message: routerFailed
          ? AppError.ROUTER_FAILED
          : a2uiContractFailed
            ? AppError.A2UI_CONTRACT_FAILED
            : imageGenIncompatible
              ? runtimeConfig.chat.errors.imageGenIncompatible
              : imageGenEmptyResult
                ? runtimeConfig.chat.errors.processing
                : invalidModel
                  ? runtimeConfig.chat.errors.invalidModel
                  : runtimeConfig.chat.errors.processing,
        code: error.code,
        reasonCode: routerFailed
          ? STREAM_REASON_CODES.ROUTER_FAILED
          : a2uiContractFailed
            ? STREAM_REASON_CODES.A2UI_CONTRACT_VIOLATION
            : imageGenIncompatible
              ? STREAM_REASON_CODES.IMAGE_GEN_INCOMPATIBLE
              : imageGenEmptyResult
                ? STREAM_REASON_CODES.IMAGE_GEN_EMPTY_RESULT
                : STREAM_REASON_CODES.VALIDATION_REJECTED,
        recoverable:
          routerFailed || a2uiContractFailed || imageGenIncompatible || imageGenEmptyResult,
      }
    }
    return {
      message: runtimeConfig.chat.errors.processing,
      code: error.code,
      reasonCode: STREAM_REASON_CODES.PROVIDER_UNAVAILABLE,
      recoverable: true,
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('abort') || message.includes('timeout')) {
      return {
        message: runtimeConfig.chat.errors.connection,
        code: error.name,
        reasonCode: STREAM_REASON_CODES.TRANSIENT_NETWORK,
        recoverable: true,
      }
    }
  }

  return {
    message: runtimeConfig.chat.errors.providerUnavailable,
    reasonCode: STREAM_REASON_CODES.PROVIDER_UNAVAILABLE,
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

function findA2UIFenceStart(source: string): { index: number; length: number } | null {
  const match = new RegExp(`\\\`\\\`\\\`[ \\t]*${RESPONSE_FORMATS.A2UI}\\b`, 'i').exec(source)
  if (!match || typeof match.index !== 'number') {
    return null
  }
  return {
    index: match.index,
    length: match[0].length,
  }
}

function extractA2UILinesFromAnyCodeFence(
  source: string,
  policy: RuntimeA2UIPolicy,
): { lines: string[]; strippedText: string } {
  const fencePattern = /```[^\n`]*\n?([\s\S]*?)```/g
  let stripped = ''
  let cursor = 0
  const lines: string[] = []
  let match: RegExpExecArray | null = null

  while ((match = fencePattern.exec(source)) !== null) {
    const blockStart = match.index
    const blockEnd = blockStart + match[0].length
    const payload = match[1] ?? ''

    stripped += source.slice(cursor, blockStart)
    const parsed = parseA2UIFencePayloadToJsonLines(payload, policy)
    if (parsed.length > 0) {
      lines.push(...parsed)
    } else {
      stripped += match[0]
    }
    cursor = blockEnd
  }

  stripped += source.slice(cursor)
  return { lines, strippedText: stripped }
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
        const [existingRequestConversation] = await ctx.db
          .select({ conversationId: messages.conversationId })
          .from(messages)
          .innerJoin(
            conversations,
            and(
              eq(conversations.id, messages.conversationId),
              eq(conversations.userId, ctx.userId),
            ),
          )
          .where(
            and(
              eq(messages.clientRequestId, streamRequestId),
              eq(messages.role, MESSAGE_ROLES.USER),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1)

        if (existingRequestConversation) {
          conversationId = existingRequestConversation.conversationId
        } else {
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
        }
      }

      if (!input.conversationId && conversationId) {
        yield emit({ type: STREAM_EVENTS.CONVERSATION_CREATED, conversationId })
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

      let linkedAttachmentRows: AttachmentRow[] = []
      if (input.attachmentIds.length > 0 && userMessageId) {
        const { linkAttachmentsToMessage } = await import('@/server/services/history-builder')
        linkedAttachmentRows = await linkAttachmentsToMessage(
          ctx.db,
          ctx.userId,
          input.attachmentIds,
          userMessageId,
        )
      }

      const userMessageAttachments =
        userMessageId && linkedAttachmentRows.length === 0
          ? await ctx.db
              .select({
                id: attachments.id,
                fileName: attachments.fileName,
                fileType: attachments.fileType,
                fileSize: attachments.fileSize,
                storageUrl: attachments.storageUrl,
              })
              .from(attachments)
              .where(
                and(eq(attachments.messageId, userMessageId), eq(attachments.userId, ctx.userId)),
              )
          : linkedAttachmentRows.map((att) => ({
              id: att.id,
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
              storageUrl: att.storageUrl,
            }))

      yield emit({
        type: STREAM_EVENTS.USER_MESSAGE_SAVED,
        messageId: userMessageId,
        attachments: userMessageAttachments,
      })

      const [existingAssistantMessageForTurn] = await ctx.db
        .select({
          id: messages.id,
          content: messages.content,
          metadata: messages.metadata,
          tokenCount: messages.tokenCount,
        })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.role, MESSAGE_ROLES.ASSISTANT),
            eq(messages.clientRequestId, streamRequestId),
          ),
        )
        .limit(1)

      if (existingAssistantMessageForTurn) {
        if (existingAssistantMessageForTurn.content.trim().length > 0) {
          yield emit({
            type: STREAM_EVENTS.TEXT_SET,
            content: existingAssistantMessageForTurn.content,
          })
        }

        const parsedExistingMetadata = MessageMetadataSchema.safeParse(
          existingAssistantMessageForTurn.metadata,
        )
        if (parsedExistingMetadata.success && parsedExistingMetadata.data.a2uiMessages) {
          for (const line of parsedExistingMetadata.data.a2uiMessages) {
            if (typeof line !== 'string') continue
            yield emit({
              type: STREAM_EVENTS.A2UI,
              jsonl: line,
            })
          }
        }

        yield emit({
          type: STREAM_EVENTS.DONE,
          usage: parsedExistingMetadata.success ? parsedExistingMetadata.data.usage : undefined,
          terminalReason: 'done',
        })
        return
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
      const { getModelRegistry, getModelMaxCompletionTokens } = await import('@/lib/ai/registry')
      const registry = await getModelRegistry({ runtimeConfig })

      if (!input.model) {
        yield emit({
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.ROUTING,
          message: runtimeConfig.chat.statusMessages.routing,
        })
      }

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
        signal: combinedSignal,
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

      const isImageGenModel =
        registry.find((m) => m.id === selectedModel)?.supportsImageGeneration ?? false

      await ctx.db
        .update(conversations)
        .set({
          model:
            resolvedDecision.source === MODEL_SELECTION_SOURCES.AUTO_ROUTER ? null : selectedModel,
          mode: conversationMode,
          webSearchEnabled: input.webSearchEnabled,
          updatedAt: new Date(),
        })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))

      const wrappedContent = `${runtimeConfig.prompts.wrappers.userRequestOpen}\n${input.content}\n${runtimeConfig.prompts.wrappers.userRequestClose}`
      const hasAttachments = input.attachmentIds.length > 0
      if (hasAttachments) {
        yield emit({
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.READING_FILES,
          message: runtimeConfig.chat.statusMessages.readingFiles,
        })
      }

      const { buildUserContent } = await import('@/server/services/history-builder')
      const userContent = await buildUserContent(wrappedContent, linkedAttachmentRows)

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

      const { buildEnrichedHistory } = await import('@/server/services/history-builder')
      const historyMessages = await buildEnrichedHistory(ctx.db, conversationId, {
        excludeMessageIds: userMessageId ? [userMessageId] : [],
      })

      const baseMessages: Message[] = [
        ...historyMessages,
        { role: MESSAGE_ROLES.USER, content: userContent },
      ]

      const { openrouter } = await import('@/lib/ai/client')
      const { ALL_TOOLS } = await import('@/lib/ai/tools')

      const strictA2UIContract =
        runtimeConfig.features.a2uiEnabled && routerResponseFormat === RESPONSE_FORMATS.A2UI
      const maxA2UIAttempts = runtimeConfig.features.a2uiEnabled
        ? LIMITS.A2UI_CONTRACT_MAX_ATTEMPTS
        : 1
      let a2uiContractRetryCount = 0
      let forceA2UIRetry = false

      let fullText = ''
      let thinkingContent = ''
      let thinkingStartedAt: number | null = null
      let thinkingDurationMs: number | undefined
      let a2uiLines: string[] = []
      let usage: Usage | undefined
      let streamSequenceMax = 0

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

      let componentFeedback = ''

      for (let contractAttempt = 1; contractAttempt <= maxA2UIAttempts; contractAttempt += 1) {
        const isA2UIRetryAttempt = contractAttempt > 1 && (strictA2UIContract || forceA2UIRetry)
        const enforceA2UIContract = strictA2UIContract || forceA2UIRetry
        const retrySections = isA2UIRetryAttempt
          ? [PROMPTS.A2UI_RETRY_FORMAT_PROMPT, componentFeedback].filter(Boolean)
          : []
        const attemptSystemSections = [...systemSections, ...retrySections]
        const attemptMessages: Message[] = [
          { role: MESSAGE_ROLES.SYSTEM, content: attemptSystemSections.join('\n\n') },
          ...baseMessages,
        ]

        fullText = ''
        thinkingContent = ''
        thinkingStartedAt = null
        thinkingDurationMs = undefined
        a2uiLines = []
        usage = undefined

        let inA2UI = false
        let a2uiBuffer = ''
        let fenceLookback = ''
        let thinkingStatusEmitted = false
        let toolRoundCount = 0

        if (isImageGenModel) {
          const { executeImageGeneration } =
            await import('@/server/services/image-generation-service')
          const imageResult = await executeImageGeneration({
            model: selectedModel,
            messages: baseMessages,
            signal: combinedSignal,
            registry,
          })

          if (imageResult.imageContent.length > 0) {
            fullText = imageResult.imageContent
            const textEvent = emit({ type: STREAM_EVENTS.TEXT, content: imageResult.imageContent })
            if (typeof textEvent.sequence === 'number') {
              streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
            }
            yield textEvent
          } else {
            throw new TRPCError({
              code: TRPC_CODES.BAD_REQUEST,
              message: AppError.IMAGE_GEN_EMPTY_RESULT,
            })
          }

          usage = imageResult.usage
          break
        }

        while (true) {
          const stream = await openrouter.chat.send(
            {
              chatGenerationParams: {
                model: selectedModel,
                messages: attemptMessages,
                stream: true,
                maxCompletionTokens: getModelMaxCompletionTokens(registry, selectedModel),
                ...(webSearchEnabled
                  ? { tools: ALL_TOOLS, toolChoice: ToolChoiceOptionAuto.Auto }
                  : {}),
                ...(registry.find((m) => m.id === selectedModel)?.supportsThinking
                  ? { reasoning: { effort: AI_PARAMS.REASONING_EFFORT } }
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

            const prefix = fenceLookback
            fenceLookback = ''
            let remaining = prefix + delta.content

            while (remaining.length > 0) {
              if (!inA2UI) {
                const fenceStartMatch = findA2UIFenceStart(remaining)
                if (!fenceStartMatch) {
                  let reserveFrom = remaining.length
                  while (reserveFrom > 0 && remaining[reserveFrom - 1] === '`') {
                    reserveFrom -= 1
                  }
                  if (reserveFrom < remaining.length) {
                    fenceLookback = remaining.slice(reserveFrom)
                  }
                  const emittable = remaining.slice(0, reserveFrom)
                  if (emittable.length > 0) {
                    roundAssistantText += emittable
                    fullText += emittable
                    if (!enforceA2UIContract) {
                      const textEvent = emit({
                        type: STREAM_EVENTS.TEXT,
                        content: emittable,
                      })
                      if (typeof textEvent.sequence === 'number') {
                        streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
                      }
                      yield textEvent
                    }
                  }
                  remaining = ''
                  continue
                }

                const visiblePrefix = remaining.slice(0, fenceStartMatch.index)
                if (visiblePrefix.length > 0) {
                  roundAssistantText += visiblePrefix
                  fullText += visiblePrefix
                  if (!enforceA2UIContract) {
                    const textEvent = emit({
                      type: STREAM_EVENTS.TEXT,
                      content: visiblePrefix,
                    })
                    if (typeof textEvent.sequence === 'number') {
                      streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
                    }
                    yield textEvent
                  }
                }
                fenceLookback = ''

                remaining = remaining.slice(fenceStartMatch.index + fenceStartMatch.length)
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

          if (fenceLookback.length > 0 && !inA2UI) {
            roundAssistantText += fenceLookback
            fullText += fenceLookback
            if (!enforceA2UIContract) {
              const textEvent = emit({ type: STREAM_EVENTS.TEXT, content: fenceLookback })
              if (typeof textEvent.sequence === 'number') {
                streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
              }
              yield textEvent
            }
            fenceLookback = ''
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

          attemptMessages.push({
            role: MESSAGE_ROLES.ASSISTANT,
            content: roundAssistantText,
            toolCalls: roundToolCalls,
          })

          for (const call of roundToolCalls) {
            if (call.function.name !== searchToolName) {
              attemptMessages.push({
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

            attemptMessages.push({
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

        if (a2uiLines.length === 0 && runtimeConfig.features.a2uiEnabled && fullText.length > 0) {
          const extracted = extractA2UILinesFromAnyCodeFence(fullText, runtimeConfig.safety.a2ui)
          if (extracted.lines.length > 0) {
            const invalidTypes = validateA2UIComponentTypes(extracted.lines)
            if (invalidTypes.length === 0) {
              fullText = extracted.strippedText.trim()
              for (const line of extracted.lines) {
                a2uiLines.push(line)
                const a2uiEvent = emit({
                  type: STREAM_EVENTS.A2UI,
                  jsonl: line,
                })
                if (typeof a2uiEvent.sequence === 'number') {
                  streamSequenceMax = Math.max(streamSequenceMax, a2uiEvent.sequence)
                }
                yield a2uiEvent
              }
              if (!enforceA2UIContract) {
                const textSetEvent = emit({
                  type: STREAM_EVENTS.TEXT_SET,
                  content: fullText,
                })
                if (typeof textSetEvent.sequence === 'number') {
                  streamSequenceMax = Math.max(streamSequenceMax, textSetEvent.sequence)
                }
                yield textSetEvent
              }
            } else {
              console.warn(
                '[a2ui] invalid component types in post-stream extraction:',
                invalidTypes,
              )
              componentFeedback = buildComponentTypeFeedback(invalidTypes)
              forceA2UIRetry = true
            }
          }
        }

        if (a2uiLines.length > 0 && runtimeConfig.features.a2uiEnabled) {
          const invalidTypes = validateA2UIComponentTypes(a2uiLines)
          if (invalidTypes.length > 0) {
            console.warn('[a2ui] invalid component types in inline extraction:', invalidTypes)
            componentFeedback = buildComponentTypeFeedback(invalidTypes)
            a2uiLines = []
            forceA2UIRetry = true
          }
        }

        if (a2uiLines.length === 0 && runtimeConfig.features.a2uiEnabled) {
          if (strictA2UIContract || forceA2UIRetry) {
            if (contractAttempt < maxA2UIAttempts) {
              a2uiContractRetryCount += 1
              const retryStatusEvent = emit({
                type: STREAM_EVENTS.STATUS,
                phase: STREAM_PHASES.GENERATING_UI,
                message: runtimeConfig.chat.statusMessages.generatingUi,
              })
              if (typeof retryStatusEvent.sequence === 'number') {
                streamSequenceMax = Math.max(streamSequenceMax, retryStatusEvent.sequence)
              }
              yield retryStatusEvent
              continue
            }
            throw new TRPCError({
              code: TRPC_CODES.BAD_REQUEST,
              message: AppError.A2UI_CONTRACT_FAILED,
            })
          }

          if (contractAttempt < maxA2UIAttempts) {
            try {
              const { decideA2UIRecovery } = await import('@/lib/ai/router')
              const recoveryDecision = await decideA2UIRecovery(
                input.content,
                fullText,
                registry,
                runtimeConfig,
                combinedSignal,
              )
              if (recoveryDecision.retryAsA2UI) {
                forceA2UIRetry = true
                a2uiContractRetryCount += 1
                const retryStatusEvent = emit({
                  type: STREAM_EVENTS.STATUS,
                  phase: STREAM_PHASES.GENERATING_UI,
                  message: runtimeConfig.chat.statusMessages.generatingUi,
                })
                if (typeof retryStatusEvent.sequence === 'number') {
                  streamSequenceMax = Math.max(streamSequenceMax, retryStatusEvent.sequence)
                }
                yield retryStatusEvent
                continue
              }
            } catch (recoveryError) {
              console.error(
                '[a2ui] recovery adjudication failed:',
                recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
              )
            }
          }
        }

        if (enforceA2UIContract && fullText.trim().length > 0) {
          const deferredTextEvent = emit({
            type: STREAM_EVENTS.TEXT,
            content: fullText,
          })
          if (typeof deferredTextEvent.sequence === 'number') {
            streamSequenceMax = Math.max(streamSequenceMax, deferredTextEvent.sequence)
          }
          yield deferredTextEvent
        }

        break
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
        recoveryAttemptCount: a2uiContractRetryCount > 0 ? a2uiContractRetryCount : undefined,
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
        .set({
          updatedAt: new Date(),
          mode: input.mode,
          webSearchEnabled: input.webSearchEnabled,
          ...(input.model !== undefined ? { model: input.model } : {}),
          settingsVersion: sql`${conversations.settingsVersion} + 1`,
        })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))

      {
        const { generateAndPersistTitle } =
          await import('@/server/services/title-generation-service')
        const shouldGenerate = conversation.title === NEW_CHAT_TITLE
        if (shouldGenerate) {
          yield emit({
            type: STREAM_EVENTS.STATUS,
            phase: STREAM_PHASES.GENERATING_TITLE,
            message: runtimeConfig.chat.statusMessages.generatingTitle,
          })
        }
        await generateAndPersistTitle({
          db: ctx.db,
          conversationId,
          userId: ctx.userId,
          currentTitle: conversation.title,
          fallbackContent: input.content,
          runtimeConfig,
        })
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
      console.error('[chat.stream] terminal error:', getErrorMessage(error))
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

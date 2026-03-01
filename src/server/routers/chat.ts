import { and, asc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, rateLimitedChatProcedure } from '../trpc'
import {
  ChatInputSchema,
  MessageMetadataSchema,
  UsageSchema,
  CancelStreamInputSchema,
} from '@/schemas/message'
import type { SearchImage, SearchResult } from '@/schemas/search'
import { conversations, messages, attachments } from '@/lib/db/schema'
import {
  STREAM_EVENTS,
  STREAM_PHASES,
  CHAT_MODES,
  MESSAGE_ROLES,
  TRPC_CODES,
  NEW_CHAT_TITLE,
  AI_MARKUP,
  LIMITS,
} from '@/config/constants'
import { AppError } from '@/lib/utils/errors'
import type { StreamChunk } from '@/schemas/message'
import type { ToolCall, Usage } from '@/schemas/message'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import type { Message, ToolResponseMessage, ChatMessageContentItem } from '@openrouter/sdk/models'
import {
  ToolChoiceOptionAuto,
  ChatMessageToolCallType,
  ChatMessageContentItemImageType,
  ChatMessageContentItemTextType,
} from '@openrouter/sdk/models'
import { escapeXmlForPrompt, sanitizeA2UIJsonLine } from '@/lib/security/runtime-safety'

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

function buildSearchContext(results: SearchResult[], runtimeConfig: RuntimeConfig): string {
  if (results.length === 0) {
    return ''
  }

  const wrappers = runtimeConfig.prompts.wrappers
  const normalize = (value: string) =>
    runtimeConfig.safety.escapeSearchXml ? escapeXmlForPrompt(value) : value

  const body = results
    .map((result) => {
      const title = normalize(result.title)
      const snippet = normalize(result.snippet)
      const url = normalize(result.url)
      return `${wrappers.searchResultOpen}<title>${title}</title><snippet>${snippet}</snippet><url>${url}</url>${wrappers.searchResultClose}`
    })
    .join('\n')

  return `\n\n${wrappers.searchResultsOpen}\n${body}\n${wrappers.searchResultsClose}`
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

export const chatRouter = router({
  stream: rateLimitedChatProcedure.input(ChatInputSchema).subscription(async function* ({
    ctx,
    input,
    signal,
  }) {
    const runtimeConfig = ctx.runtimeConfig
    const streamRequestId = crypto.randomUUID()
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
            searchMode: input.mode,
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

      let selectedModel = input.model
      let routerReasoning: string | undefined
      const { getModelRegistry } = await import('@/lib/ai/registry')
      const registry = await getModelRegistry({ runtimeConfig })

      if (!selectedModel) {
        yield emit({
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.ROUTING,
          message: runtimeConfig.chat.statusMessages.routing,
        })

        const { routeModel } = await import('@/lib/ai/router')
        let selection: Awaited<ReturnType<typeof routeModel>>
        try {
          selection = await routeModel(input.content, registry, runtimeConfig, combinedSignal)
        } catch {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: AppError.ROUTER_FAILED,
          })
        }

        if (!registry.some((model) => model.id === selection.selectedModel)) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: AppError.INVALID_MODEL,
          })
        }

        selectedModel = selection.selectedModel
        routerReasoning = selection.reasoning
        yield emit({
          type: STREAM_EVENTS.MODEL_SELECTED,
          model: selectedModel,
          reasoning: selection.reasoning,
        })
      } else if (runtimeConfig.models.strictValidation) {
        if (!registry.some((model) => model.id === selectedModel)) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: AppError.INVALID_MODEL,
          })
        }

        yield emit({
          type: STREAM_EVENTS.MODEL_SELECTED,
          model: selectedModel,
          reasoning: 'Model explicitly selected.',
        })
      }

      if (!selectedModel) {
        throw new TRPCError({
          code: TRPC_CODES.INTERNAL_SERVER_ERROR,
          message: AppError.INVALID_MODEL,
        })
      }

      await ctx.db
        .update(conversations)
        .set({ model: selectedModel, updatedAt: new Date() })
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

      if (input.mode === CHAT_MODES.SEARCH) {
        if (!runtimeConfig.features.searchEnabled) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: runtimeConfig.chat.errors.processing,
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
        const { tavilySearch } = await import('@/lib/search/tavily')
        const response = await tavilySearch({
          query: input.content,
          maxResults: runtimeConfig.limits.searchMaxResults,
          includeImages: runtimeConfig.search.includeImagesByDefault,
          searchDepth: runtimeConfig.search.defaultDepth,
        })
        searchResults = response.results
        searchImages = response.images

        yield emit({
          type: STREAM_EVENTS.TOOL_RESULT,
          toolName: searchToolName,
          result: {
            query: response.query,
            results: response.results,
            images: response.images,
          },
        })
        toolCalls.push({
          name: searchToolName,
          input: { query: input.content },
          result: {
            query: response.query,
            results: response.results,
            images: response.images,
          },
          durationMs: Date.now() - startedAt,
        })
        searchContext = buildSearchContext(response.results, runtimeConfig)
      }

      yield emit({
        type: STREAM_EVENTS.STATUS,
        phase: STREAM_PHASES.THINKING,
        message: runtimeConfig.chat.statusMessages.thinking,
      })

      const systemSections = [runtimeConfig.prompts.chatSystem]
      if (runtimeConfig.features.a2uiEnabled) {
        systemSections.push(runtimeConfig.prompts.a2uiSystem)
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
      const stream = await openrouter.chat.send(
        {
          chatGenerationParams: {
            model: selectedModel,
            messages: sdkMessages,
            stream: true,
            maxTokens: runtimeConfig.ai.chatMaxTokens,
            ...(input.mode === CHAT_MODES.CHAT
              ? { tools: ALL_TOOLS, toolChoice: ToolChoiceOptionAuto.Auto }
              : {}),
          },
        },
        { signal: combinedSignal },
      )

      let fullText = ''
      let thinkingContent = ''
      let thinkingStartedAt: number | null = null
      let thinkingDurationMs: number | undefined
      let a2uiLines: string[] = []
      let inA2UI = false
      let a2uiBuffer = ''
      let usage: Usage | undefined
      let streamSequenceMax = 0
      const toolCallArgBuffers = new Map<number, { id: string; name: string; args: string }>()

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

        if (delta.reasoning) {
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

        if (delta.toolCalls) {
          for (const toolCall of delta.toolCalls) {
            const existing = toolCallArgBuffers.get(toolCall.index) ?? {
              id: toolCall.id ?? '',
              name: toolCall.function?.name ?? '',
              args: '',
            }
            existing.args += toolCall.function?.arguments ?? ''
            if (toolCall.id) existing.id = toolCall.id
            if (toolCall.function?.name) existing.name = toolCall.function.name
            toolCallArgBuffers.set(toolCall.index, existing)
          }
          continue
        }

        if (!delta.content) continue

        const text = delta.content
        if (text.includes(AI_MARKUP.A2UI_FENCE_START)) {
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

        if (inA2UI && text.includes(AI_MARKUP.CODE_FENCE_END)) {
          if (a2uiBuffer.trim()) {
            const sanitizedLine = sanitizeA2UIJsonLine(a2uiBuffer.trim(), runtimeConfig.safety.a2ui)
            if (sanitizedLine) {
              a2uiLines.push(sanitizedLine)
              const a2uiEvent = emit({
                type: STREAM_EVENTS.A2UI,
                jsonl: sanitizedLine,
              })
              if (typeof a2uiEvent.sequence === 'number') {
                streamSequenceMax = Math.max(streamSequenceMax, a2uiEvent.sequence)
              }
              yield a2uiEvent
            }
          }
          inA2UI = false
          a2uiBuffer = ''
          continue
        }

        if (inA2UI) {
          a2uiBuffer += text
          const lines = a2uiBuffer.split('\n')
          a2uiBuffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const sanitizedLine = sanitizeA2UIJsonLine(trimmed, runtimeConfig.safety.a2ui)
            if (!sanitizedLine) continue
            a2uiLines.push(sanitizedLine)
            const a2uiEvent = emit({
              type: STREAM_EVENTS.A2UI,
              jsonl: sanitizedLine,
            })
            if (typeof a2uiEvent.sequence === 'number') {
              streamSequenceMax = Math.max(streamSequenceMax, a2uiEvent.sequence)
            }
            yield a2uiEvent
          }
          continue
        }

        fullText += text
        const textEvent = emit({
          type: STREAM_EVENTS.TEXT,
          content: text,
        })
        if (typeof textEvent.sequence === 'number') {
          streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
        }
        yield textEvent
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

      if (toolCallArgBuffers.size > 0 && input.mode === CHAT_MODES.CHAT) {
        const assistantToolCallMessage: Message = {
          role: MESSAGE_ROLES.ASSISTANT,
          content: fullText || '',
          toolCalls: [...toolCallArgBuffers.entries()].map(([, toolCall]) => ({
            id: toolCall.id,
            type: ChatMessageToolCallType.Function,
            function: { name: toolCall.name, arguments: toolCall.args },
          })),
        }
        const toolResultMessages: ToolResponseMessage[] = []

        for (const [, toolCall] of toolCallArgBuffers.entries()) {
          if (toolCall.name !== searchToolName || !runtimeConfig.features.searchEnabled) continue

          let query = toolCall.args
          try {
            query = (JSON.parse(toolCall.args) as { query: string }).query
          } catch {
            // If tool args are not JSON we pass through raw string query.
          }

          const toolStartEvent = emit({
            type: STREAM_EVENTS.TOOL_START,
            toolName: searchToolName,
            input: { query },
          })
          if (typeof toolStartEvent.sequence === 'number') {
            streamSequenceMax = Math.max(streamSequenceMax, toolStartEvent.sequence)
          }
          yield toolStartEvent

          const startedAt = Date.now()
          const { tavilySearch } = await import('@/lib/search/tavily')
          const response = await tavilySearch({
            query,
            maxResults: runtimeConfig.limits.searchMaxResults,
            includeImages: runtimeConfig.search.includeImagesByDefault,
            searchDepth: runtimeConfig.search.defaultDepth,
          })
          searchResults = response.results
          searchImages = response.images

          const toolResultEvent = emit({
            type: STREAM_EVENTS.TOOL_RESULT,
            toolName: searchToolName,
            result: {
              query: response.query,
              results: response.results,
              images: response.images,
            },
          })
          if (typeof toolResultEvent.sequence === 'number') {
            streamSequenceMax = Math.max(streamSequenceMax, toolResultEvent.sequence)
          }
          yield toolResultEvent

          toolCalls.push({
            name: searchToolName,
            input: { query },
            result: {
              query: response.query,
              results: response.results,
              images: response.images,
            },
            durationMs: Date.now() - startedAt,
          })

          const resultsText = response.results
            .map((result) => `[${result.title}](${result.url})\n${result.snippet}`)
            .join('\n\n')
          toolResultMessages.push({
            role: 'tool',
            content: resultsText,
            toolCallId: toolCall.id,
          })
        }

        if (toolResultMessages.length > 0) {
          fullText = ''
          const followUpMessages: Message[] = [
            ...sdkMessages,
            assistantToolCallMessage,
            ...toolResultMessages,
          ]
          const followUpStream = await openrouter.chat.send(
            {
              chatGenerationParams: {
                model: selectedModel,
                messages: followUpMessages,
                stream: true,
                maxTokens: runtimeConfig.ai.chatMaxTokens,
              },
            },
            { signal: combinedSignal },
          )

          for await (const followUpChunk of followUpStream) {
            if (followUpChunk.usage) {
              const parsedUsage = UsageSchema.safeParse({
                promptTokens: followUpChunk.usage.promptTokens ?? 0,
                completionTokens: followUpChunk.usage.completionTokens ?? 0,
                totalTokens: followUpChunk.usage.totalTokens ?? 0,
              })
              if (parsedUsage.success) {
                usage = parsedUsage.data
              }
            }

            const followUpDelta = followUpChunk.choices[0]?.delta
            if (!followUpDelta?.content) continue
            fullText += followUpDelta.content
            const textEvent = emit({
              type: STREAM_EVENTS.TEXT,
              content: followUpDelta.content,
            })
            if (typeof textEvent.sequence === 'number') {
              streamSequenceMax = Math.max(streamSequenceMax, textEvent.sequence)
            }
            yield textEvent
          }
        }
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
        thinkingContent: thinkingContent || undefined,
        thinkingDurationMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        searchQuery: input.mode === CHAT_MODES.SEARCH ? input.content : undefined,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        searchImages: searchImages.length > 0 ? searchImages : undefined,
        a2uiMessages: a2uiLines.length > 0 ? a2uiLines : undefined,
        usage: usageWithCost,
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

      const [messageCount] = await ctx.db
        .select({ value: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .limit(1)
      const shouldGenerateTitle =
        conversation.title === NEW_CHAT_TITLE && Number(messageCount?.value ?? 0) <= 2

      if (shouldGenerateTitle) {
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
          const generatedTitle = await generateTitle(input.content, runtimeConfig, combinedSignal)
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
        } catch {
          // Title generation failure is non-fatal; conversation stays as "New Chat"
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

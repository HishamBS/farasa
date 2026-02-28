import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, rateLimitedChatProcedure } from '../trpc'
import { ChatInputSchema, MessageMetadataSchema } from '@/schemas/message'
import { UsageSchema } from '@/schemas/message'
import type { SearchImage, SearchResult } from '@/schemas/search'
import { conversations, messages, attachments } from '@/lib/db/schema'
import {
  STREAM_EVENTS,
  STREAM_PHASES,
  STATUS_MESSAGES,
  CHAT_MODES,
  TOOL_NAMES,
  AI_REASONING,
  AI_PARAMS,
  LIMITS,
  AI_MARKUP,
  SEARCH_DEPTHS,
  MESSAGE_ROLES,
  TRPC_CODES,
} from '@/config/constants'
import { PROMPTS, USER_REQUEST_DELIMITERS } from '@/config/prompts'
import { AppError } from '@/lib/utils/errors'
import type { StreamChunk } from '@/schemas/message'
import type { ToolCall, Usage } from '@/schemas/message'
import type { Message, ToolResponseMessage, ChatMessageContentItem } from '@openrouter/sdk/models'
import {
  ToolChoiceOptionAuto,
  ChatMessageToolCallType,
  ChatMessageContentItemImageType,
  ChatMessageContentItemTextType,
} from '@openrouter/sdk/models'

export const chatRouter = router({
  stream: rateLimitedChatProcedure.input(ChatInputSchema).subscription(async function* ({
    ctx,
    input,
    signal,
  }) {
    let conversationId = input.conversationId
    let isNewConversation = false
    type MessageRow = typeof messages.$inferSelect
    let userMessage: MessageRow | null = null

    try {
      if (!conversationId) {
        isNewConversation = true
        const txResult = await ctx.db.transaction(async (tx) => {
          const [created] = await tx
            .insert(conversations)
            .values({ userId: ctx.userId, model: input.model })
            .returning()
          if (!created) throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
          const [msg] = await tx
            .insert(messages)
            .values({
              conversationId: created.id,
              role: MESSAGE_ROLES.USER,
              content: input.content,
            })
            .returning()
          if (!msg) throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
          return { id: created.id, userMessage: msg }
        })
        conversationId = txResult.id
        userMessage = txResult.userMessage
      } else {
        const [conv] = await ctx.db
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))
          .limit(1)
        if (!conv) throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
        if (!input.skipUserInsert) {
          const [msg] = await ctx.db
            .insert(messages)
            .values({ conversationId, role: MESSAGE_ROLES.USER, content: input.content })
            .returning()
          if (!msg) throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
          userMessage = msg
        }
      }

      if (input.attachmentIds.length > 0) {
        if (!userMessage) throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
        const updated = await ctx.db
          .update(attachments)
          .set({ messageId: userMessage.id })
          .where(
            and(
              inArray(attachments.id, input.attachmentIds),
              eq(attachments.userId, ctx.userId),
              isNotNull(attachments.confirmedAt),
            ),
          )
          .returning({ id: attachments.id })
        if (updated.length !== input.attachmentIds.length) {
          throw new TRPCError({
            code: TRPC_CODES.FORBIDDEN,
            message: AppError.ATTACHMENT_ACCESS_DENIED,
          })
        }
      }

      let selectedModel = input.model
      let routerReasoning: string | undefined
      const { getModelRegistry } = await import('@/lib/ai/registry')
      const registry = await getModelRegistry()

      if (!selectedModel) {
        const chunk: StreamChunk = {
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.ROUTING,
          message: STATUS_MESSAGES.ROUTING,
        }
        yield chunk

        const { routeModel } = await import('@/lib/ai/router')
        const selection = await routeModel(input.content, registry)
        if (!registry.some((m) => m.id === selection.selectedModel)) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: AppError.INVALID_MODEL,
          })
        }
        selectedModel = selection.selectedModel
        routerReasoning = selection.reasoning

        const modelChunk: StreamChunk = {
          type: STREAM_EVENTS.MODEL_SELECTED,
          model: selectedModel,
          reasoning: selection.reasoning,
        }
        yield modelChunk
      } else {
        // Validate the explicitly-provided model against the live registry
        if (!registry.some((m) => m.id === selectedModel)) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: AppError.INVALID_MODEL,
          })
        }
        const modelChunk: StreamChunk = {
          type: STREAM_EVENTS.MODEL_SELECTED,
          model: selectedModel,
          reasoning: AI_REASONING.MODEL_EXPLICIT,
        }
        yield modelChunk
      }

      const wrappedContent = `${USER_REQUEST_DELIMITERS.OPEN}\n${input.content}\n${USER_REQUEST_DELIMITERS.CLOSE}`
      let userContent: string | ChatMessageContentItem[] = wrappedContent
      if (input.attachmentIds.length > 0) {
        const statusChunk: StreamChunk = {
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.READING_FILES,
          message: STATUS_MESSAGES.READING_FILES,
        }
        yield statusChunk

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
        for (const att of attachmentRows) {
          if (att.fileType.startsWith('image/')) {
            blocks.push({
              type: ChatMessageContentItemImageType.ImageUrl,
              imageUrl: { url: att.storageUrl },
            })
          } else {
            blocks.push({
              type: ChatMessageContentItemTextType.Text,
              text: `[Attachment: ${att.fileName} — ${att.fileType}]`,
            })
          }
        }
        userContent = blocks
      }

      const toolCalls: ToolCall[] = []
      let searchContext = ''
      let searchResults: SearchResult[] = []
      let searchImages: SearchImage[] = []
      if (input.mode === CHAT_MODES.SEARCH) {
        const searchingStatusChunk: StreamChunk = {
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.SEARCHING,
          message: STATUS_MESSAGES.SEARCHING,
        }
        yield searchingStatusChunk

        const toolStartChunk: StreamChunk = {
          type: STREAM_EVENTS.TOOL_START,
          toolName: TOOL_NAMES.WEB_SEARCH,
          input: { query: input.content },
        }
        yield toolStartChunk
        const toolStartedAt = Date.now()
        const toolCall: ToolCall = {
          name: TOOL_NAMES.WEB_SEARCH,
          input: { query: input.content },
        }

        const { tavilySearch } = await import('@/lib/search/tavily')
        const response = await tavilySearch({
          query: input.content,
          maxResults: LIMITS.SEARCH_MAX_RESULTS,
          includeImages: true,
          searchDepth: SEARCH_DEPTHS.BASIC,
        })
        searchResults = response.results
        searchImages = response.images

        const toolResultChunk: StreamChunk = {
          type: STREAM_EVENTS.TOOL_RESULT,
          toolName: TOOL_NAMES.WEB_SEARCH,
          result: {
            query: response.query,
            results: response.results,
            images: response.images,
          },
        }
        yield toolResultChunk
        toolCall.result = {
          query: response.query,
          results: response.results,
          images: response.images,
        }
        toolCall.durationMs = Date.now() - toolStartedAt
        toolCalls.push(toolCall)

        // XML-wrap search results to block indirect prompt injection
        searchContext =
          '\n\n<search_results>\n' +
          response.results
            .map(
              (r) =>
                `<result><title>${r.title}</title><snippet>${r.snippet}</snippet><url>${r.url}</url></result>`,
            )
            .join('\n') +
          '\n</search_results>'
      }

      const thinkingChunk: StreamChunk = {
        type: STREAM_EVENTS.STATUS,
        phase: STREAM_PHASES.THINKING,
        message: STATUS_MESSAGES.THINKING,
      }
      yield thinkingChunk

      const systemContent =
        PROMPTS.CHAT_SYSTEM_PROMPT + '\n\n' + PROMPTS.A2UI_SYSTEM_PROMPT + searchContext
      const sdkMessages: Message[] = [
        { role: MESSAGE_ROLES.SYSTEM, content: systemContent },
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
            maxTokens: AI_PARAMS.CHAT_MAX_TOKENS,
            ...(input.mode === CHAT_MODES.CHAT
              ? { tools: ALL_TOOLS, toolChoice: ToolChoiceOptionAuto.Auto }
              : {}),
          },
        },
        { signal },
      )

      let fullText = ''
      let thinkingContent = ''
      let thinkingStartedAt: number | null = null
      let thinkingDurationMs: number | undefined
      let a2uiLines: string[] = []
      let inA2UI = false
      let a2uiBuffer = ''
      let usage: Usage | undefined
      const toolCallArgBuffers = new Map<number, { id: string; name: string; args: string }>()

      for await (const chunk of stream) {
        if (chunk.usage) {
          const parsedUsage = UsageSchema.safeParse({
            promptTokens: chunk.usage.promptTokens ?? 0,
            completionTokens: chunk.usage.completionTokens ?? 0,
            totalTokens: chunk.usage.totalTokens ?? 0,
          })
          if (parsedUsage.success) {
            usage = parsedUsage.data
          }
        }

        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        if (delta.reasoning) {
          if (!thinkingStartedAt) thinkingStartedAt = Date.now()
          thinkingContent += delta.reasoning
          const thinkTokenChunk: StreamChunk = {
            type: STREAM_EVENTS.THINKING,
            content: delta.reasoning,
            isComplete: false,
          }
          yield thinkTokenChunk
          continue
        }

        if (delta.toolCalls) {
          for (const tc of delta.toolCalls) {
            const buf = toolCallArgBuffers.get(tc.index) ?? {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              args: '',
            }
            buf.args += tc.function?.arguments ?? ''
            if (tc.id) buf.id = tc.id
            if (tc.function?.name) buf.name = tc.function.name
            toolCallArgBuffers.set(tc.index, buf)
          }
          continue
        }

        if (delta.content) {
          const text = delta.content

          if (text.includes(AI_MARKUP.A2UI_FENCE_START)) {
            inA2UI = true
            a2uiBuffer = ''
            const a2uiStatusChunk: StreamChunk = {
              type: STREAM_EVENTS.STATUS,
              phase: STREAM_PHASES.GENERATING_UI,
              message: STATUS_MESSAGES.GENERATING_UI,
            }
            yield a2uiStatusChunk
            continue
          }
          if (inA2UI && text.includes(AI_MARKUP.CODE_FENCE_END)) {
            // Flush remaining buffer content
            if (a2uiBuffer.trim()) {
              a2uiLines.push(a2uiBuffer.trim())
              const a2uiChunk: StreamChunk = {
                type: STREAM_EVENTS.A2UI,
                jsonl: a2uiBuffer.trim(),
              }
              yield a2uiChunk
            }
            inA2UI = false
            a2uiBuffer = ''
            continue
          }
          if (inA2UI) {
            // Buffer tokens until we have complete lines to avoid token-boundary issues
            a2uiBuffer += text
            const lines = a2uiBuffer.split('\n')
            a2uiBuffer = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed) {
                a2uiLines.push(trimmed)
                const a2uiChunk: StreamChunk = {
                  type: STREAM_EVENTS.A2UI,
                  jsonl: trimmed,
                }
                yield a2uiChunk
              }
            }
            continue
          }

          fullText += text
          const textChunk: StreamChunk = {
            type: STREAM_EVENTS.TEXT,
            content: text,
          }
          yield textChunk
        }
      }

      if (thinkingContent) {
        thinkingDurationMs = thinkingStartedAt ? Date.now() - thinkingStartedAt : undefined
        const thinkCompleteChunk: StreamChunk = {
          type: STREAM_EVENTS.THINKING,
          content: '',
          isComplete: true,
        }
        yield thinkCompleteChunk
      }

      // Handle model-initiated tool calls (chat mode autonomous search)
      if (toolCallArgBuffers.size > 0 && input.mode === CHAT_MODES.CHAT) {
        const assistantToolCallMessage: Message = {
          role: MESSAGE_ROLES.ASSISTANT,
          content: fullText || '',
          toolCalls: [...toolCallArgBuffers.entries()].map(([, tc]) => ({
            id: tc.id,
            type: ChatMessageToolCallType.Function,
            function: { name: tc.name, arguments: tc.args },
          })),
        }
        const toolResultMessages: ToolResponseMessage[] = []

        for (const [, tc] of toolCallArgBuffers.entries()) {
          if (tc.name === TOOL_NAMES.WEB_SEARCH) {
            let query = tc.args
            try {
              query = (JSON.parse(tc.args) as { query: string }).query
            } catch {
              /* ignore */
            }

            const toolStartChunk: StreamChunk = {
              type: STREAM_EVENTS.TOOL_START,
              toolName: TOOL_NAMES.WEB_SEARCH,
              input: { query },
            }
            yield toolStartChunk
            const toolStartedAt = Date.now()

            const { tavilySearch } = await import('@/lib/search/tavily')
            const response = await tavilySearch({
              query,
              maxResults: LIMITS.SEARCH_MAX_RESULTS,
              includeImages: true,
              searchDepth: SEARCH_DEPTHS.BASIC,
            })
            searchResults = response.results
            searchImages = response.images

            const toolResultChunk: StreamChunk = {
              type: STREAM_EVENTS.TOOL_RESULT,
              toolName: TOOL_NAMES.WEB_SEARCH,
              result: { query: response.query, results: response.results, images: response.images },
            }
            yield toolResultChunk
            toolCalls.push({
              name: TOOL_NAMES.WEB_SEARCH,
              input: { query },
              result: { query: response.query, results: response.results },
              durationMs: Date.now() - toolStartedAt,
            })

            const resultsText = response.results
              .map((r) => `[${r.title}](${r.url})\n${r.snippet}`)
              .join('\n\n')
            toolResultMessages.push({
              role: 'tool',
              content: resultsText,
              toolCallId: tc.id,
            })
          }
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
                maxTokens: AI_PARAMS.CHAT_MAX_TOKENS,
              },
            },
            { signal },
          )
          for await (const fchunk of followUpStream) {
            if (fchunk.usage) {
              const parsedUsage = UsageSchema.safeParse({
                promptTokens: fchunk.usage.promptTokens ?? 0,
                completionTokens: fchunk.usage.completionTokens ?? 0,
                totalTokens: fchunk.usage.totalTokens ?? 0,
              })
              if (parsedUsage.success) usage = parsedUsage.data
            }
            const fdelta = fchunk.choices[0]?.delta
            if (fdelta?.content) {
              fullText += fdelta.content
              const textChunk: StreamChunk = { type: STREAM_EVENTS.TEXT, content: fdelta.content }
              yield textChunk
            }
          }
        }
      }

      const metadata = MessageMetadataSchema.parse({
        modelUsed: selectedModel,
        routerReasoning,
        thinkingContent: thinkingContent || undefined,
        thinkingDurationMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        searchQuery: input.mode === CHAT_MODES.SEARCH ? input.content : undefined,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        searchImages: searchImages.length > 0 ? searchImages : undefined,
        a2uiMessages: a2uiLines.length > 0 ? a2uiLines : undefined,
        usage,
      })

      await ctx.db.insert(messages).values({
        conversationId,
        role: MESSAGE_ROLES.ASSISTANT,
        content: fullText,
        metadata,
      })

      await ctx.db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))

      if (isNewConversation) {
        const titleConversationId = conversationId
        if (!titleConversationId) {
          throw new TRPCError({
            code: TRPC_CODES.INTERNAL_SERVER_ERROR,
            message: AppError.MISSING_CONVERSATION_ID,
          })
        }
        const titleStatusChunk: StreamChunk = {
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.GENERATING_TITLE,
          message: STATUS_MESSAGES.GENERATING_TITLE,
        }
        yield titleStatusChunk
        const { generateTitle } = await import('@/lib/ai/title')
        const title = await generateTitle(input.content)
        await ctx.db
          .update(conversations)
          .set({ title, updatedAt: new Date() })
          .where(
            and(eq(conversations.id, titleConversationId), eq(conversations.userId, ctx.userId)),
          )
      }

      const doneChunk: StreamChunk = {
        type: STREAM_EVENTS.DONE,
        usage,
      }
      yield doneChunk
    } catch (err) {
      if (err instanceof TRPCError) {
        // Re-throw user-facing errors (4xx) unchanged; sanitize any internal errors
        if (err.code !== TRPC_CODES.INTERNAL_SERVER_ERROR) throw err
        console.error('[chat.stream] Internal error:', err.message)
        throw new TRPCError({
          code: TRPC_CODES.INTERNAL_SERVER_ERROR,
          message: AppError.CHAT_PROCESSING,
        })
      }

      if (err instanceof Error) {
        console.error('[chat.stream]', err.message)
      }
      const errorChunk: StreamChunk = {
        type: STREAM_EVENTS.ERROR,
        message: AppError.CHAT_PROCESSING,
      }
      yield errorChunk
    }
  }),
})

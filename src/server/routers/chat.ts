import { and, eq, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, rateLimitedChatProcedure } from '../trpc'
import { ChatInputSchema, MessageMetadataSchema } from '@/schemas/message'
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
  DEFAULT_MODEL,
} from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import type { StreamChunk } from '@/schemas/message'

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type OAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentBlock[] }
  | { role: 'assistant'; content: string }

export const chatRouter = router({
  stream: rateLimitedChatProcedure
    .input(ChatInputSchema)
    .subscription(async function* ({ ctx, input, signal }) {
      let conversationId = input.conversationId
      let isNewConversation = false

      try {
        if (!conversationId) {
          isNewConversation = true
          const [created] = await ctx.db
            .insert(conversations)
            .values({ userId: ctx.userId, model: input.model })
            .returning()
          if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
          conversationId = created.id
        } else {
          const [conv] = await ctx.db
            .select({ id: conversations.id })
            .from(conversations)
            .where(
              and(
                eq(conversations.id, conversationId),
                eq(conversations.userId, ctx.userId),
              ),
            )
            .limit(1)
          if (!conv) throw new TRPCError({ code: 'NOT_FOUND' })
        }

        const [userMessage] = await ctx.db
          .insert(messages)
          .values({
            conversationId,
            role: 'user',
            content: input.content,
          })
          .returning()
        if (!userMessage) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })

        if (input.attachmentIds.length > 0) {
          const owned = await ctx.db
            .select({ id: attachments.id })
            .from(attachments)
            .where(
              and(
                inArray(attachments.id, input.attachmentIds),
                eq(attachments.userId, ctx.userId),
              ),
            )
          const ownedIds = new Set(owned.map((a) => a.id))
          const unauthorized = input.attachmentIds.filter(
            (id) => !ownedIds.has(id),
          )
          if (unauthorized.length > 0) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Attachment not found or access denied.',
            })
          }
          await ctx.db
            .update(attachments)
            .set({ messageId: userMessage.id })
            .where(
              and(
                inArray(attachments.id, input.attachmentIds),
                eq(attachments.userId, ctx.userId),
              ),
            )
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
          const selection = await routeModel(input.content)
          if (registry.some((m) => m.id === selection.selectedModel)) {
            selectedModel = selection.selectedModel
            routerReasoning = selection.reasoning
          } else {
            selectedModel = DEFAULT_MODEL
            routerReasoning = AI_REASONING.ROUTING_FALLBACK
          }

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
              code: 'BAD_REQUEST',
              message: 'Invalid model selection.',
            })
          }
          const modelChunk: StreamChunk = {
            type: STREAM_EVENTS.MODEL_SELECTED,
            model: selectedModel,
            reasoning: AI_REASONING.MODEL_EXPLICIT,
          }
          yield modelChunk
        }

        let userContent: string | ContentBlock[] = input.content
        if (input.attachmentIds.length > 0) {
          const statusChunk: StreamChunk = {
            type: STREAM_EVENTS.STATUS,
            phase: STREAM_PHASES.READING_FILES,
            message: STATUS_MESSAGES.READING_FILES,
          }
          yield statusChunk

          const blocks: ContentBlock[] = [{ type: 'text', text: input.content }]
          const attachmentRows = await ctx.db
            .select()
            .from(attachments)
            .where(
              and(
                inArray(attachments.id, input.attachmentIds),
                eq(attachments.userId, ctx.userId),
              ),
            )
          for (const att of attachmentRows) {
            if (att.fileType.startsWith('image/')) {
              blocks.push({
                type: 'image_url',
                image_url: { url: att.storageUrl },
              })
            } else {
              blocks.push({
                type: 'text',
                text: `[Attachment: ${att.fileName} — ${att.fileType}]`,
              })
            }
          }
          userContent = blocks
        }

        let searchContext = ''
        let searchResults: SearchResult[] = []
        let searchImages: SearchImage[] = []
        if (input.mode === CHAT_MODES.SEARCH) {
          const toolStartChunk: StreamChunk = {
            type: STREAM_EVENTS.TOOL_START,
            toolName: TOOL_NAMES.WEB_SEARCH,
            input: { query: input.content },
          }
          yield toolStartChunk

          const { tavilySearch } = await import('@/lib/search/tavily')
          const response = await tavilySearch({
            query: input.content,
            maxResults: LIMITS.SEARCH_MAX_RESULTS,
            includeImages: true,
            searchDepth: 'basic',
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

        const systemContent = PROMPTS.CHAT_SYSTEM_PROMPT + '\n\n' + PROMPTS.A2UI_SYSTEM_PROMPT + searchContext
        const oaiMessages: OAIMessage[] = [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ]

        const { openrouter } = await import('@/lib/ai/client')
        const stream = await openrouter.chat.completions.create(
          {
            model: selectedModel,
            messages: oaiMessages,
            stream: true,
            max_tokens: AI_PARAMS.CHAT_MAX_TOKENS,
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

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta
          if (!delta) continue

          // justified: OpenRouter thinking tokens are not in the standard OpenAI delta type
          const deltaAsRecord = delta as Record<string, unknown>
          if (
            typeof deltaAsRecord['thinking'] === 'string' &&
            deltaAsRecord['thinking']
          ) {
            if (!thinkingStartedAt) thinkingStartedAt = Date.now()
            thinkingContent += deltaAsRecord['thinking']
            const thinkTokenChunk: StreamChunk = {
              type: STREAM_EVENTS.THINKING,
              content: deltaAsRecord['thinking'] as string,
              isComplete: false,
            }
            yield thinkTokenChunk
            continue
          }

          if (delta.content) {
            const text = delta.content

            if (text.includes('```a2ui')) {
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
            if (inA2UI && text.includes('```')) {
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
          thinkingDurationMs = thinkingStartedAt
            ? Date.now() - thinkingStartedAt
            : undefined
          const thinkCompleteChunk: StreamChunk = {
            type: STREAM_EVENTS.THINKING,
            content: '',
            isComplete: true,
          }
          yield thinkCompleteChunk
        }

        const metadata = MessageMetadataSchema.parse({
          modelUsed: selectedModel,
          routerReasoning,
          thinkingContent: thinkingContent || undefined,
          thinkingDurationMs,
          searchQuery: input.mode === CHAT_MODES.SEARCH ? input.content : undefined,
          searchResults: searchResults.length > 0 ? searchResults : undefined,
          searchImages: searchImages.length > 0 ? searchImages : undefined,
          a2uiMessages: a2uiLines.length > 0 ? a2uiLines : undefined,
        })

        await ctx.db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: fullText,
          metadata,
        })

        await ctx.db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.userId, ctx.userId),
            ),
          )

        if (isNewConversation) {
          const titleConversationId = conversationId
          void (async () => {
            if (!titleConversationId) return
            try {
              const { generateTitle } = await import('@/lib/ai/title')
              const title = await generateTitle(input.content)
              await ctx.db
                .update(conversations)
                .set({ title, updatedAt: new Date() })
                .where(
                  and(
                    eq(conversations.id, titleConversationId),
                    eq(conversations.userId, ctx.userId),
                  ),
                )
            } catch {
              // Non-critical: title generation failure does not affect the chat
            }
          })()
        }

        const doneChunk: StreamChunk = {
          type: STREAM_EVENTS.DONE,
          usage: undefined,
        }
        yield doneChunk
      } catch (err) {
        if (err instanceof TRPCError) throw err

        const isDev = process.env.NODE_ENV === 'development'
        if (err instanceof Error) {
          console.error('[chat.stream]', isDev ? err : err.message)
        }
        const errorChunk: StreamChunk = {
          type: STREAM_EVENTS.ERROR,
          message: 'An error occurred while processing your request.',
        }
        yield errorChunk
      }
    }),
})

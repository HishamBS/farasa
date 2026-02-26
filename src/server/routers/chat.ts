import { and, eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { ChatInputSchema, MessageMetadataSchema } from '@/schemas/message'
import { conversations, messages, attachments } from '@/lib/db/schema'
import {
  STREAM_EVENTS,
  STREAM_PHASES,
  STATUS_MESSAGES,
  CHAT_MODES,
  TOOL_NAMES,
} from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import type { StreamChunk } from '@/schemas/message'

export const chatRouter = router({
  stream: protectedProcedure
    .input(ChatInputSchema)
    .subscription(async function* ({ ctx, input, signal }) {
      let conversationId = input.conversationId
      let isNewConversation = false

      try {
        // 1. Create conversation if needed
        if (!conversationId) {
          isNewConversation = true
          const [created] = await ctx.db
            .insert(conversations)
            .values({ userId: ctx.userId, model: input.model })
            .returning()
          if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
          conversationId = created.id
        } else {
          // Verify ownership
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

        // 2. Persist user message
        const [userMessage] = await ctx.db
          .insert(messages)
          .values({
            conversationId,
            role: 'user',
            content: input.content,
          })
          .returning()
        if (!userMessage) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })

        // 3. Link pending attachments
        if (input.attachmentIds.length > 0) {
          for (const attachmentId of input.attachmentIds) {
            const [att] = await ctx.db
              .select({ id: attachments.id })
              .from(attachments)
              .where(eq(attachments.id, attachmentId))
              .limit(1)
            if (att) {
              await ctx.db
                .update(attachments)
                .set({ messageId: userMessage.id })
                .where(eq(attachments.id, attachmentId))
            }
          }
        }

        // 4. Auto-route model selection (skip if model explicitly provided)
        let selectedModel = input.model
        let routerReasoning: string | undefined

        if (!selectedModel) {
          const chunk: StreamChunk = {
            type: STREAM_EVENTS.STATUS,
            phase: STREAM_PHASES.ROUTING,
            message: STATUS_MESSAGES.ROUTING,
          }
          yield chunk

          const { routeModel } = await import('@/lib/ai/router')
          const selection = await routeModel(input.content)
          selectedModel = selection.selectedModel
          routerReasoning = selection.reasoning

          const modelChunk: StreamChunk = {
            type: STREAM_EVENTS.MODEL_SELECTED,
            model: selectedModel,
            reasoning: selection.reasoning,
          }
          yield modelChunk
        } else {
          const modelChunk: StreamChunk = {
            type: STREAM_EVENTS.MODEL_SELECTED,
            model: selectedModel,
            reasoning: 'Model explicitly specified by user.',
          }
          yield modelChunk
        }

        // 5. Process attachments for multimodal content
        type ContentBlock =
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }

        let userContent: string | ContentBlock[] = input.content
        if (input.attachmentIds.length > 0) {
          const statusChunk: StreamChunk = {
            type: STREAM_EVENTS.STATUS,
            phase: STREAM_PHASES.READING_FILES,
            message: STATUS_MESSAGES.READING_FILES,
          }
          yield statusChunk

          const blocks: ContentBlock[] = [{ type: 'text', text: input.content }]
          for (const attachmentId of input.attachmentIds) {
            const [att] = await ctx.db
              .select()
              .from(attachments)
              .where(eq(attachments.id, attachmentId))
              .limit(1)
            if (att) {
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
          }
          userContent = blocks
        }

        // 6. Search mode
        let searchContext = ''
        let searchResults: unknown[] = []
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
            maxResults: 5,
            includeImages: false,
            searchDepth: 'basic',
          })
          searchResults = response.results

          const toolResultChunk: StreamChunk = {
            type: STREAM_EVENTS.TOOL_RESULT,
            toolName: TOOL_NAMES.WEB_SEARCH,
            result: response.results,
          }
          yield toolResultChunk

          searchContext =
            '\n\nSearch results:\n' +
            response.results
              .map((r) => {
                const result = r as { title: string; url: string; snippet: string }
                return `- ${result.title}: ${result.snippet} (${result.url})`
              })
              .join('\n')
        }

        // 7. Thinking status
        const thinkingChunk: StreamChunk = {
          type: STREAM_EVENTS.STATUS,
          phase: STREAM_PHASES.THINKING,
          message: STATUS_MESSAGES.THINKING,
        }
        yield thinkingChunk

        // 8. Build messages for OpenRouter
        const systemContent = PROMPTS.CHAT_SYSTEM_PROMPT + searchContext
        type OAIMessage =
          | { role: 'system'; content: string }
          | { role: 'user'; content: string | ContentBlock[] }
          | { role: 'assistant'; content: string }

        const oaiMessages: OAIMessage[] = [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ]

        // 9. Stream from OpenRouter
        const { openrouter } = await import('@/lib/ai/client')
        const stream = await openrouter.chat.completions.create(
          {
            model: selectedModel,
            messages: oaiMessages,
            stream: true,
            max_tokens: 4096,
          },
          { signal },
        )

        let fullText = ''
        let thinkingContent = ''
        let thinkingStartedAt: number | null = null
        let thinkingDurationMs: number | undefined
        let a2uiLines: string[] = []
        let inA2UI = false

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta
          if (!delta) continue

          // Handle thinking tokens (Claude extended thinking)
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

            // Detect A2UI markers
            if (text.includes('```a2ui')) {
              inA2UI = true
              const a2uiStatusChunk: StreamChunk = {
                type: STREAM_EVENTS.STATUS,
                phase: STREAM_PHASES.GENERATING_UI,
                message: STATUS_MESSAGES.GENERATING_UI,
              }
              yield a2uiStatusChunk
              continue
            }
            if (inA2UI && text.includes('```')) {
              inA2UI = false
              continue
            }
            if (inA2UI) {
              for (const line of text.split('\n')) {
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

        // 10. Finalize thinking block
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

        // 11. Persist assistant message
        const metadata = MessageMetadataSchema.parse({
          modelUsed: selectedModel,
          routerReasoning,
          thinkingContent: thinkingContent || undefined,
          thinkingDurationMs,
          searchResults: searchResults.length > 0 ? searchResults : undefined,
          a2uiMessages: a2uiLines.length > 0 ? a2uiLines : undefined,
        })

        await ctx.db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: fullText,
          metadata,
        })

        // Update conversation updatedAt
        await ctx.db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId))

        // 12. Trigger title generation for new conversations
        if (isNewConversation) {
          void (async () => {
            try {
              const { generateTitle } = await import('@/lib/ai/title')
              const title = await generateTitle(input.content)
              await ctx.db
                .update(conversations)
                .set({ title, updatedAt: new Date() })
                .where(eq(conversations.id, conversationId!))
            } catch {
              // Non-critical: title generation failure doesn't affect the chat
            }
          })()
        }

        // 13. Done
        const doneChunk: StreamChunk = {
          type: STREAM_EVENTS.DONE,
          usage: undefined,
        }
        yield doneChunk
      } catch (err) {
        if (err instanceof TRPCError) throw err

        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        const errorChunk: StreamChunk = {
          type: STREAM_EVENTS.ERROR,
          message,
        }
        yield errorChunk
      }
    }),
})

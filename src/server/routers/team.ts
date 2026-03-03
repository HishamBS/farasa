import {
  AI_REASONING,
  CHAT_MODES,
  TEAM_EVENTS,
  MESSAGE_ROLES,
  NEW_CHAT_TITLE,
  STREAM_EVENTS,
  STREAM_PHASES,
  TRPC_CODES,
} from '@/config/constants'
import { conversations, messages } from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/utils/errors'
import type { TeamOutputChunk, TeamSynthesisOutputChunk } from '@/schemas/team'
import { TeamStreamInputSchema, TeamSynthesizeInputSchema } from '@/schemas/team'
import type { StreamChunk } from '@/schemas/message'
import { MessageMetadataSchema } from '@/schemas/message'
import type { SearchImage, SearchResult } from '@/schemas/search'
import { executeSearchEnrichment } from '@/server/services/search-enrichment-service'
import type { ChatMessageContentItem, Message } from '@openrouter/sdk/models'
import { ChatMessageContentItemTextType } from '@openrouter/sdk/models'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, sql } from 'drizzle-orm'
import { rateLimitedChatProcedure, router } from '../trpc'

type QueueItem =
  | { done: false; modelId: string; modelIndex: number; chunk: StreamChunk }
  | { done: true; modelId: string }

type ModelStreamOutcome = {
  content: string
  error?: string
}

export const teamRouter = router({
  stream: rateLimitedChatProcedure.input(TeamStreamInputSchema).subscription(async function* ({
    ctx,
    input,
    signal,
  }): AsyncGenerator<TeamOutputChunk> {
    const runtimeConfig = ctx.runtimeConfig

    const { getModelRegistry, getModelMaxCompletionTokens } = await import('@/lib/ai/registry')
    const registry = await getModelRegistry({ runtimeConfig })

    for (const modelId of input.models) {
      if (!registry.some((m) => m.id === modelId)) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `Invalid model ID: ${modelId}`,
        })
      }
    }

    const streamRequestId = crypto.randomUUID()

    let conversationId = input.conversationId

    try {
      if (!conversationId) {
        const [created] = await ctx.db
          .insert(conversations)
          .values({
            userId: ctx.userId,
            model: input.models[0],
            mode: CHAT_MODES.TEAM,
            webSearchEnabled: input.webSearchEnabled,
          })
          .returning({ id: conversations.id })
        if (!created) {
          throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
        }
        conversationId = created.id
        yield {
          type: TEAM_EVENTS.STREAM_EVENT,
          chunk: {
            type: STREAM_EVENTS.CONVERSATION_CREATED,
            streamRequestId,
            conversationId: created.id,
          } satisfies StreamChunk,
        }
      }

      const [conversation] = await ctx.db
        .select({ id: conversations.id, title: conversations.title })
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
      }

      const userMessageClientId = crypto.randomUUID()
      const [existingUserMessage] = await ctx.db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.role, MESSAGE_ROLES.USER),
            eq(messages.clientRequestId, userMessageClientId),
          ),
        )
        .limit(1)

      let userMessageId: string
      if (existingUserMessage) {
        userMessageId = existingUserMessage.id
      } else {
        const [createdUserMessage] = await ctx.db
          .insert(messages)
          .values({
            conversationId,
            role: MESSAGE_ROLES.USER,
            content: input.content,
            clientRequestId: userMessageClientId,
          })
          .returning({ id: messages.id })
        if (!createdUserMessage) {
          throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
        }
        userMessageId = createdUserMessage.id
      }

      yield {
        type: TEAM_EVENTS.STREAM_EVENT,
        chunk: {
          type: STREAM_EVENTS.USER_MESSAGE_SAVED,
          streamRequestId,
          messageId: userMessageId,
        } satisfies StreamChunk,
      }

      let userContent: string | ChatMessageContentItem[] = input.content
      if (input.attachmentIds.length > 0) {
        const { linkAttachmentsToMessage, buildAttachmentBlocks } =
          await import('@/server/services/history-builder')
        const attachmentRows = await linkAttachmentsToMessage(
          ctx.db,
          ctx.userId,
          input.attachmentIds,
          userMessageId,
        )

        if (attachmentRows.length > 0) {
          userContent = [
            { type: ChatMessageContentItemTextType.Text, text: input.content },
            ...buildAttachmentBlocks(attachmentRows),
          ]
        }
      }

      const teamId = crypto.randomUUID()
      let searchContext = ''
      let searchResults: SearchResult[] = []
      let searchImages: SearchImage[] = []

      await ctx.db
        .update(conversations)
        .set({
          mode: CHAT_MODES.TEAM,
          webSearchEnabled: input.webSearchEnabled,
          updatedAt: new Date(),
        })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))

      if (input.webSearchEnabled) {
        if (!runtimeConfig.features.searchEnabled) {
          throw new TRPCError({
            code: TRPC_CODES.BAD_REQUEST,
            message: runtimeConfig.chat.errors.processing,
          })
        }

        yield {
          type: TEAM_EVENTS.STREAM_EVENT,
          chunk: {
            type: STREAM_EVENTS.STATUS,
            streamRequestId,
            phase: STREAM_PHASES.SEARCHING,
            message: runtimeConfig.chat.statusMessages.searching,
          } satisfies StreamChunk,
        }
        const searchToolName = runtimeConfig.search.toolName
        yield {
          type: TEAM_EVENTS.STREAM_EVENT,
          chunk: {
            type: STREAM_EVENTS.TOOL_START,
            streamRequestId,
            toolName: searchToolName,
            input: { query: input.content },
          } satisfies StreamChunk,
        }

        const enrichment = await executeSearchEnrichment(input.content, runtimeConfig)
        searchContext = enrichment.context
        searchResults = enrichment.results
        searchImages = enrichment.images

        yield {
          type: TEAM_EVENTS.STREAM_EVENT,
          chunk: {
            type: STREAM_EVENTS.TOOL_RESULT,
            streamRequestId,
            toolName: searchToolName,
            result: {
              query: enrichment.query,
              results: enrichment.results,
              images: enrichment.images,
            },
          } satisfies StreamChunk,
        }
      }

      const { buildEnrichedHistory } = await import('@/server/services/history-builder')
      const historyMessages = await buildEnrichedHistory(ctx.db, conversationId)

      const systemPrompt = searchContext
        ? `${runtimeConfig.prompts.chatSystem}\n\n${searchContext}`
        : runtimeConfig.prompts.chatSystem
      const sdkMessages: Message[] = [
        { role: MESSAGE_ROLES.SYSTEM, content: systemPrompt },
        ...historyMessages,
        { role: MESSAGE_ROLES.USER, content: userContent },
      ]

      const { openrouter } = await import('@/lib/ai/client')

      const queue: QueueItem[] = []
      let resolver: (() => void) | null = null

      const push = (item: QueueItem): void => {
        queue.push(item)
        if (resolver) {
          resolver()
          resolver = null
        }
      }

      const next = (): Promise<void> => {
        if (queue.length > 0) return Promise.resolve()
        return new Promise<void>((r) => {
          resolver = r
        })
      }

      const modelOutcomes: Map<string, ModelStreamOutcome> = new Map()

      const spawnModelStream = async (modelId: string, modelIndex: number): Promise<void> => {
        try {
          const modelStreamRequestId = crypto.randomUUID()
          push({
            done: false,
            modelId,
            modelIndex,
            chunk: {
              type: STREAM_EVENTS.MODEL_SELECTED,
              streamRequestId: modelStreamRequestId,
              model: modelId,
              reasoning: AI_REASONING.MODEL_EXPLICIT,
              source: 'explicit_request',
              confidence: 1,
              factors: [
                {
                  key: 'selection_source',
                  label: 'Selection Source',
                  value: 'explicit_request',
                },
              ],
            } satisfies StreamChunk,
          })
          const stream = await openrouter.chat.send(
            {
              chatGenerationParams: {
                model: modelId,
                messages: sdkMessages,
                stream: true,
                maxCompletionTokens: getModelMaxCompletionTokens(registry, modelId),
              },
            },
            { signal: signal ?? undefined },
          )

          let fullText = ''
          let thinkingStatusEmitted = false
          for await (const streamChunk of stream) {
            const delta = streamChunk.choices[0]?.delta
            if (!delta) continue

            if (delta.reasoning) {
              if (!thinkingStatusEmitted) {
                push({
                  done: false,
                  modelId,
                  modelIndex,
                  chunk: {
                    type: STREAM_EVENTS.STATUS,
                    streamRequestId: modelStreamRequestId,
                    phase: STREAM_PHASES.THINKING,
                    message: runtimeConfig.chat.statusMessages.thinking,
                  } satisfies StreamChunk,
                })
                thinkingStatusEmitted = true
              }
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.THINKING,
                  streamRequestId: modelStreamRequestId,
                  content: delta.reasoning,
                  isComplete: false,
                } satisfies StreamChunk,
              })
            }

            if (delta.content) {
              fullText += delta.content
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TEXT,
                  content: delta.content,
                  streamRequestId: modelStreamRequestId,
                  attempt: 0,
                } satisfies StreamChunk,
              })
            }
          }

          push({
            done: false,
            modelId,
            modelIndex,
            chunk: {
              type: STREAM_EVENTS.THINKING,
              streamRequestId: modelStreamRequestId,
              content: '',
              isComplete: true,
            } satisfies StreamChunk,
          })
          push({
            done: false,
            modelId,
            modelIndex,
            chunk: {
              type: STREAM_EVENTS.DONE,
              streamRequestId: modelStreamRequestId,
            } satisfies StreamChunk,
          })

          if (fullText.trim().length === 0) {
            const errorMessage = runtimeConfig.chat.errors.processing
            push({
              done: false,
              modelId,
              modelIndex,
              chunk: {
                type: STREAM_EVENTS.ERROR,
                streamRequestId: modelStreamRequestId,
                message: errorMessage,
                recoverable: false,
              } satisfies StreamChunk,
            })
            modelOutcomes.set(modelId, { content: '', error: errorMessage })
            push({ done: true, modelId })
            return
          }

          modelOutcomes.set(modelId, { content: fullText })
        } catch (error) {
          const errorMessage = getErrorMessage(error, runtimeConfig.chat.errors.providerUnavailable)
          push({
            done: false,
            modelId,
            modelIndex,
            chunk: {
              type: STREAM_EVENTS.ERROR,
              streamRequestId: crypto.randomUUID(),
              message: errorMessage,
              recoverable: false,
            } satisfies StreamChunk,
          })
          modelOutcomes.set(modelId, { content: '', error: errorMessage })
        }
        push({ done: true, modelId })
      }

      for (let i = 0; i < input.models.length; i++) {
        const modelId = input.models[i]
        if (modelId !== undefined) {
          void spawnModelStream(modelId, i)
        }
      }

      let completedCount = 0
      while (completedCount < input.models.length) {
        if (queue.length === 0) {
          await next()
        }
        const item = queue.shift()
        if (!item) continue
        if (item.done) {
          completedCount++
          continue
        }
        yield {
          type: TEAM_EVENTS.MODEL_CHUNK,
          modelId: item.modelId,
          modelIndex: item.modelIndex,
          chunk: item.chunk,
        }
      }

      const successfulModels: string[] = []
      for (const modelId of input.models) {
        const content = modelOutcomes.get(modelId)?.content.trim() ?? ''
        if (content.length === 0) {
          continue
        }
        successfulModels.push(modelId)
        const metadata = MessageMetadataSchema.parse({
          teamId,
          modelUsed: modelId,
          userMessageId,
          requiresSearch: input.webSearchEnabled,
          searchQuery: input.webSearchEnabled ? input.content : undefined,
          searchResults: searchResults.length > 0 ? searchResults : undefined,
          searchImages: searchImages.length > 0 ? searchImages : undefined,
        })
        await ctx.db.insert(messages).values({
          conversationId,
          role: MESSAGE_ROLES.ASSISTANT,
          content,
          metadata,
        })
      }

      if (successfulModels.length === 0) {
        throw new TRPCError({
          code: TRPC_CODES.INTERNAL_SERVER_ERROR,
          message: runtimeConfig.chat.errors.processing,
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
          try {
            const { generateTitle } = await import('@/lib/ai/title')
            const generatedTitle = await generateTitle(
              titleSeedMessage,
              runtimeConfig,
              signal ?? undefined,
            )
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
            // Title generation failure is non-fatal
          }
        }
      }

      yield {
        type: TEAM_EVENTS.DONE,
        teamId,
        completedModels: input.models,
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'An unexpected error occurred')
      yield {
        type: TEAM_EVENTS.STREAM_EVENT,
        chunk: {
          type: STREAM_EVENTS.ERROR,
          streamRequestId,
          message,
          recoverable: false,
        } satisfies StreamChunk,
      }
    }
  }),

  synthesize: rateLimitedChatProcedure
    .input(TeamSynthesizeInputSchema)
    .subscription(async function* ({
      ctx,
      input,
      signal,
    }): AsyncGenerator<TeamSynthesisOutputChunk> {
      const runtimeConfig = ctx.runtimeConfig
      const { getModelRegistry, getModelMaxCompletionTokens } = await import('@/lib/ai/registry')
      const registry = await getModelRegistry({ runtimeConfig })

      if (!registry.some((m) => m.id === input.synthesisModel)) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `Invalid model ID: ${input.synthesisModel}`,
        })
      }

      const [conversation] = await ctx.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)),
        )
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
      }

      const filteredTeamMessages = await ctx.db
        .select({ role: messages.role, content: messages.content, metadata: messages.metadata })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, input.conversationId),
            eq(messages.role, MESSAGE_ROLES.ASSISTANT),
            sql`${messages.metadata}->>'teamId' = ${input.teamId}`,
            sql`(${messages.metadata}->>'isTeamSynthesis') IS DISTINCT FROM 'true'`,
          ),
        )
        .orderBy(asc(messages.createdAt))

      if (filteredTeamMessages.length === 0) {
        throw new TRPCError({
          code: TRPC_CODES.NOT_FOUND,
          message: 'No team messages found',
        })
      }

      const comparisonModelIds = new Set(
        filteredTeamMessages
          .map((message) => message.metadata?.modelUsed)
          .filter(
            (modelId): modelId is string => typeof modelId === 'string' && modelId.length > 0,
          ),
      )

      if (comparisonModelIds.has(input.synthesisModel)) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: 'Synthesis model must be different from selected team models.',
        })
      }

      const storedUserMessageId = filteredTeamMessages[0]?.metadata?.userMessageId ?? null

      let userMessageContent = ''
      if (storedUserMessageId) {
        const [userMsg] = await ctx.db
          .select({ content: messages.content })
          .from(messages)
          .where(
            and(
              eq(messages.id, storedUserMessageId),
              eq(messages.conversationId, input.conversationId),
            ),
          )
          .limit(1)
        userMessageContent = userMsg?.content ?? ''
      }

      const modelResponsesXml = filteredTeamMessages
        .map((m) => {
          const modelId = m.metadata?.modelUsed ?? 'unknown'
          return `<model_response model="${modelId}">\n${m.content}\n</model_response>`
        })
        .join('\n\n')

      const synthesisPrompt = `You are synthesizing responses from multiple AI models.
The user asked: <user_request>${userMessageContent}</user_request>

Here are the responses from each model:

${modelResponsesXml}

Your task: write a single unified response that combines the strongest elements from all responses above. Do not mention which model said what. Write as if you are giving the definitive best answer.`

      const { openrouter } = await import('@/lib/ai/client')

      const stream = await openrouter.chat.send(
        {
          chatGenerationParams: {
            model: input.synthesisModel,
            messages: [{ role: MESSAGE_ROLES.USER, content: synthesisPrompt }],
            stream: true,
            maxCompletionTokens: getModelMaxCompletionTokens(registry, input.synthesisModel),
          },
        },
        { signal: signal ?? undefined },
      )

      let synthesisText = ''
      for await (const streamChunk of stream) {
        const delta = streamChunk.choices[0]?.delta
        if (!delta?.content) continue
        synthesisText += delta.content
        yield {
          type: TEAM_EVENTS.SYNTHESIS_CHUNK,
          content: delta.content,
        }
      }

      const synthesisMetadata = MessageMetadataSchema.parse({
        teamId: input.teamId,
        isTeamSynthesis: true,
        modelUsed: input.synthesisModel,
      })

      await ctx.db.insert(messages).values({
        conversationId: input.conversationId,
        role: MESSAGE_ROLES.ASSISTANT,
        content: synthesisText,
        metadata: synthesisMetadata,
      })

      await ctx.db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(
          and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)),
        )

      yield {
        type: TEAM_EVENTS.SYNTHESIS_DONE,
        teamId: input.teamId,
      }
    }),
})

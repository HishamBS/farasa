import {
  AI_REASONING,
  CHAT_MODES,
  LIMITS,
  MESSAGE_ROLES,
  MODEL_SELECTION_SOURCES,
  NEW_CHAT_TITLE,
  STATUS_MESSAGES,
  STREAM_EVENTS,
  STREAM_PHASES,
  TEAM_EVENTS,
  TEAM_LIMITS,
  TRPC_CODES,
} from '@/config/constants'
import { conversations, messages } from '@/lib/db/schema'
import { AppError, getErrorMessage } from '@/lib/utils/errors'
import type { StreamChunk } from '@/schemas/message'
import { MessageMetadataSchema } from '@/schemas/message'
import type { SearchImage, SearchResult } from '@/schemas/search'
import type { TeamOutputChunk, TeamSynthesisOutputChunk } from '@/schemas/team'
import {
  TeamPolicyInputSchema,
  TeamStreamInputSchema,
  TeamSynthesizeInputSchema,
} from '@/schemas/team'
import {
  createConversation,
  findConversation,
  updateConversationSettings,
} from '@/server/services/conversation-service'
import {
  persistUserMessage,
  persistAssistantMessage,
} from '@/server/services/message-persistence-service'
import { mergeSearchImages, mergeSearchResults } from '@/server/services/search-tool-service'
import { executeSearchEnrichment } from '@/server/services/search-enrichment-service'
import { streamSessions } from '@/server/services/stream-session-service'
import type { StreamSession } from '@/server/services/stream-session-service'
import {
  accumulateToolCallDelta,
  buildRoundToolCalls,
  buildUnsupportedToolResponse,
  executeSearchToolCall,
} from '@/server/services/tool-execution-service'
import type { AttachmentRow } from '@/server/services/history-builder'
import type { Message } from '@openrouter/sdk/models'
import { ToolChoiceOptionAuto } from '@openrouter/sdk/models'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { rateLimitedChatProcedure, router } from '../trpc'

type QueueItem =
  | { done: false; modelId: string; modelIndex: number; chunk: StreamChunk }
  | { done: true; modelId: string }

type ModelStreamOutcome = {
  content: string
  searchResults: SearchResult[]
  searchImages: SearchImage[]
  toolCalls: Array<{
    name: string
    input: unknown
    result: unknown
    durationMs?: number
  }>
  error?: string
}

type TeamPolicyModelOption = {
  id: string
  name: string
  provider: string
  selected: boolean
  selectable: boolean
  reasonCode?: string
}

function buildDeterministicClientRequestId(seed: string): string {
  const bytes = Array.from(createHash('sha256').update(seed).digest().subarray(0, 16))
  const b6 = bytes[6]
  const b8 = bytes[8]
  if (typeof b6 !== 'number' || typeof b8 !== 'number') {
    throw new TRPCError({
      code: TRPC_CODES.INTERNAL_SERVER_ERROR,
      message: 'Unable to derive deterministic request id.',
    })
  }
  bytes[6] = (b6 & 0x0f) | 0x40
  bytes[8] = (b8 & 0x3f) | 0x80
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function buildTeamPolicy(
  registry: ReadonlyArray<{ id: string; name: string; provider: string }>,
  input: {
    selectedModelIds: string[]
  },
) {
  const selectedSet = new Set<string>()
  const normalizedSelectedModelIds: string[] = []
  for (const modelId of input.selectedModelIds) {
    if (selectedSet.has(modelId)) continue
    if (!registry.some((model) => model.id === modelId)) continue
    if (normalizedSelectedModelIds.length >= TEAM_LIMITS.MAX_MODELS) continue
    selectedSet.add(modelId)
    normalizedSelectedModelIds.push(modelId)
  }

  const selectedCount = normalizedSelectedModelIds.length
  const teamModelOptions: TeamPolicyModelOption[] = registry.map((model) => {
    const selected = selectedSet.has(model.id)
    if (selected) {
      const selectable = selectedCount > TEAM_LIMITS.MIN_MODELS
      return {
        id: model.id,
        name: model.name,
        provider: model.provider,
        selected: true,
        selectable,
        ...(selectable ? {} : { reasonCode: 'min_models_required' }),
      }
    }

    const selectable = selectedCount < TEAM_LIMITS.MAX_MODELS
    return {
      id: model.id,
      name: model.name,
      provider: model.provider,
      selected: false,
      selectable,
      ...(selectable ? {} : { reasonCode: 'max_models_reached' }),
    }
  })

  const synthesisModelOptions = registry
    .filter((model) => !selectedSet.has(model.id))
    .map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
    }))

  return {
    minModels: TEAM_LIMITS.MIN_MODELS,
    maxModels: TEAM_LIMITS.MAX_MODELS,
    normalizedSelectedModelIds,
    teamModelOptions,
    synthesisModelOptions,
  }
}

export const teamRouter = router({
  policy: rateLimitedChatProcedure.input(TeamPolicyInputSchema).query(async ({ ctx, input }) => {
    const { getModelRegistry } = await import('@/lib/ai/registry')
    const registry = await getModelRegistry({
      runtimeConfig: ctx.runtimeConfig,
      userId: ctx.userId,
    })
    return buildTeamPolicy(registry, input)
  }),

  stream: rateLimitedChatProcedure.input(TeamStreamInputSchema).subscription(async function* ({
    ctx,
    input,
    signal,
  }): AsyncGenerator<TeamOutputChunk> {
    const runtimeConfig = ctx.runtimeConfig

    const { getModelRegistry, getModelMaxCompletionTokens } = await import('@/lib/ai/registry')
    const registry = await getModelRegistry({ runtimeConfig })

    for (const modelId of input.models) {
      const model = registry.find((entry) => entry.id === modelId)
      if (!model) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `${AppError.MODEL_NOT_FOUND}: ${modelId}`,
        })
      }
      if (input.webSearchEnabled && !model.supportsTools) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `${AppError.INVALID_MODEL_FOR_SEARCH}: ${modelId}`,
        })
      }
    }

    const streamRequestId = input.clientRequestId ?? crypto.randomUUID()

    let conversationId = input.conversationId
    let streamSession: StreamSession | null = null

    try {
      if (!conversationId) {
        const created = await createConversation({
          db: ctx.db,
          userId: ctx.userId,
          model: input.models[0],
          mode: CHAT_MODES.TEAM,
          webSearchEnabled: input.webSearchEnabled,
          teamModels: input.models,
        })
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

      const conversation = await findConversation({
        db: ctx.db,
        conversationId,
        userId: ctx.userId,
      })

      streamSession = streamSessions.begin({
        userId: ctx.userId,
        conversationId,
        streamRequestId,
      })

      const userResult = await persistUserMessage({
        db: ctx.db,
        conversationId,
        content: input.content,
        clientRequestId: streamRequestId,
      })
      const userMessageId = userResult.messageId

      yield {
        type: TEAM_EVENTS.STREAM_EVENT,
        chunk: {
          type: STREAM_EVENTS.USER_MESSAGE_SAVED,
          streamRequestId,
          messageId: userMessageId,
        } satisfies StreamChunk,
      }

      let linkedAttachmentRows: AttachmentRow[] = []
      if (input.attachmentIds.length > 0) {
        const { linkAttachmentsToMessage } = await import('@/server/services/history-builder')
        linkedAttachmentRows = await linkAttachmentsToMessage(
          ctx.db,
          ctx.userId,
          input.attachmentIds,
          userMessageId,
        )
      }

      const { buildUserContent } = await import('@/server/services/history-builder')
      const userContent = await buildUserContent(input.content, linkedAttachmentRows)

      const teamId = crypto.randomUUID()
      const searchToolName = runtimeConfig.search.toolName
      let searchContext = ''
      let searchResults: SearchResult[] = []
      let searchImages: SearchImage[] = []

      await updateConversationSettings({
        db: ctx.db,
        conversationId,
        userId: ctx.userId,
        settings: {
          model: input.models[0] ?? null,
          mode: CHAT_MODES.TEAM,
          webSearchEnabled: input.webSearchEnabled,
          teamModels: input.models,
        },
      })

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
      const historyMessages = await buildEnrichedHistory(ctx.db, conversationId, {
        excludeMessageIds: [userMessageId],
      })

      const systemPrompt = searchContext
        ? `${runtimeConfig.prompts.chatSystem}\n\n${searchContext}`
        : runtimeConfig.prompts.chatSystem
      const sdkMessages: Message[] = [
        { role: MESSAGE_ROLES.SYSTEM, content: systemPrompt },
        ...historyMessages,
        { role: MESSAGE_ROLES.USER, content: userContent },
      ]

      const { openrouter } = await import('@/lib/ai/client')
      const { ALL_TOOLS } = await import('@/lib/ai/tools')

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
              source: MODEL_SELECTION_SOURCES.EXPLICIT_REQUEST,
              confidence: 1,
              factors: [
                {
                  key: 'selection_source',
                  label: 'Selection Source',
                  value: MODEL_SELECTION_SOURCES.EXPLICIT_REQUEST,
                },
              ],
            } satisfies StreamChunk,
          })

          let fullText = ''
          let toolRoundCount = 0
          let thinkingStatusEmitted = false
          let modelSearchResults = [...searchResults]
          let modelSearchImages = [...searchImages]
          const modelToolCalls: ModelStreamOutcome['toolCalls'] = []
          const attemptMessages: Message[] = [...sdkMessages]
          const isImageGen =
            registry.find((m) => m.id === modelId)?.supportsImageGeneration ?? false

          if (isImageGen) {
            push({
              done: false,
              modelId,
              modelIndex,
              chunk: {
                type: STREAM_EVENTS.STATUS,
                streamRequestId: modelStreamRequestId,
                phase: STREAM_PHASES.GENERATING_IMAGE,
                message: STATUS_MESSAGES.GENERATING_IMAGE,
              } satisfies StreamChunk,
            })

            const imageGenMessages: Message[] = [
              ...historyMessages,
              { role: MESSAGE_ROLES.USER, content: userContent },
            ]
            const { executeImageGeneration } =
              await import('@/server/services/image-generation-service')
            const imageResult = await executeImageGeneration({
              model: modelId,
              messages: imageGenMessages,
              signal: signal ?? AbortSignal.timeout(LIMITS.IMAGE_GEN_TIMEOUT_MS),
              registry,
            })

            if (imageResult.imageContent.length > 0) {
              fullText = imageResult.imageContent
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TEXT,
                  content: imageResult.imageContent,
                  streamRequestId: modelStreamRequestId,
                  attempt: 0,
                } satisfies StreamChunk,
              })
            } else {
              console.error(`[team:image-gen] Model ${modelId} returned no image content`)
              fullText = AppError.IMAGE_GEN_EMPTY_RESULT
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.ERROR,
                  message: AppError.IMAGE_GEN_EMPTY_RESULT,
                  reasonCode: 'image_gen_empty_result',
                  recoverable: false,
                  attempt: 0,
                  streamRequestId: modelStreamRequestId,
                } satisfies StreamChunk,
              })
            }
          }

          while (!isImageGen) {
            const stream = await openrouter.chat.send(
              {
                chatGenerationParams: {
                  model: modelId,
                  messages: attemptMessages,
                  stream: true,
                  maxCompletionTokens: getModelMaxCompletionTokens(registry, modelId),
                  ...(input.webSearchEnabled
                    ? { tools: ALL_TOOLS, toolChoice: ToolChoiceOptionAuto.Auto }
                    : {}),
                },
              },
              { signal: signal ?? undefined },
            )

            const toolCallDeltas = new Map<
              number,
              { id?: string; name?: string; argsJson: string }
            >()
            let roundAssistantText = ''

            for await (const streamChunk of stream) {
              const delta = streamChunk.choices[0]?.delta
              if (!delta) continue

              if (delta.toolCalls && delta.toolCalls.length > 0) {
                for (const toolCallDelta of delta.toolCalls) {
                  accumulateToolCallDelta(toolCallDeltas, toolCallDelta)
                }
              }

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

              if (!delta.content) continue

              fullText += delta.content
              roundAssistantText += delta.content
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TEXT,
                  content: delta.content,
                  streamRequestId: modelStreamRequestId,
                  attempt: toolRoundCount,
                } satisfies StreamChunk,
              })
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

            const roundToolCalls = buildRoundToolCalls(toolCallDeltas)

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
                attemptMessages.push(buildUnsupportedToolResponse(call))
                continue
              }

              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TOOL_START,
                  streamRequestId: modelStreamRequestId,
                  toolName: searchToolName,
                  input: { query: input.content },
                } satisfies StreamChunk,
              })

              const searchResult = await executeSearchToolCall({
                call,
                searchToolName,
                fallbackQuery: input.content,
                runtimeConfig,
                existingResults: modelSearchResults,
                existingImages: modelSearchImages,
              })

              modelSearchResults = searchResult.mergedResults
              modelSearchImages = searchResult.mergedImages
              searchResults = mergeSearchResults(searchResults, searchResult.mergedResults)
              searchImages = mergeSearchImages(searchImages, searchResult.mergedImages)

              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TOOL_RESULT,
                  streamRequestId: modelStreamRequestId,
                  toolName: searchToolName,
                  result: searchResult.toolCallEntry.result,
                } satisfies StreamChunk,
              })

              modelToolCalls.push(searchResult.toolCallEntry)
              attemptMessages.push(searchResult.toolMessage)
            }

            toolRoundCount += 1
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
            modelOutcomes.set(modelId, {
              content: '',
              searchResults: modelSearchResults,
              searchImages: modelSearchImages,
              toolCalls: modelToolCalls,
              error: errorMessage,
            })
            push({ done: true, modelId })
            return
          }

          modelOutcomes.set(modelId, {
            content: fullText,
            searchResults: modelSearchResults,
            searchImages: modelSearchImages,
            toolCalls: modelToolCalls,
          })
        } catch (error) {
          console.error('[team.stream] model error:', getErrorMessage(error))
          const terminal = streamSessions.classifyTerminalError(runtimeConfig, error)
          push({
            done: false,
            modelId,
            modelIndex,
            chunk: {
              type: STREAM_EVENTS.ERROR,
              streamRequestId: crypto.randomUUID(),
              message: terminal.message,
              recoverable: terminal.recoverable,
            } satisfies StreamChunk,
          })
          modelOutcomes.set(modelId, {
            content: '',
            searchResults: [...searchResults],
            searchImages: [...searchImages],
            toolCalls: [],
            error: terminal.message,
          })
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
          teamId,
          modelId: item.modelId,
          modelIndex: item.modelIndex,
          chunk: item.chunk,
        }
      }

      const successfulModels: string[] = []
      for (const modelId of input.models) {
        const outcome = modelOutcomes.get(modelId)
        const content = outcome?.content.trim() ?? ''
        if (content.length === 0) {
          continue
        }
        successfulModels.push(modelId)
        const metadata = MessageMetadataSchema.parse({
          streamRequestId,
          teamId,
          modelUsed: modelId,
          userMessageId,
          requiresSearch: input.webSearchEnabled,
          searchQuery: input.webSearchEnabled ? input.content : undefined,
          searchResults:
            outcome && outcome.searchResults.length > 0 ? outcome.searchResults : undefined,
          searchImages:
            outcome && outcome.searchImages.length > 0 ? outcome.searchImages : undefined,
          toolCalls: outcome && outcome.toolCalls.length > 0 ? outcome.toolCalls : undefined,
        })
        const assistantClientRequestId = buildDeterministicClientRequestId(
          `${streamRequestId}:${modelId}:assistant`,
        )

        await persistAssistantMessage({
          db: ctx.db,
          conversationId,
          content,
          clientRequestId: assistantClientRequestId,
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

      yield {
        type: TEAM_EVENTS.PERSISTED,
        teamId,
        conversationId,
      }

      yield {
        type: TEAM_EVENTS.DONE,
        teamId,
        completedModels: input.models,
      }

      const shouldGenerateTitle = conversation.title === NEW_CHAT_TITLE
      if (shouldGenerateTitle) {
        const { generateAndPersistTitle } =
          await import('@/server/services/title-generation-service')
        const result = await generateAndPersistTitle({
          db: ctx.db,
          conversationId,
          userId: ctx.userId,
          currentTitle: conversation.title,
          fallbackContent: input.content,
          runtimeConfig,
        })
        if (result?.title) {
          yield {
            type: TEAM_EVENTS.STREAM_EVENT,
            chunk: {
              type: STREAM_EVENTS.TITLE_UPDATED,
              streamRequestId,
              title: result.title,
            } satisfies StreamChunk,
          }
        }
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, AppError.CHAT_PROCESSING)
      yield {
        type: TEAM_EVENTS.STREAM_EVENT,
        chunk: {
          type: STREAM_EVENTS.ERROR,
          streamRequestId,
          message,
          recoverable: false,
        } satisfies StreamChunk,
      }
    } finally {
      if (streamSession) {
        streamSessions.end(streamSession)
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

      const synthesisModelEntry = registry.find((m) => m.id === input.synthesisModel)
      if (!synthesisModelEntry) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `${AppError.MODEL_NOT_FOUND}: ${input.synthesisModel}`,
        })
      }
      if (synthesisModelEntry.supportsImageGeneration) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: AppError.IMAGE_GEN_INCOMPATIBLE,
        })
      }

      await findConversation({
        db: ctx.db,
        conversationId: input.conversationId,
        userId: ctx.userId,
      })

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
          message: AppError.SYNTHESIS_MODEL_CONFLICT,
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
        streamRequestId: crypto.randomUUID(),
        teamId: input.teamId,
        isTeamSynthesis: true,
        modelUsed: input.synthesisModel,
        userMessageId: storedUserMessageId ?? undefined,
      })

      const synthesisClientRequestId = buildDeterministicClientRequestId(
        `${input.teamId}:${input.synthesisModel}:synthesis`,
      )

      await persistAssistantMessage({
        db: ctx.db,
        conversationId: input.conversationId,
        content: synthesisText,
        clientRequestId: synthesisClientRequestId,
        metadata: synthesisMetadata,
      })

      await updateConversationSettings({
        db: ctx.db,
        conversationId: input.conversationId,
        userId: ctx.userId,
        settings: {
          teamSynthesizerModel: input.synthesisModel,
        },
      })

      yield {
        type: TEAM_EVENTS.SYNTHESIS_DONE,
        teamId: input.teamId,
      }
    }),
})

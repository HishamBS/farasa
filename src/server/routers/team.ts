import {
  AI_REASONING,
  CHAT_MODES,
  LIMITS,
  MESSAGE_ROLES,
  MODEL_SELECTION_SOURCES,
  NEW_CHAT_TITLE,
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
import { executeSearchEnrichment } from '@/server/services/search-enrichment-service'
import {
  mergeSearchImages,
  mergeSearchResults,
  parseSearchToolQuery,
} from '@/server/services/search-tool-service'
import type { ChatMessageToolCall, Message } from '@openrouter/sdk/models'
import { ToolChoiceOptionAuto } from '@openrouter/sdk/models'
import type { AttachmentRow } from '@/server/services/history-builder'
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
          message: `Invalid model ID: ${modelId}`,
        })
      }
      if (input.webSearchEnabled && !model.supportsTools) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `Model does not support web search tools: ${modelId}`,
        })
      }
    }

    const streamRequestId = input.clientRequestId ?? crypto.randomUUID()

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
            teamModels: input.models,
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

      const userMessageClientId = streamRequestId
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

      await ctx.db
        .update(conversations)
        .set({
          model: input.models[0] ?? null,
          mode: CHAT_MODES.TEAM,
          webSearchEnabled: input.webSearchEnabled,
          teamModels: input.models,
          settingsVersion: sql`${conversations.settingsVersion} + 1`,
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
            const imageGenMessages: Message[] = [
              ...historyMessages,
              { role: MESSAGE_ROLES.USER, content: userContent },
            ]
            const response = await openrouter.chat.send(
              {
                chatGenerationParams: {
                  model: modelId,
                  messages: imageGenMessages,
                  stream: false,
                  maxCompletionTokens: getModelMaxCompletionTokens(registry, modelId),
                },
              },
              { signal: signal ?? undefined },
            )

            const rawMessage = response.choices[0]?.message
            const messageRecord = rawMessage as Record<string, unknown> | undefined
            const messageContent = rawMessage?.content
            const messageImages = messageRecord?.images

            let imageContent = ''

            if (typeof messageContent === 'string' && messageContent.length > 0) {
              imageContent = messageContent
            }

            if (!imageContent && Array.isArray(messageImages)) {
              const parts: string[] = []
              for (const img of messageImages as Array<Record<string, unknown>>) {
                const nested = img?.imageUrl as Record<string, unknown> | undefined
                if (typeof nested?.url === 'string') {
                  parts.push(`![Generated Image](${nested.url})`)
                } else if (typeof img?.url === 'string') {
                  parts.push(`![Generated Image](${img.url})`)
                } else if (typeof img?.b64_json === 'string') {
                  parts.push(`![Generated Image](data:image/png;base64,${img.b64_json})`)
                }
              }
              imageContent = parts.join('\n\n')
            }

            if (imageContent.length > 0) {
              fullText = imageContent
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TEXT,
                  content: imageContent,
                  streamRequestId: modelStreamRequestId,
                  attempt: 0,
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
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TOOL_START,
                  streamRequestId: modelStreamRequestId,
                  toolName: searchToolName,
                  input: { query: toolQuery },
                } satisfies StreamChunk,
              })

              const enrichment = await executeSearchEnrichment(toolQuery, runtimeConfig)
              modelSearchResults = mergeSearchResults(modelSearchResults, enrichment.results)
              modelSearchImages = mergeSearchImages(modelSearchImages, enrichment.images)
              searchResults = mergeSearchResults(searchResults, enrichment.results)
              searchImages = mergeSearchImages(searchImages, enrichment.images)
              push({
                done: false,
                modelId,
                modelIndex,
                chunk: {
                  type: STREAM_EVENTS.TOOL_RESULT,
                  streamRequestId: modelStreamRequestId,
                  toolName: searchToolName,
                  result: {
                    query: enrichment.query,
                    results: enrichment.results,
                    images: enrichment.images,
                  },
                } satisfies StreamChunk,
              })

              modelToolCalls.push({
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
          modelOutcomes.set(modelId, {
            content: '',
            searchResults: [...searchResults],
            searchImages: [...searchImages],
            toolCalls: [],
            error: errorMessage,
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
        const [existingAssistantMessage] = await ctx.db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conversationId),
              eq(messages.role, MESSAGE_ROLES.ASSISTANT),
              eq(messages.clientRequestId, assistantClientRequestId),
            ),
          )
          .limit(1)

        if (existingAssistantMessage) {
          await ctx.db
            .update(messages)
            .set({
              content,
              metadata,
            })
            .where(eq(messages.id, existingAssistantMessage.id))
        } else {
          await ctx.db.insert(messages).values({
            conversationId,
            role: MESSAGE_ROLES.ASSISTANT,
            content,
            metadata,
            clientRequestId: assistantClientRequestId,
          })
        }
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

      if (!conversationId) {
        throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
      }

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

      const synthesisModelEntry = registry.find((m) => m.id === input.synthesisModel)
      if (!synthesisModelEntry) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `Invalid model ID: ${input.synthesisModel}`,
        })
      }
      if (synthesisModelEntry.supportsImageGeneration) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: AppError.IMAGE_GEN_INCOMPATIBLE,
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
        streamRequestId: crypto.randomUUID(),
        teamId: input.teamId,
        isTeamSynthesis: true,
        modelUsed: input.synthesisModel,
        userMessageId: storedUserMessageId ?? undefined,
      })

      const synthesisClientRequestId = buildDeterministicClientRequestId(
        `${input.teamId}:${input.synthesisModel}:synthesis`,
      )
      const [existingSynthesisMessage] = await ctx.db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, input.conversationId),
            eq(messages.role, MESSAGE_ROLES.ASSISTANT),
            eq(messages.clientRequestId, synthesisClientRequestId),
          ),
        )
        .limit(1)

      if (existingSynthesisMessage) {
        await ctx.db
          .update(messages)
          .set({
            content: synthesisText,
            metadata: synthesisMetadata,
          })
          .where(eq(messages.id, existingSynthesisMessage.id))
      } else {
        await ctx.db.insert(messages).values({
          conversationId: input.conversationId,
          role: MESSAGE_ROLES.ASSISTANT,
          content: synthesisText,
          metadata: synthesisMetadata,
          clientRequestId: synthesisClientRequestId,
        })
      }

      await ctx.db
        .update(conversations)
        .set({
          teamSynthesizerModel: input.synthesisModel,
          settingsVersion: sql`${conversations.settingsVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)),
        )

      yield {
        type: TEAM_EVENTS.SYNTHESIS_DONE,
        teamId: input.teamId,
      }
    }),
})

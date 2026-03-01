import { and, asc, eq, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, rateLimitedChatProcedure } from '../trpc'
import { GroupStreamInputSchema, GroupSynthesizeInputSchema } from '@/schemas/group'
import type { GroupOutputChunk, GroupSynthesisOutputChunk } from '@/schemas/group'
import { MessageMetadataSchema } from '@/schemas/message'
import type { StreamChunk } from '@/schemas/message'
import { conversations, messages } from '@/lib/db/schema'
import {
  GROUP_EVENTS,
  MESSAGE_ROLES,
  NEW_CHAT_TITLE,
  TRPC_CODES,
  LIMITS,
  STREAM_EVENTS,
} from '@/config/constants'
import type { Message } from '@openrouter/sdk/models'

type QueueItem =
  | { done: false; modelId: string; modelIndex: number; chunk: StreamChunk }
  | { done: true; modelId: string }

export const groupRouter = router({
  stream: rateLimitedChatProcedure.input(GroupStreamInputSchema).subscription(async function* ({
    ctx,
    input,
    signal,
  }): AsyncGenerator<GroupOutputChunk> {
    const runtimeConfig = ctx.runtimeConfig

    const { getModelRegistry } = await import('@/lib/ai/registry')
    const registry = await getModelRegistry({ runtimeConfig })

    for (const modelId of input.models) {
      if (!registry.some((m) => m.id === modelId)) {
        throw new TRPCError({
          code: TRPC_CODES.BAD_REQUEST,
          message: `Invalid model ID: ${modelId}`,
        })
      }
    }

    let conversationId = input.conversationId

    if (!conversationId) {
      const [created] = await ctx.db
        .insert(conversations)
        .values({
          userId: ctx.userId,
          model: input.models[0],
          searchMode: 'group',
        })
        .returning({ id: conversations.id })
      if (!created) {
        throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
      }
      conversationId = created.id
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

    void userMessageId

    const groupId = crypto.randomUUID()

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

    const systemPrompt = runtimeConfig.prompts.chatSystem
    const sdkMessages: Message[] = [
      { role: MESSAGE_ROLES.SYSTEM, content: systemPrompt },
      ...historyMessages,
      { role: MESSAGE_ROLES.USER, content: input.content },
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

    const next = (): Promise<void> =>
      new Promise<void>((r) => {
        resolver = r
      })

    const modelTexts: Map<string, string> = new Map()

    const spawnModelStream = async (modelId: string, modelIndex: number): Promise<void> => {
      try {
        const streamRequestId = crypto.randomUUID()
        const stream = await openrouter.chat.send(
          {
            chatGenerationParams: {
              model: modelId,
              messages: sdkMessages,
              stream: true,
              maxTokens: runtimeConfig.ai.chatMaxTokens,
            },
          },
          { signal: signal ?? undefined },
        )

        let fullText = ''
        for await (const streamChunk of stream) {
          const delta = streamChunk.choices[0]?.delta
          if (!delta?.content) continue
          fullText += delta.content
          const chunk: StreamChunk = {
            type: STREAM_EVENTS.TEXT,
            content: delta.content,
            streamRequestId,
            attempt: 0,
          }
          push({ done: false, modelId, modelIndex, chunk })
        }
        modelTexts.set(modelId, fullText)
      } catch {
        // Non-fatal: treat aborted/errored model stream as completion
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
        type: GROUP_EVENTS.MODEL_CHUNK,
        modelId: item.modelId,
        modelIndex: item.modelIndex,
        chunk: item.chunk,
      }
    }

    for (const modelId of input.models) {
      const content = modelTexts.get(modelId) ?? ''
      const metadata = MessageMetadataSchema.parse({
        groupId,
        modelUsed: modelId,
      })
      await ctx.db.insert(messages).values({
        conversationId,
        role: MESSAGE_ROLES.ASSISTANT,
        content,
        metadata,
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
      conversation.title === NEW_CHAT_TITLE &&
      Number(messageCount?.value ?? 0) <= 1 + input.models.length

    if (shouldGenerateTitle) {
      try {
        const { generateTitle } = await import('@/lib/ai/title')
        const generatedTitle = await generateTitle(
          input.content,
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
            .where(and(eq(conversations.id, conversationId), eq(conversations.userId, ctx.userId)))
        }
      } catch {
        // Title generation failure is non-fatal
      }
    }

    yield {
      type: GROUP_EVENTS.DONE,
      groupId,
      completedModels: input.models,
    }
  }),

  synthesize: protectedProcedure.input(GroupSynthesizeInputSchema).subscription(async function* ({
    ctx,
    input,
    signal,
  }): AsyncGenerator<GroupSynthesisOutputChunk> {
    const { getModelRegistry } = await import('@/lib/ai/registry')
    const registry = await getModelRegistry({ userId: ctx.userId })

    if (!registry.some((m) => m.id === input.judgeModel)) {
      throw new TRPCError({
        code: TRPC_CODES.BAD_REQUEST,
        message: `Invalid model ID: ${input.judgeModel}`,
      })
    }

    const [conversation] = await ctx.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)))
      .limit(1)

    if (!conversation) {
      throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
    }

    const allMessages = await ctx.db
      .select({ role: messages.role, content: messages.content, metadata: messages.metadata })
      .from(messages)
      .where(eq(messages.conversationId, input.conversationId))
      .orderBy(asc(messages.createdAt))

    const groupMessages = allMessages.filter(
      (m) =>
        m.role === MESSAGE_ROLES.ASSISTANT &&
        m.metadata !== null &&
        m.metadata !== undefined &&
        m.metadata.groupId === input.groupId &&
        m.metadata.isGroupSynthesis !== true,
    )

    if (groupMessages.length === 0) {
      throw new TRPCError({
        code: TRPC_CODES.NOT_FOUND,
        message: 'No group messages found',
      })
    }

    const groupMessageIndices = groupMessages.map((gm) =>
      allMessages.findIndex((m) => m.content === gm.content && m.role === gm.role),
    )
    const minIndex = Math.min(...groupMessageIndices)
    const userMessage = minIndex > 0 ? allMessages[minIndex - 1] : null
    const userMessageContent = userMessage?.role === MESSAGE_ROLES.USER ? userMessage.content : ''

    const modelResponsesXml = groupMessages
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
          model: input.judgeModel,
          messages: [{ role: MESSAGE_ROLES.USER, content: synthesisPrompt }],
          stream: true,
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
        type: GROUP_EVENTS.SYNTHESIS_CHUNK,
        content: delta.content,
      }
    }

    const synthesisMetadata = MessageMetadataSchema.parse({
      groupId: input.groupId,
      isGroupSynthesis: true,
      modelUsed: input.judgeModel,
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
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)))

    yield {
      type: GROUP_EVENTS.SYNTHESIS_DONE,
      groupId: input.groupId,
    }
  }),
})

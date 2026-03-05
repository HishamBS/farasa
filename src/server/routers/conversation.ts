import { and, desc, eq, ilike, lt, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { conversations, messages } from '@/lib/db/schema'
import {
  ConversationByIdSchema,
  CreateConversationSchema,
  ConversationFilterSchema,
  DeleteConversationSchema,
  ExportConversationSchema,
  GenerateTitleSchema,
  MessageListInputSchema,
  MessageListOutputSchema,
  UpdateConversationSchema,
} from '@/schemas/conversation'
import { NEW_CHAT_TITLE, TRPC_CODES, MESSAGE_ROLES } from '@/config/constants'
import type { MessageMetadata } from '@/schemas/message'
import { getRuntimeConfig } from '@/lib/runtime-config/service'
import { resolvePaginationLimit } from '@/lib/db/utils'

export const conversationRouter = router({
  list: protectedProcedure.input(ConversationFilterSchema).query(async ({ ctx, input }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
    const conditions = [eq(conversations.userId, ctx.userId)]

    if (input.cursor) {
      const cursorDate = new Date(input.cursor)
      conditions.push(lt(conversations.updatedAt, cursorDate))
    }

    if (input.search) {
      conditions.push(ilike(conversations.title, `%${input.search}%`))
    }

    const { resolvedLimit, fetchLimit } = resolvePaginationLimit(input.limit, runtimeConfig.limits)
    const rows = await ctx.db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt), desc(conversations.id))
      .limit(fetchLimit)

    const hasMore = rows.length === fetchLimit
    const items = hasMore ? rows.slice(0, resolvedLimit) : rows
    const lastItem = items[items.length - 1]
    const nextCursor = hasMore && lastItem ? lastItem.updatedAt.toISOString() : undefined

    return { items, nextCursor }
  }),

  getById: protectedProcedure.input(ConversationByIdSchema).query(async ({ ctx, input }) => {
    const [conversation] = await ctx.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, input.id), eq(conversations.userId, ctx.userId)))
      .limit(1)

    if (!conversation) {
      throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
    }

    return conversation
  }),

  create: protectedProcedure.input(CreateConversationSchema).mutation(async ({ ctx, input }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
    if (input.title && input.title.length > runtimeConfig.limits.conversationTitleMaxLength) {
      throw new TRPCError({ code: TRPC_CODES.BAD_REQUEST })
    }

    const [created] = await ctx.db
      .insert(conversations)
      .values({
        userId: ctx.userId,
        title:
          input.title?.slice(0, runtimeConfig.limits.conversationTitleMaxLength) ?? NEW_CHAT_TITLE,
        model: input.model,
        mode: input.mode,
        webSearchEnabled: input.webSearchEnabled,
        teamModels: input.teamModels,
        teamSynthesizerModel: input.teamSynthesizerModel ?? undefined,
      })
      .returning()

    if (!created) {
      throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
    }

    return created
  }),

  update: protectedProcedure.input(UpdateConversationSchema).mutation(async ({ ctx, input }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
    const { id, ...rest } = input
    const safeTitle =
      rest.title !== undefined
        ? rest.title.slice(0, runtimeConfig.limits.conversationTitleMaxLength)
        : undefined

    const shouldBumpSettingsVersion =
      rest.mode !== undefined ||
      rest.webSearchEnabled !== undefined ||
      rest.model !== undefined ||
      rest.teamModels !== undefined ||
      rest.teamSynthesizerModel !== undefined

    const [updated] = await ctx.db
      .update(conversations)
      .set({
        ...rest,
        title: safeTitle,
        updatedAt: new Date(),
        ...(shouldBumpSettingsVersion
          ? { settingsVersion: sql`${conversations.settingsVersion} + 1` }
          : {}),
      })
      .where(and(eq(conversations.id, id), eq(conversations.userId, ctx.userId)))
      .returning()

    if (!updated) {
      throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
    }

    return updated
  }),

  delete: protectedProcedure.input(DeleteConversationSchema).mutation(async ({ ctx, input }) => {
    const [deleted] = await ctx.db
      .delete(conversations)
      .where(and(eq(conversations.id, input.id), eq(conversations.userId, ctx.userId)))
      .returning({ id: conversations.id })

    if (!deleted) {
      throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
    }

    return { id: deleted.id }
  }),

  generateTitle: protectedProcedure.input(GenerateTitleSchema).mutation(async ({ ctx, input }) => {
    const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
    const [conversation] = await ctx.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)))
      .limit(1)

    if (!conversation) {
      throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
    }

    const { generateTitle } = await import('@/lib/ai/title')
    const generated = await generateTitle(input.firstMessage, runtimeConfig)
    const title = generated.slice(0, runtimeConfig.limits.conversationTitleMaxLength)

    const [updated] = await ctx.db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)))
      .returning({ title: conversations.title })

    const boundedTitle = (updated?.title ?? title).slice(
      0,
      runtimeConfig.limits.conversationTitleMaxLength,
    )
    return { title: boundedTitle }
  }),

  exportMarkdown: protectedProcedure
    .input(ExportConversationSchema)
    .query(async ({ ctx, input }) => {
      const [conversation] = await ctx.db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, input.id), eq(conversations.userId, ctx.userId)))
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
      }

      const msgs = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.id))
        .orderBy(messages.createdAt)

      const lines: string[] = [`# ${conversation.title}`, '']

      for (const msg of msgs) {
        if (msg.role === MESSAGE_ROLES.USER) {
          lines.push(`**You:** ${msg.content}`, '')
        } else if (msg.role === MESSAGE_ROLES.ASSISTANT) {
          const modelLine = (msg.metadata as MessageMetadata | null)?.modelUsed
          const prefix = modelLine ? `**Assistant** (${modelLine}):` : '**Assistant:**'
          lines.push(`${prefix} ${msg.content}`, '')
        }
      }

      return { markdown: lines.join('\n'), title: conversation.title }
    }),

  messages: protectedProcedure
    .input(MessageListInputSchema)
    .output(MessageListOutputSchema)
    .query(async ({ ctx, input }) => {
      const runtimeConfig = await getRuntimeConfig({ userId: ctx.userId })
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

      const conditions = [eq(messages.conversationId, input.conversationId)]
      if (input.cursor) {
        conditions.push(lt(messages.createdAt, new Date(input.cursor)))
      }

      const { resolvedLimit, fetchLimit } = resolvePaginationLimit(
        input.limit,
        runtimeConfig.limits,
      )

      const rows = await ctx.db.query.messages.findMany({
        where: and(...conditions),
        orderBy: (_fields, operators) => [
          operators.desc(messages.createdAt),
          operators.desc(messages.id),
        ],
        limit: fetchLimit,
        with: {
          attachments: true,
        },
      })

      const hasMore = rows.length === fetchLimit
      const trimmed = hasMore ? rows.slice(0, resolvedLimit) : rows
      const reversed = trimmed.reverse()
      const nextCursor = hasMore && reversed[0] ? reversed[0].createdAt.toISOString() : null

      return { messages: reversed, nextCursor }
    }),
})

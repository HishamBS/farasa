import { and, desc, eq, lt, like } from 'drizzle-orm'
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
  UpdateConversationSchema,
} from '@/schemas/conversation'
import { NEW_CHAT_TITLE } from '@/config/constants'
import type { MessageMetadata } from '@/schemas/message'

export const conversationRouter = router({
  list: protectedProcedure
    .input(ConversationFilterSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(conversations.userId, ctx.userId)]

      if (input.cursor) {
        const cursorDate = new Date(input.cursor)
        conditions.push(lt(conversations.updatedAt, cursorDate))
      }

      if (input.search) {
        conditions.push(like(conversations.title, `%${input.search}%`))
      }

      const fetchLimit = input.limit + 1
      const rows = await ctx.db
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt))
        .limit(fetchLimit)

      const hasMore = rows.length === fetchLimit
      const items = hasMore ? rows.slice(0, input.limit) : rows
      const lastItem = items[items.length - 1]
      const nextCursor = hasMore && lastItem ? lastItem.updatedAt.toISOString() : undefined

      return { items, nextCursor }
    }),

  getById: protectedProcedure
    .input(ConversationByIdSchema)
    .query(async ({ ctx, input }) => {
      const [conversation] = await ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.id),
            eq(conversations.userId, ctx.userId),
          ),
        )
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return conversation
    }),

  create: protectedProcedure
    .input(CreateConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(conversations)
        .values({
          userId: ctx.userId,
          title: input.title ?? NEW_CHAT_TITLE,
          model: input.model,
        })
        .returning()

      if (!created) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
      }

      return created
    }),

  update: protectedProcedure
    .input(UpdateConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input

      const [updated] = await ctx.db
        .update(conversations)
        .set({ ...rest, updatedAt: new Date() })
        .where(
          and(
            eq(conversations.id, id),
            eq(conversations.userId, ctx.userId),
          ),
        )
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return updated
    }),

  delete: protectedProcedure
    .input(DeleteConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(conversations)
        .where(
          and(
            eq(conversations.id, input.id),
            eq(conversations.userId, ctx.userId),
          ),
        )
        .returning({ id: conversations.id })

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return { id: deleted.id }
    }),

  generateTitle: protectedProcedure
    .input(GenerateTitleSchema)
    .mutation(async ({ ctx, input }) => {
      const [conversation] = await ctx.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.userId),
          ),
        )
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const { generateTitle } = await import('@/lib/ai/title')
      const title = await generateTitle(input.firstMessage)

      const [updated] = await ctx.db
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.userId),
          ),
        )
        .returning({ title: conversations.title })

      return { title: updated?.title ?? title }
    }),

  exportMarkdown: protectedProcedure
    .input(ExportConversationSchema)
    .query(async ({ ctx, input }) => {
      const [conversation] = await ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.id),
            eq(conversations.userId, ctx.userId),
          ),
        )
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const msgs = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.id))
        .orderBy(messages.createdAt)

      const lines: string[] = [`# ${conversation.title}`, '']

      for (const msg of msgs) {
        if (msg.role === 'user') {
          lines.push(`**You:** ${msg.content}`, '')
        } else if (msg.role === 'assistant') {
          const modelLine = (msg.metadata as MessageMetadata | null)?.modelUsed
          const prefix = modelLine
            ? `**Assistant** (${modelLine}):`
            : '**Assistant:**'
          lines.push(`${prefix} ${msg.content}`, '')
        }
      }

      return { markdown: lines.join('\n'), title: conversation.title }
    }),

  messages: protectedProcedure
    .input(MessageListInputSchema)
    .query(async ({ ctx, input }) => {
      const [conversation] = await ctx.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.userId),
          ),
        )
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const conditions = [eq(messages.conversationId, input.conversationId)]
      if (input.cursor) {
        conditions.push(lt(messages.createdAt, new Date(input.cursor)))
      }

      const rows = await ctx.db.query.messages.findMany({
        where: and(...conditions),
        orderBy: (_fields, operators) => [operators.desc(messages.createdAt)],
        limit: input.limit,
        with: {
          attachments: true,
        },
      })

      return rows.reverse()
    }),
})

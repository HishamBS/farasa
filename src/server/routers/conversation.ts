import { and, desc, eq, lt, like } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { conversations, messages } from '@/lib/db/schema'
import {
  CreateConversationSchema,
  UpdateConversationSchema,
  ConversationFilterSchema,
} from '@/schemas/conversation'
import { LIMITS, NEW_CHAT_TITLE } from '@/config/constants'
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

      return ctx.db
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt))
        .limit(input.limit)
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
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
    .input(z.object({ id: z.string().uuid() }))
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
    .input(
      z.object({
        conversationId: z.string().uuid(),
        firstMessage: z.string().max(LIMITS.MESSAGE_MAX_LENGTH),
      }),
    )
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
    .input(z.object({ id: z.string().uuid() }))
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
    .input(z.object({ conversationId: z.string().uuid() }))
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

      return ctx.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(messages.createdAt)
    }),
})

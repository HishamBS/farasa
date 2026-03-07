import { and, eq } from 'drizzle-orm'
import { messages } from '@/lib/db/schema'
import { MESSAGE_ROLES, TRPC_CODES } from '@/config/constants'
import { AppError } from '@/lib/utils/errors'
import { TRPCError } from '@trpc/server'
import type { DB } from '@/lib/db/client'

import type { MessageMetadata } from '@/schemas/message'

export async function persistUserMessage(params: {
  db: DB
  conversationId: string
  content: string
  clientRequestId: string
  metadata?: MessageMetadata
}): Promise<{ messageId: string; isNew: boolean }> {
  const [existing] = await params.db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, params.conversationId),
        eq(messages.role, MESSAGE_ROLES.USER),
        eq(messages.clientRequestId, params.clientRequestId),
      ),
    )
    .limit(1)

  if (existing) {
    return { messageId: existing.id, isNew: false }
  }

  const [created] = await params.db
    .insert(messages)
    .values({
      conversationId: params.conversationId,
      role: MESSAGE_ROLES.USER,
      content: params.content,
      clientRequestId: params.clientRequestId,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    })
    .returning({ id: messages.id })

  if (!created) {
    throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR, message: AppError.INTERNAL })
  }

  return { messageId: created.id, isNew: true }
}

export async function persistAssistantMessage(params: {
  db: DB
  conversationId: string
  content: string
  clientRequestId: string
  metadata: MessageMetadata
  streamSequenceMax?: number | null
  tokenCount?: number | null
}): Promise<{ messageId: string; isUpdate: boolean }> {
  const [existing] = await params.db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, params.conversationId),
        eq(messages.role, MESSAGE_ROLES.ASSISTANT),
        eq(messages.clientRequestId, params.clientRequestId),
      ),
    )
    .limit(1)

  if (existing) {
    await params.db
      .update(messages)
      .set({
        content: params.content,
        metadata: params.metadata,
        ...(params.streamSequenceMax !== undefined
          ? { streamSequenceMax: params.streamSequenceMax }
          : {}),
        ...(params.tokenCount !== undefined ? { tokenCount: params.tokenCount } : {}),
      })
      .where(eq(messages.id, existing.id))
    return { messageId: existing.id, isUpdate: true }
  }

  const [created] = await params.db
    .insert(messages)
    .values({
      conversationId: params.conversationId,
      role: MESSAGE_ROLES.ASSISTANT,
      content: params.content,
      metadata: params.metadata,
      clientRequestId: params.clientRequestId,
      ...(params.streamSequenceMax !== undefined
        ? { streamSequenceMax: params.streamSequenceMax }
        : {}),
      ...(params.tokenCount !== undefined ? { tokenCount: params.tokenCount } : {}),
    })
    .returning({ id: messages.id })

  if (!created) {
    throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR, message: AppError.INTERNAL })
  }

  return { messageId: created.id, isUpdate: false }
}

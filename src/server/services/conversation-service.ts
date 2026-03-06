import { and, eq, sql } from 'drizzle-orm'
import { conversations } from '@/lib/db/schema'
import { TRPC_CODES } from '@/config/constants'
import { AppError } from '@/lib/utils/errors'
import { TRPCError } from '@trpc/server'
import type { DB } from '@/lib/db/client'
import type { ChatMode } from '@/schemas/message'

export async function createConversation(params: {
  db: DB
  userId: string
  model?: string | null
  mode: ChatMode
  webSearchEnabled?: boolean
  teamModels?: string[]
}): Promise<{ id: string }> {
  const [created] = await params.db
    .insert(conversations)
    .values({
      userId: params.userId,
      model: params.model ?? null,
      mode: params.mode,
      webSearchEnabled: params.webSearchEnabled ?? false,
      ...(params.teamModels ? { teamModels: params.teamModels } : {}),
    })
    .returning({ id: conversations.id })

  if (!created) {
    throw new TRPCError({
      code: TRPC_CODES.INTERNAL_SERVER_ERROR,
      message: AppError.CONVERSATION_CREATE_FAILED,
    })
  }

  return created
}

export async function findConversation(params: {
  db: DB
  conversationId: string
  userId: string
}): Promise<{ id: string; title: string; model: string | null }> {
  const [conversation] = await params.db
    .select({
      id: conversations.id,
      title: conversations.title,
      model: conversations.model,
    })
    .from(conversations)
    .where(
      and(eq(conversations.id, params.conversationId), eq(conversations.userId, params.userId)),
    )
    .limit(1)

  if (!conversation) {
    throw new TRPCError({
      code: TRPC_CODES.NOT_FOUND,
      message: AppError.CONVERSATION_NOT_FOUND,
    })
  }

  return conversation
}

export async function updateConversationSettings(params: {
  db: DB
  conversationId: string
  userId: string
  settings: Partial<{
    model: string | null
    mode: ChatMode
    webSearchEnabled: boolean
    teamModels: string[]
    teamSynthesizerModel: string
  }>
}): Promise<void> {
  await params.db
    .update(conversations)
    .set({
      ...params.settings,
      settingsVersion: sql`${conversations.settingsVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(conversations.id, params.conversationId), eq(conversations.userId, params.userId)),
    )
}

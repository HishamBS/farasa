import { LIMITS, MESSAGE_ROLES, NEW_CHAT_TITLE } from '@/config/constants'
import type { db as DbClient } from '@/lib/db/client'
import { conversations, messages } from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/utils/errors'
import { MessageMetadataSchema } from '@/schemas/message'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import { and, asc, eq, sql } from 'drizzle-orm'

type TitleGenerationParams = {
  db: typeof DbClient
  conversationId: string
  userId: string
  currentTitle: string
  fallbackContent: string
  runtimeConfig: RuntimeConfig
}

export async function generateAndPersistTitle(
  params: TitleGenerationParams,
): Promise<{ title: string } | null> {
  const { db, conversationId, userId, currentTitle, fallbackContent, runtimeConfig } = params

  if (currentTitle !== NEW_CHAT_TITLE) return null

  const [firstAssistantMessage] = await db
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

  let titleSeedMessage = fallbackContent
  if (firstUserMessageId) {
    const [seedUserMessage] = await db
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

  if (!titleSeedMessage.trim()) return null

  try {
    const titleSignal = AbortSignal.timeout(LIMITS.TITLE_GEN_TIMEOUT_MS)
    const { generateTitle } = await import('@/lib/ai/title')
    const generatedTitle = await generateTitle(titleSeedMessage, runtimeConfig, titleSignal)
    const safeTitle = generatedTitle
      .trim()
      .slice(0, runtimeConfig.limits.conversationTitleMaxLength)
    if (safeTitle) {
      await db
        .update(conversations)
        .set({ title: safeTitle, updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      return { title: safeTitle }
    }
  } catch (titleError: unknown) {
    console.error('[title-gen] generateTitle failed:', getErrorMessage(titleError))
  }
  return null
}

import { LIMITS, MESSAGE_ROLES, TRPC_CODES } from '@/config/constants'
import type { db } from '@/lib/db/client'
import { attachments, messages } from '@/lib/db/schema'
import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'
import { AppError } from '@/lib/utils/errors'
import type { ChatMessageContentItem, Message } from '@openrouter/sdk/models'
import {
  ChatMessageContentItemImageType,
  ChatMessageContentItemTextType,
} from '@openrouter/sdk/models'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { extractFileContentBlock } from './text-extraction'

export type AttachmentRow = typeof attachments.$inferSelect

async function buildAttachmentBlocks(
  attachmentRows: AttachmentRow[],
): Promise<ChatMessageContentItem[]> {
  const blocks: ChatMessageContentItem[] = []
  for (const att of attachmentRows) {
    if (att.fileType.startsWith('image/')) {
      blocks.push({
        type: ChatMessageContentItemImageType.ImageUrl,
        imageUrl: { url: att.storageUrl },
      })
    } else {
      const fileBlock = await extractFileContentBlock(att.fileName, att.fileType, att.storageUrl)
      if (fileBlock) {
        blocks.push({
          type: ChatMessageContentItemTextType.Text,
          text: fileBlock,
        })
      }
    }
  }
  return blocks
}

export async function buildUserContent(
  text: string,
  attachmentRows: AttachmentRow[],
): Promise<string | ChatMessageContentItem[]> {
  if (attachmentRows.length === 0) return text
  return [
    { type: ChatMessageContentItemTextType.Text, text },
    ...(await buildAttachmentBlocks(attachmentRows)),
  ]
}

export async function linkAttachmentsToMessage(
  dbClient: typeof db,
  userId: string,
  attachmentIds: string[],
  messageId: string,
): Promise<AttachmentRow[]> {
  const linked = await dbClient
    .update(attachments)
    .set({ messageId })
    .where(
      and(
        inArray(attachments.id, attachmentIds),
        eq(attachments.userId, userId),
        isNotNull(attachments.confirmedAt),
      ),
    )
    .returning()

  if (linked.length !== attachmentIds.length) {
    throw new TRPCError({
      code: TRPC_CODES.FORBIDDEN,
      message: AppError.ATTACHMENT_ACCESS_DENIED,
    })
  }

  return linked
}

function buildHistoryAttachmentAnnotation(rows: { fileName: string; fileType: string }[]): string {
  return rows
    .map((att) => `[Attached file: ${escapeXmlForPrompt(att.fileName)} (${att.fileType})]`)
    .join('\n')
}

export async function buildEnrichedHistory(
  dbClient: typeof db,
  conversationId: string,
  options?: {
    excludeMessageIds?: string[]
  },
): Promise<Message[]> {
  const excludedMessageIds = new Set(options?.excludeMessageIds ?? [])

  const historyRows = await dbClient
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      metadata: messages.metadata,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        or(eq(messages.role, MESSAGE_ROLES.USER), eq(messages.role, MESSAGE_ROLES.ASSISTANT)),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(LIMITS.CONVERSATION_HISTORY_LIMIT)

  const userMessageIds = historyRows.filter((r) => r.role === MESSAGE_ROLES.USER).map((r) => r.id)

  const historyAttachmentRows =
    userMessageIds.length > 0
      ? await dbClient
          .select({
            id: attachments.id,
            messageId: attachments.messageId,
            fileName: attachments.fileName,
            fileType: attachments.fileType,
          })
          .from(attachments)
          .where(
            and(inArray(attachments.messageId, userMessageIds), isNotNull(attachments.confirmedAt)),
          )
      : []

  const attachmentsByMessageId = new Map<string, (typeof historyAttachmentRows)[number][]>()
  for (const att of historyAttachmentRows) {
    if (!att.messageId) continue
    const existing = attachmentsByMessageId.get(att.messageId) ?? []
    existing.push(att)
    attachmentsByMessageId.set(att.messageId, existing)
  }

  return historyRows
    .filter((row) => !excludedMessageIds.has(row.id))
    .map((row) => {
      if (row.role === MESSAGE_ROLES.USER) {
        const rowAttachments = attachmentsByMessageId.get(row.id)
        if (rowAttachments && rowAttachments.length > 0) {
          const annotation = buildHistoryAttachmentAnnotation(rowAttachments)
          return { role: row.role, content: `${row.content}\n${annotation}` }
        }
        return { role: row.role, content: row.content }
      }

      let enrichedContent = row.content
      const meta = row.metadata

      if (meta?.searchQuery && meta?.searchResults?.length) {
        const safeQuery = escapeXmlForPrompt(meta.searchQuery)
        enrichedContent = `[This response used web search for: "${safeQuery}"]\n${enrichedContent}`
      }
      if (meta?.teamId && meta?.modelUsed) {
        const safeModel = escapeXmlForPrompt(meta.modelUsed)
        const label = meta.isTeamSynthesis ? 'Synthesis by' : 'Response from'
        enrichedContent = `[${label}: ${safeModel}]\n${enrichedContent}`
      }

      return { role: row.role, content: enrichedContent }
    })
}
